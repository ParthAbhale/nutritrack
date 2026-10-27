import mongoose from 'mongoose';
import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { createApp } from '../app';
import { connectDatabase } from '../config/db';

let app: Express;

export function useTestApp() {
  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) await connectDatabase(process.env.MONGODB_URI!);
    app = createApp();
  });
  beforeEach(async () => {
    const collections = await mongoose.connection.db!.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });
  return () => app;
}

export type TestClient = Awaited<ReturnType<typeof createClient>>;

/** A cookie-persisting client that attaches the CSRF header to mutating requests. */
export async function createClient(appInstance: Express) {
  const agent = request.agent(appInstance);
  const csrfRes = await agent.get('/api/v1/auth/csrf').expect(200);
  let csrf: string = csrfRes.body.data.csrfToken;
  const withCsrf = <T extends request.Test>(t: T) => t.set('X-CSRF-Token', csrf);
  return {
    agent,
    get: (url: string) => agent.get(url),
    post: (url: string, body?: object) => withCsrf(agent.post(url)).send(body ?? {}),
    patch: (url: string, body?: object) => withCsrf(agent.patch(url)).send(body ?? {}),
    del: (url: string, body?: object) => withCsrf(agent.delete(url)).send(body ?? {}),
    setCsrf: (token: string) => {
      csrf = token;
    },
  };
}

let counter = 0;
export const uniqueId = (prefix = 'req') => `${prefix}_${Date.now()}_${++counter}`;

export async function registeredClient(appInstance: Express, overrides: { email?: string; name?: string } = {}) {
  const client = await createClient(appInstance);
  const email = overrides.email ?? `user${++counter}@example.com`;
  const res = await client
    .post('/api/v1/auth/register', { name: overrides.name ?? 'Test User', email, password: 'CorrectHorse9', acceptTerms: true })
    .expect(201);
  client.setCsrf(res.body.data.csrfToken);
  return { client, user: res.body.data.user as { id: string; email: string }, email, password: 'CorrectHorse9' };
}
