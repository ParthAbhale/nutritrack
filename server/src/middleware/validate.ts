import type { Request, RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { badRequest } from '../utils/errors';

type Part = 'body' | 'query' | 'params';

/**
 * Validates a request part with a Zod schema and stores the parsed value on
 * `req.valid[part]`. Unknown keys are stripped (or rejected by `.strict()` schemas).
 */
export function validate(part: Part, schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[part] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ path: i.path.join('.') || part, message: i.message }));
      return next(badRequest(details[0]?.message ?? 'Invalid request', details));
    }
    req.valid ??= {};
    req.valid[part] = result.data;
    next();
  };
}

export function valid<T>(req: Request, part: Part): T {
  return req.valid[part] as T;
}
