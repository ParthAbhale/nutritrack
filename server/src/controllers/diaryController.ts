import type { Request, Response } from 'express';
import type { CopyDayInput, DiaryEntryCreateInput, DiaryEntryUpdateInput, Meal } from '@nutritrack/shared';
import * as diary from '../services/diaryService';
import * as analytics from '../services/analyticsService';
import { valid } from '../middleware/validate';

const uid = (req: Request) => req.auth!.userId;
const entryId = (req: Request) => valid<{ entryId: string }>(req, 'params').entryId;

export async function getDay(req: Request, res: Response) {
  res.json({ data: await analytics.dailySummary(uid(req), valid<{ date: string }>(req, 'query').date) });
}

export async function getRange(req: Request, res: Response) {
  const { from, to } = valid<{ from: string; to: string }>(req, 'query');
  res.json({ data: await diary.entriesForRange(uid(req), from, to) });
}

export async function create(req: Request, res: Response) {
  const { entry, created } = await diary.createEntry(uid(req), valid<DiaryEntryCreateInput>(req, 'body'));
  res.status(created ? 201 : 200).json({ data: entry });
}

export async function update(req: Request, res: Response) {
  res.json({ data: await diary.updateEntry(uid(req), entryId(req), valid<DiaryEntryUpdateInput>(req, 'body')) });
}

export async function remove(req: Request, res: Response) {
  res.json({ data: await diary.deleteEntry(uid(req), entryId(req)) });
}

export async function restore(req: Request, res: Response) {
  res.json({ data: await diary.restoreEntry(uid(req), entryId(req)) });
}

export async function duplicate(req: Request, res: Response) {
  const body = valid<{ date?: string; meal?: Meal; clientRequestId: string }>(req, 'body');
  const { entry, created } = await diary.duplicateEntry(uid(req), entryId(req), body);
  res.status(created ? 201 : 200).json({ data: entry });
}

export async function copyDay(req: Request, res: Response) {
  const result = await diary.copyDay(uid(req), valid<CopyDayInput>(req, 'body'));
  res.status(result.created > 0 ? 201 : 200).json({ data: result });
}
