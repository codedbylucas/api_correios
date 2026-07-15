import { NextFunction, Request, Response } from 'express';
import { ApiError, sendApiError } from '../utils/apiError.js';

export function requireAuth(_req: Request, res: Response, next: NextFunction) {
  if (!res.locals.user) {
    return sendApiError(res, new ApiError('unauthenticated', 'Authentication required.'));
  }
  return next();
}
