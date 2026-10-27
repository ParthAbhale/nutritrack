/**
 * Request validation schemas live in @nutritrack/shared so the client forms
 * and the server use identical rules. This module adds server-only params.
 */
import { z } from 'zod';
import { objectIdSchema, providerSchema, foodIdSchema, barcodeSchema, dateStringSchema } from '@nutritrack/shared';

export const idParam = (name: string) => z.object({ [name]: objectIdSchema });
export const foodParams = z.object({ provider: providerSchema, foodId: foodIdSchema });
export const barcodeParams = z.object({ barcode: barcodeSchema });
export const optionalRangeQuery = z.object({ from: dateStringSchema, to: dateStringSchema }).refine((v) => v.from <= v.to, { message: '"from" must be on or before "to"' });
export const historyBody = z.object({ query: z.string().trim().min(2).max(100) });
