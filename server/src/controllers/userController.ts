import type { Request, Response } from 'express';
import type { ProfileUpdateInput } from '@nutritrack/shared';
import * as users from '../services/userService';
import * as auth from '../services/authService';
import { personalDataExport } from '../services/exportService';
import { clearAuthCookies } from '../services/tokenService';
import { valid } from '../middleware/validate';

const uid = (req: Request) => req.auth!.userId;

export async function getMe(req: Request, res: Response) {
  res.json({ data: await users.getProfile(uid(req)) });
}

export async function updateMe(req: Request, res: Response) {
  res.json({ data: await users.updateProfile(uid(req), valid<ProfileUpdateInput>(req, 'body')) });
}

export async function listSessions(req: Request, res: Response) {
  res.json({ data: await auth.listSessions(uid(req), req.auth!.sessionId) });
}

export async function revokeSession(req: Request, res: Response) {
  await auth.revokeOwnSession(uid(req), valid<{ sessionId: string }>(req, 'params').sessionId);
  res.status(204).end();
}

export async function exportData(req: Request, res: Response) {
  const data = await personalDataExport(uid(req));
  res.setHeader('Content-Disposition', 'attachment; filename="nutritrack-export.json"');
  res.setHeader('Cache-Control', 'no-store');
  res.json(data);
}

export async function deleteMe(req: Request, res: Response) {
  await auth.deleteAccount(uid(req), valid<{ password: string }>(req, 'body').password);
  clearAuthCookies(res);
  res.status(204).end();
}

export async function addMilestone(req: Request, res: Response) {
  res.status(201).json({ data: await users.addMilestone(uid(req), valid(req, 'body')) });
}

export async function removeMilestone(req: Request, res: Response) {
  await users.removeMilestone(uid(req), valid<{ milestoneId: string }>(req, 'params').milestoneId);
  res.status(204).end();
}
