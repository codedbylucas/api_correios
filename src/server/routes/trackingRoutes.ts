import { Router } from 'express';
import { body } from 'express-validator';
import { TrackingController } from '../controllers/trackingController.js';
import { trackingService } from '../services/trackingServiceInstance.js';
import { apiKeyOrSession } from '../middleware/apiKeyOrSession.js';

const router = Router();

const MAX_CODES = parseInt(process.env.MAX_CODES || '200', 10);

const trackingController = new TrackingController(trackingService);

router.post(
  '/batch',
  apiKeyOrSession,
  [
    body('codes')
      .exists().withMessage('codes is required')
      .isArray({ min: 1, max: MAX_CODES }).withMessage(`codes must be an array with 1 to ${MAX_CODES} items`),
    body('codes.*')
      .isString().notEmpty().withMessage('Each code must be a non-empty string'),
  ],
  trackingController.trackBatch
);

// Coleta assistida (ver utils/importarRespostaSite.ts): mesmo formato de saida do /batch com varios codigos
router.post(
  '/import',
  apiKeyOrSession,
  [body('text').isString().isLength({ min: 2, max: 2_000_000 }).withMessage('text must be a string (the JSON pasted from the site)')],
  trackingController.importar
);

export default router;
