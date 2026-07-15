import { Router } from 'express';
import { requireCronSecret, runChecksAndDeliveries } from '../controllers/cronController.js';

const router = Router();

// Vercel Cron Jobs always invoke via GET; POST is kept for manual/external triggers.
router.get('/run', requireCronSecret, runChecksAndDeliveries);
router.post('/run', requireCronSecret, runChecksAndDeliveries);

export default router;
