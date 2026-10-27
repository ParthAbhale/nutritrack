import 'express';

declare global {
  namespace Express {
    interface Request {
      id: string;
      auth?: { userId: string; sessionId: string };
      valid: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}

export {};
