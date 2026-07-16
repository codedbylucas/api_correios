import { WoncaClient } from '../clients/woncaClient.js';
import { CorreiosScraperClient } from '../clients/correiosScraperClient.js';
import { createCaptchaSolver } from '../scraper/captchaSolver.js';
import { TrackingService, type TrackingClient } from './trackingService.js';

const WONCA_URL = process.env.WONCA_URL || 'https://api-labs.wonca.com.br/wonca.labs.v1.LabsService/Track';
const WONCA_AUTH = process.env.WONCA_AUTH || '';
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '15000', 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '1', 10);
const SIMULATION_MODE = process.env.SIMULATION_MODE === 'true';
const TRACKING_PROVIDER = (process.env.TRACKING_PROVIDER || 'wonca').toLowerCase();
const SCRAPER_MAX_CAPTCHA_RETRIES = parseInt(process.env.SCRAPER_MAX_CAPTCHA_RETRIES || '3', 10);
const SCRAPER_REQUEST_DELAY_MS = parseInt(process.env.SCRAPER_REQUEST_DELAY_MS || '1500', 10);

function createTrackingClient(): TrackingClient {
  if (TRACKING_PROVIDER === 'scraper') {
    return new CorreiosScraperClient(createCaptchaSolver(), SCRAPER_MAX_CAPTCHA_RETRIES, SCRAPER_REQUEST_DELAY_MS);
  }
  return new WoncaClient(WONCA_URL, WONCA_AUTH, TIMEOUT_MS);
}

export const trackingService = new TrackingService(createTrackingClient(), CONCURRENCY, SIMULATION_MODE);
