import { Router } from 'express';
import { body } from 'express-validator';
import { TrackingController } from '../controllers/trackingController.js';
import { TrackingService } from '../services/trackingService.js';
import { WoncaClient } from '../clients/woncaClient.js';

const router = Router();

// Configuration from environment
const WONCA_URL = process.env.WONCA_URL || 'https://api-labs.wonca.com.br/wonca.labs.v1.LabsService/Track';
const WONCA_AUTH = process.env.WONCA_AUTH || 'Apikey h_pGYWPsNoUGC2OHJt0ZOZEZFPvYlqnYO6P-RTzUTr0';
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '15000', 10);
const MAX_CODES = parseInt(process.env.MAX_CODES || '200', 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '1', 10);
// Default to false if not explicitly 'true'
const SIMULATION_MODE = process.env.SIMULATION_MODE === 'true';

if (SIMULATION_MODE) {
  console.log('⚠️ Running in SIMULATION MODE. Real API calls to Wonca are disabled.');
} else {
  console.log(`🚀 Running in REAL MODE. Target URL: ${WONCA_URL}`);
}

// Dependency Injection
const woncaClient = new WoncaClient(WONCA_URL, WONCA_AUTH, TIMEOUT_MS);
const trackingService = new TrackingService(woncaClient, CONCURRENCY, SIMULATION_MODE);
const trackingController = new TrackingController(trackingService);

router.post(
  '/batch',
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
