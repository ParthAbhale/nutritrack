import { Router } from 'express';
import {
  changePasswordSchema, copyDaySchema, customFoodSchema, dateQuerySchema, deleteAccountSchema, diaryEntryCreateSchema,
  diaryEntryUpdateSchema, duplicateEntrySchema, favoriteCreateSchema, forgotPasswordSchema, goalInputSchema, goalUpdateSchema,
  hydrationCreateSchema, hydrationUpdateSchema, loginSchema, milestoneSchema, monthQuerySchema, notificationUpdateSchema,
  paginationSchema, profileUpdateSchema, rangeQuerySchema, recipeSchema, recipeUpdateSchema, registerSchema, resetPasswordSchema,
  savedMealLogSchema, savedMealSchema, savedMealUpdateSchema, searchQuerySchema, verifyEmailSchema, weightCreateSchema,
  weightQuerySchema, weightUpdateSchema,
} from '@nutritrack/shared';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { apiLimiter, authLimiter, emailLimiter, exportLimiter, loginLimiter, searchLimiter } from '../middleware/rateLimit';
import { barcodeParams, foodParams, historyBody, idParam } from '../validators';
import * as auth from '../controllers/authController';
import * as users from '../controllers/userController';
import * as foods from '../controllers/foodController';
import * as diary from '../controllers/diaryController';
import * as analytics from '../controllers/analyticsController';
import * as r from '../controllers/resourceController';
import { emailDeliveryConfigured } from '../services/emailService';
import { allProviders, primaryProviderId } from '../providers/nutrition/registry';
import type { ServerCapabilities } from '@nutritrack/shared';

export function apiRouter(): Router {
  const api = Router();
  api.use(csrfProtection);

  /* public */
  api.get('/capabilities', (_req, res) => {
    const data: ServerCapabilities = {
      emailDelivery: emailDeliveryConfigured(),
      providers: allProviders().filter((p) => p.isConfigured()).map((p) => ({ id: p.id, label: p.label, configured: true, barcode: p.supportsBarcode })),
      primaryProvider: primaryProviderId(),
    };
    res.json({ data });
  });

  /* auth */
  const a = Router();
  a.get('/csrf', auth.csrf);
  a.post('/register', authLimiter, validate('body', registerSchema), auth.register);
  a.post('/login', loginLimiter, validate('body', loginSchema), auth.login);
  a.post('/logout', auth.logout);
  a.post('/refresh', authLimiter, auth.refresh);
  a.post('/forgot-password', authLimiter, emailLimiter, validate('body', forgotPasswordSchema), auth.forgotPassword);
  a.post('/reset-password', authLimiter, validate('body', resetPasswordSchema), auth.resetPassword);
  a.post('/verify-email', authLimiter, validate('body', verifyEmailSchema), auth.verifyEmail);
  a.get('/me', requireAuth, auth.me);
  a.post('/resend-verification', requireAuth, emailLimiter, auth.resendVerification);
  a.post('/change-password', requireAuth, authLimiter, validate('body', changePasswordSchema), auth.changePassword);
  api.use('/auth', a);

  /* everything below requires authentication */
  const p = Router();
  p.use(requireAuth, apiLimiter);

  p.get('/users/me', users.getMe);
  p.patch('/users/me', validate('body', profileUpdateSchema), users.updateMe);
  p.get('/users/me/sessions', users.listSessions);
  p.delete('/users/me/sessions/:sessionId', validate('params', idParam('sessionId')), users.revokeSession);
  p.get('/users/me/export', exportLimiter, users.exportData);
  p.delete('/users/me', validate('body', deleteAccountSchema), users.deleteMe);
  p.post('/users/me/milestones', validate('body', milestoneSchema), users.addMilestone);
  p.delete('/users/me/milestones/:milestoneId', validate('params', idParam('milestoneId')), users.removeMilestone);

  p.get('/goals', r.currentGoal);
  p.get('/goals/history', r.goalHistory);
  p.post('/goals', validate('body', goalInputSchema), r.saveGoal);
  p.patch('/goals/:goalId', validate('params', idParam('goalId')), validate('body', goalUpdateSchema), r.updateGoal);

  p.get('/foods/search', searchLimiter, validate('query', searchQuerySchema), foods.search);
  p.get('/foods/recent', foods.recent);
  p.get('/foods/search-history', foods.history);
  p.post('/foods/search-history', validate('body', historyBody), foods.addHistory);
  p.delete('/foods/search-history', foods.clearHistory);
  p.get('/foods/barcode/:barcode', searchLimiter, validate('params', barcodeParams), foods.barcode);
  p.get('/foods/custom', foods.listCustom);
  p.post('/foods/custom', validate('body', customFoodSchema), foods.createCustom);
  p.patch('/foods/custom/:foodId', validate('params', idParam('foodId')), validate('body', customFoodSchema.partial().strict()), foods.updateCustom);
  p.delete('/foods/custom/:foodId', validate('params', idParam('foodId')), foods.deleteCustom);
  p.get('/foods/:provider/:foodId', searchLimiter, validate('params', foodParams), foods.getFood);

  p.get('/favorites', foods.listFavorites);
  p.post('/favorites', validate('body', favoriteCreateSchema), foods.addFavorite);
  p.delete('/favorites/:favoriteId', validate('params', idParam('favoriteId')), foods.removeFavorite);

  p.get('/diary', validate('query', dateQuerySchema), diary.getDay);
  p.get('/diary/range', validate('query', rangeQuerySchema), diary.getRange);
  p.post('/diary/entries', validate('body', diaryEntryCreateSchema), diary.create);
  p.patch('/diary/entries/:entryId', validate('params', idParam('entryId')), validate('body', diaryEntryUpdateSchema), diary.update);
  p.delete('/diary/entries/:entryId', validate('params', idParam('entryId')), diary.remove);
  p.post('/diary/entries/:entryId/restore', validate('params', idParam('entryId')), diary.restore);
  p.post('/diary/entries/:entryId/duplicate', validate('params', idParam('entryId')), validate('body', duplicateEntrySchema), diary.duplicate);
  p.post('/diary/copy-day', validate('body', copyDaySchema), diary.copyDay);

  p.get('/calendar/month', validate('query', monthQuerySchema), analytics.month);
  p.get('/analytics/daily', validate('query', dateQuerySchema), analytics.daily);
  p.get('/analytics/monthly', validate('query', monthQuerySchema), analytics.month);
  p.get('/analytics/range', validate('query', rangeQuerySchema), analytics.range);
  p.get('/analytics/streak', analytics.streak);
  p.get('/activity', analytics.activity);
  p.get('/exports/diary.csv', exportLimiter, validate('query', rangeQuerySchema), analytics.exportDiaryCsv);

  p.get('/saved-meals', r.listSavedMeals);
  p.post('/saved-meals', validate('body', savedMealSchema), r.createSavedMeal);
  p.patch('/saved-meals/:mealId', validate('params', idParam('mealId')), validate('body', savedMealUpdateSchema), r.updateSavedMeal);
  p.delete('/saved-meals/:mealId', validate('params', idParam('mealId')), r.deleteSavedMeal);
  p.post('/saved-meals/:mealId/log', validate('params', idParam('mealId')), validate('body', savedMealLogSchema), r.logSavedMeal);

  p.get('/recipes', r.listRecipes);
  p.post('/recipes', validate('body', recipeSchema), r.createRecipe);
  p.get('/recipes/:recipeId', validate('params', idParam('recipeId')), r.getRecipe);
  p.patch('/recipes/:recipeId', validate('params', idParam('recipeId')), validate('body', recipeUpdateSchema), r.updateRecipe);
  p.delete('/recipes/:recipeId', validate('params', idParam('recipeId')), r.deleteRecipe);

  p.get('/hydration', validate('query', dateQuerySchema), r.hydrationDay);
  p.get('/hydration/history', validate('query', rangeQuerySchema), r.hydrationHistory);
  p.post('/hydration', validate('body', hydrationCreateSchema), r.addHydration);
  p.patch('/hydration/:logId', validate('params', idParam('logId')), validate('body', hydrationUpdateSchema), r.updateHydration);
  p.delete('/hydration/:logId', validate('params', idParam('logId')), r.deleteHydration);

  p.get('/weight', validate('query', weightQuerySchema), r.listWeights);
  p.post('/weight', validate('body', weightCreateSchema), r.upsertWeight);
  p.patch('/weight/:logId', validate('params', idParam('logId')), validate('body', weightUpdateSchema), r.updateWeight);
  p.delete('/weight/:logId', validate('params', idParam('logId')), r.deleteWeight);

  p.get('/notifications', validate('query', paginationSchema), r.listNotifications);
  p.post('/notifications/read-all', r.markAllNotificationsRead);
  p.patch('/notifications/:notificationId', validate('params', idParam('notificationId')), validate('body', notificationUpdateSchema), r.updateNotification);

  api.use(p);
  return api;
}
