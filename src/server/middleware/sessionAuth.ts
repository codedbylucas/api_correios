import { NextFunction, Request, Response } from 'express';
import { findSession } from '../services/userService.js';
import { sendApiError } from '../utils/apiError.js';

export async function sessionAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = await findSession(req.cookies?.cronos_session);
    if (auth) {
      res.locals.user = auth.user;
      res.locals.session = auth.session;
    }
    next();
  } catch (error) {
    sendApiError(res, error);
  }
}
