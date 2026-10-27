import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../utils/errors';
import { UpstreamError } from '../utils/http';
import { logger } from '../config/logger';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}`, requestId: req.id } });
};

/** Converts every error into the standard envelope. Never leaks stacks or internal messages. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  void _next;
  if (res.headersSent) return;
  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof UpstreamError) {
    appError = new AppError(503, 'PROVIDER_UNAVAILABLE', 'The nutrition data provider is unavailable. Please try again.');
  } else if (err?.type === 'entity.too.large') {
    appError = new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  } else if (err?.type === 'entity.parse.failed') {
    appError = new AppError(400, 'VALIDATION_ERROR', 'Malformed JSON body');
  } else if (err instanceof mongoose.Error.CastError) {
    appError = new AppError(404, 'NOT_FOUND', 'Resource not found');
  } else if (err instanceof mongoose.Error.ValidationError) {
    appError = new AppError(400, 'VALIDATION_ERROR', 'Invalid data', Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })));
  } else if (err?.code === 11000) {
    appError = new AppError(409, 'CONFLICT', 'This record already exists');
  } else {
    appError = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
  }

  if (appError.status >= 500) logger().error({ err, requestId: req.id, path: req.path }, 'Request failed');
  else logger().debug({ code: appError.code, requestId: req.id, path: req.path }, 'Request rejected');

  res.status(appError.status).json({
    error: { code: appError.code, message: appError.message, details: appError.details, requestId: req.id },
  });
};
