import { Request, Response } from 'express';
import { constantTimeEquals } from '../utils/signing.js';
import { runDueChecks } from '../services/checkerService.js';
import { processDueDeliveries } from '../services/webhookDeliveryService.js';

export function requireCronSecret(req: Request, res: Response, next: () => void) {
  const secret = process.env.CRON_SECRET;
  const provided = (req.header('authorization') || '').replace(/^Bearer\s+/i, '');

  if (!secret || !provided || !constantTimeEquals(provided, secret)) {
    return res.status(401).json({ code: 'unauthenticated', message: 'Invalid or missing cron secret.' });
  }

  next();
}

export async function runChecksAndDeliveries(_req: Request, res: Response) {
  try {
    const checks = await runDueChecks();
    const deliveries = await processDueDeliveries();
    res.json({ checks, deliveries });
  } catch (error: any) {
    console.error('[cronController] run failed:', error);
    res.status(500).json({ code: 'internal', message: error.message || 'Internal server error' });
  }
}
