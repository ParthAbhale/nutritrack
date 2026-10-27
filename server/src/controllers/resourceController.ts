import type { Request, Response } from 'express';
import type { GoalInput } from '@nutritrack/shared';
import * as goals from '../services/goalService';
import * as templates from '../services/templateService';
import * as tracking from '../services/trackingService';
import * as notifications from '../services/notificationService';
import { valid } from '../middleware/validate';

const uid = (req: Request) => req.auth!.userId;
const param = (req: Request, name: string) => (valid<Record<string, string>>(req, 'params'))[name]!;

/* goals */
export const currentGoal = async (req: Request, res: Response) => res.json({ data: await goals.currentGoal(uid(req)) });
export const goalHistory = async (req: Request, res: Response) => res.json({ data: await goals.goalHistory(uid(req)) });
export const saveGoal = async (req: Request, res: Response) => res.status(201).json({ data: await goals.saveGoal(uid(req), valid<GoalInput>(req, 'body')) });
export const updateGoal = async (req: Request, res: Response) => res.json({ data: await goals.updateGoal(uid(req), param(req, 'goalId'), valid(req, 'body')) });

/* saved meals */
export const listSavedMeals = async (req: Request, res: Response) => res.json({ data: await templates.listSavedMeals(uid(req)) });
export const createSavedMeal = async (req: Request, res: Response) => res.status(201).json({ data: await templates.createSavedMeal(uid(req), valid(req, 'body')) });
export const updateSavedMeal = async (req: Request, res: Response) => res.json({ data: await templates.updateSavedMeal(uid(req), param(req, 'mealId'), valid(req, 'body')) });
export const deleteSavedMeal = async (req: Request, res: Response) => {
  await templates.deleteSavedMeal(uid(req), param(req, 'mealId'));
  res.status(204).end();
};
export const logSavedMeal = async (req: Request, res: Response) => {
  const result = await templates.logSavedMeal(uid(req), param(req, 'mealId'), valid(req, 'body'));
  res.status(result.created ? 201 : 200).json({ data: result });
};

/* recipes */
export const listRecipes = async (req: Request, res: Response) => res.json({ data: await templates.listRecipes(uid(req)) });
export const getRecipe = async (req: Request, res: Response) => res.json({ data: await templates.getRecipe(uid(req), param(req, 'recipeId')) });
export const createRecipe = async (req: Request, res: Response) => res.status(201).json({ data: await templates.createRecipe(uid(req), valid(req, 'body')) });
export const updateRecipe = async (req: Request, res: Response) => res.json({ data: await templates.updateRecipe(uid(req), param(req, 'recipeId'), valid(req, 'body')) });
export const deleteRecipe = async (req: Request, res: Response) => {
  await templates.deleteRecipe(uid(req), param(req, 'recipeId'));
  res.status(204).end();
};

/* hydration */
export const hydrationDay = async (req: Request, res: Response) => res.json({ data: await tracking.hydrationDay(uid(req), valid<{ date: string }>(req, 'query').date) });
export const hydrationHistory = async (req: Request, res: Response) => {
  const { from, to } = valid<{ from: string; to: string }>(req, 'query');
  res.json({ data: await tracking.hydrationHistory(uid(req), from, to) });
};
export const addHydration = async (req: Request, res: Response) => res.status(201).json({ data: await tracking.addHydration(uid(req), valid(req, 'body')) });
export const updateHydration = async (req: Request, res: Response) => res.json({ data: await tracking.updateHydration(uid(req), param(req, 'logId'), valid<{ amountMl: number }>(req, 'body').amountMl) });
export const deleteHydration = async (req: Request, res: Response) => {
  await tracking.deleteHydration(uid(req), param(req, 'logId'));
  res.status(204).end();
};

/* weight */
export const listWeights = async (req: Request, res: Response) => {
  const { from, to } = valid<{ from?: string; to?: string }>(req, 'query');
  res.json({ data: await tracking.listWeights(uid(req), from, to) });
};
export const upsertWeight = async (req: Request, res: Response) => res.status(201).json({ data: await tracking.upsertWeight(uid(req), valid(req, 'body')) });
export const updateWeight = async (req: Request, res: Response) => res.json({ data: await tracking.updateWeight(uid(req), param(req, 'logId'), valid(req, 'body')) });
export const deleteWeight = async (req: Request, res: Response) => {
  await tracking.deleteWeight(uid(req), param(req, 'logId'));
  res.status(204).end();
};

/* notifications */
export const listNotifications = async (req: Request, res: Response) => {
  const { page, pageSize } = valid<{ page: number; pageSize: number }>(req, 'query');
  const result = await notifications.listNotifications(uid(req), page, pageSize);
  res.json({ data: { items: result.items, unread: result.unread }, meta: result.meta });
};
export const updateNotification = async (req: Request, res: Response) =>
  res.json({ data: await notifications.setRead(uid(req), param(req, 'notificationId'), valid<{ read: boolean }>(req, 'body').read) });
export const markAllNotificationsRead = async (req: Request, res: Response) => {
  await notifications.markAllRead(uid(req));
  res.status(204).end();
};
