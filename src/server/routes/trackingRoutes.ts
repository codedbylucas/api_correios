import { Router } from 'express';
import { body } from 'express-validator';
import { TrackingController } from '../controllers/trackingController.js';
import { trackingService } from '../services/trackingServiceInstance.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';

const router = Router();

const MAX_CODES = parseInt(process.env.MAX_CODES || '200', 10);

const trackingController = new TrackingController(trackingService);

router.post(
  '/batch',
  apiKeyAuth,
  [
    body('codes')
      .exists().withMessage('codes is required')
      .isArray({ min: 1, max: MAX_CODES }).withMessage(`codes must be an array with 1 to ${MAX_CODES} items`),
    body('codes.*')
      .isString().notEmpty().withMessage('Each code must be a non-empty string'),
  ],
  trackingController.trackBatch
);

export default router;
