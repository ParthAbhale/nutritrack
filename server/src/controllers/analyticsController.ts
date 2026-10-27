import type { Request, Response } from 'express';
import * as analytics from '../services/analyticsService';
import { getStreak } from '../services/progressService';
import { listActivity } from '../services/activityService';
import { diaryCsv } from '../services/exportService';
import { valid } from '../middleware/validate';

const uid = (req: Request) => req.auth!.userId;

export async function month(req: Request, res: Response) {
  const { year, month } = valid<{ year: number; month: number }>(req, 'query');
  res.json({ data: await analytics.monthCalendar(uid(req), year, month) });
}

export async function daily(req: Request, res: Response) {
  res.json({ data: await analytics.dailySummary(uid(req), valid<{ date: string }>(req, 'query').date) });
}

export async function range(req: Request, res: Response) {
  const { from, to } = valid<{ from: string; to: string }>(req, 'query');
  res.json({ data: await analytics.rangeAnalytics(uid(req), from, to) });
}

export async function streak(req: Request, res: Response) {
  res.json({ data: await getStreak(uid(req)) });
}

export async function activity(req: Request, res: Response) {
  res.json({ data: await listActivity(uid(req)) });
}

export async function exportDiaryCsv(req: Request, res: Response) {
  const { from, to } = valid<{ from: string; to: string }>(req, 'query');
  const csv = await diaryCsv(uid(req), from, to);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="nutritrack-diary-${from}-to-${to}.csv"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(csv);
}
