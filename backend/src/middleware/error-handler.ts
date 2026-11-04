import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/app-error.ts';

export function errorHandler(error: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    next(new Error('Request failed after headers were sent.'));
    return;
  }

  if (error instanceof AppError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  if (error instanceof Error && 'type' in error) {
    if (error.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

    if (error.type === 'entity.too.large') {
      res.status(413).json({ error: 'Request body is too large' });
      return;
    }

    if (error.type === 'charset.unsupported' || error.type === 'encoding.unsupported') {
      res.status(415).json({ error: 'Unsupported request encoding' });
      return;
    }
  }

  res.status(500).json({ error: 'Internal server error' });
}
