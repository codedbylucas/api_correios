import { Request, Response } from 'express';
import * as subscriptionService from '../services/subscriptionService.js';
import { sendApiError } from '../utils/apiError.js';

export async function listSubscriptions(_req: Request, res: Response) {
  try {
    const subscriptions = await subscriptionService.listSubscriptions();
    res.json({ subscriptions });
  } catch (error) {
    sendApiError(res, error);
  }
}

export async function upsertSubscriptions(req: Request, res: Response) {
  try {
    const subscriptions = await subscriptionService.upsertSubscriptions(req.body);
    res.json({ subscriptions });
  } catch (error) {
    sendApiError(res, error);
  }
}

export async function deleteSubscriptions(req: Request, res: Response) {
  try {
    const deleted = await subscriptionService.deleteSubscriptions(req.body.ids);
    res.json({ deleted });
  } catch (error) {
    sendApiError(res, error);
  }
}
