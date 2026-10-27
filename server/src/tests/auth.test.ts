import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { AuthToken, Session, User } from '../models';
import { randomToken, sha256 } from '../utils/crypto';
import { createClient, registeredClient, useTestApp } from './helpers';

const app = useTestApp();
const cookies = (res: { headers: Record<string, unknown> }) => (res.headers['set-cookie'] as string[] | undefined) ?? [];

describe('registration', () => {
  it('creates an account, hashes the password, and never returns the hash', async () => {
    const client = await createClient(app());
    const res = await client
      .post('/api/v1/auth/register', { name: 'Ada', email: '  Ada@Example.COM ', password: 'CorrectHorse9', acceptTerms: true })
      .expect(201);
    expect(res.body.data.user.email).toBe('ada@example.com');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/);
    expect(res.body.data.emailSent).toBe(false);
    expect(res.body.data.emailNotice).toMatch(/not configured/);
    const stored = await User.findOne({ email: 'ada@example.com' }).select('+passwordHash').lean();
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(cookies(res).join(';')).toMatch(/nt_access=.*HttpOnly/);
  });

  it('rejects duplicates and invalid input with field errors', async () => {
    const { email } = await registeredClient(app());
    const client = await createClient(app());
    await client.post('/api/v1/auth/register', { name: 'X', email, password: 'CorrectHorse9', acceptTerms: true }).expect(409);
    const bad = await client.post('/api/v1/auth/register', { name: '', email: 'nope', password: 'short', acceptTerms: false }).expect(400);
    const paths = bad.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password', 'acceptTerms']));
  });
});

describe('login, sessions and logout', () => {
  it('uses a generic error for unknown email and wrong password', async () => {
    const { email } = await registeredClient(app());
    const client = await createClient(app());
    const a = await client.post('/api/v1/auth/login', { email, password: 'WrongHorse99' }).expect(401);
    const b = await client.post('/api/v1/auth/login', { email: 'nobody@example.com', password: 'WrongHorse99' }).expect(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  it('restores the session via /auth/me and blocks protected routes without auth', async () => {
    const { client } = await registeredClient(app());
    await client.get('/api/v1/auth/me').expect(200);
    await request(app()).get('/api/v1/users/me').expect(401);
  });

  it('logout revokes the session', async () => {
    const { client } = await registeredClient(app());
    await client.post('/api/v1/auth/logout').expect(204);
    await client.get('/api/v1/users/me').expect(401);
    await client.post('/api/v1/auth/refresh').expect(401);
  });

  it('a revoked session cannot use a still-valid access token', async () => {
    const { client, user } = await registeredClient(app());
    await Session.updateMany({ userId: user.id }, { revokedAt: new Date() });
    await client.get('/api/v1/users/me').expect(401);
  });

  it('rotates refresh tokens and revokes the session when an old token is reused', async () => {
    const client = await createClient(app());
    const reg = await client
      .post('/api/v1/auth/register', { name: 'R', email: 'rotate@example.com', password: 'CorrectHorse9', acceptTerms: true })
      .expect(201);
    client.setCsrf(reg.body.data.csrfToken);
    const original = cookies(reg).find((c: string) => c.startsWith('nt_refresh='))!.split(';')[0]!;
    const rotated = await client.post('/api/v1/auth/refresh').expect(200);
    const next = cookies(rotated).find((c: string) => c.startsWith('nt_refresh='))!.split(';')[0]!;
    expect(next).not.toBe(original);

    // An unknown secret is rejected without revoking the session.
    const sessionId = original.slice('nt_refresh='.length).split('.')[0]!;
    const csrfRes = await request(app()).get('/api/v1/auth/csrf');
    const csrfCookie = cookies(csrfRes)[0]!.split(';')[0]!;
    const replay = (cookie: string) =>
      request(app()).post('/api/v1/auth/refresh').set('Cookie', `${cookie}; ${csrfCookie}`).set('X-CSRF-Token', csrfRes.body.data.csrfToken);
    await replay(`nt_refresh=${sessionId}.guessed-secret`).expect(401);
    expect((await Session.findById(sessionId).lean())?.revokedAt).toBeNull();

    // Within the grace window a concurrent refresh with the previous token is tolerated...
    await replay(original).expect(200);
    // ...but after it, replaying the rotated-out token is treated as theft.
    await Session.updateOne({ _id: sessionId }, { rotatedAt: new Date(Date.now() - 60_000) });
    await replay(original).expect(401);
    const after = await Session.findById(sessionId).lean();
    expect(after?.revokedReason).toBe('refresh_token_reuse');
    await client.get('/api/v1/users/me').expect(401);
  });

  it('locks the account after repeated failures', async () => {
    const { email } = await registeredClient(app());
    const client = await createClient(app());
    for (let i = 0; i < 5; i++) await client.post('/api/v1/auth/login', { email, password: 'WrongHorse99' }).expect(401);
    const locked = await client.post('/api/v1/auth/login', { email, password: 'CorrectHorse9' }).expect(429);
    expect(locked.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('CSRF', () => {
  it('rejects mutating requests without a valid token', async () => {
    const { client } = await registeredClient(app());
    const res = await client.agent.patch('/api/v1/users/me').send({ name: 'Mallory' }).expect(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
    await client.agent.patch('/api/v1/users/me').set('X-CSRF-Token', 'forged.token').send({ name: 'Mallory' }).expect(403);
  });
});

describe('password reset and verification', () => {
  it('responds identically for unknown emails', async () => {
    const client = await createClient(app());
    const res = await client.post('/api/v1/auth/forgot-password', { email: 'ghost@example.com' }).expect(202);
    expect(res.body.data.message).toMatch(/If an account exists/);
  });

  it('resets the password with a single-use token and revokes sessions', async () => {
    const { client, user, email } = await registeredClient(app());
    const token = randomToken(32);
    await AuthToken.create({ userId: user.id, type: 'reset_password', tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60_000) });
    const anon = await createClient(app());
    await anon.post('/api/v1/auth/reset-password', { token, password: 'NewPassword77' }).expect(200);
    await anon.post('/api/v1/auth/reset-password', { token, password: 'NewPassword88' }).expect(400);
    await client.get('/api/v1/users/me').expect(401);
    await anon.post('/api/v1/auth/login', { email, password: 'NewPassword77' }).expect(200);
  });

  it('rejects expired tokens and verifies email', async () => {
    const { user } = await registeredClient(app());
    const expired = randomToken(32);
    await AuthToken.create({ userId: user.id, type: 'reset_password', tokenHash: sha256(expired), expiresAt: new Date(Date.now() - 1000) });
    const anon = await createClient(app());
    await anon.post('/api/v1/auth/reset-password', { token: expired, password: 'NewPassword77' }).expect(400);
    const verify = randomToken(32);
    await AuthToken.create({ userId: user.id, type: 'verify_email', tokenHash: sha256(verify), expiresAt: new Date(Date.now() + 60_000) });
    await anon.post('/api/v1/auth/verify-email', { token: verify }).expect(200);
    expect((await User.findById(user.id).lean())?.emailVerifiedAt).toBeTruthy();
  });

  it('rate-limits password reset emails', async () => {
    const client = await createClient(app());
    for (let i = 0; i < 5; i++) await client.post('/api/v1/auth/forgot-password', { email: 'limit@example.com' }).expect(202);
    await client.post('/api/v1/auth/forgot-password', { email: 'limit@example.com' }).expect(429);
  });

  it('changes password and signs out other sessions', async () => {
    const { client, email, password } = await registeredClient(app());
    const other = await createClient(app());
    const login = await other.post('/api/v1/auth/login', { email, password }).expect(200);
    other.setCsrf(login.body.data.csrfToken);
    await client.post('/api/v1/auth/change-password', { currentPassword: 'wrong', newPassword: 'Another123A' }).expect(400);
    await client.post('/api/v1/auth/change-password', { currentPassword: password, newPassword: 'Another123A' }).expect(200);
    await client.get('/api/v1/users/me').expect(200);
    await other.get('/api/v1/users/me').expect(401);
  });
});

describe('account deletion', () => {
  it('requires the password and removes all user data', async () => {
    const { client, user, password } = await registeredClient(app());
    await client.del('/api/v1/users/me', { password: 'nope', confirm: 'DELETE' }).expect(400);
    await client.del('/api/v1/users/me', { password, confirm: 'DELETE' }).expect(204);
    expect(await User.findById(user.id)).toBeNull();
    expect(await Session.countDocuments({ userId: user.id })).toBe(0);
  });
});
