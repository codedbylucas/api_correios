import { CorreiosScraperClient } from '../clients/correiosScraperClient.js';
import { RastreamentoServiceClient } from '../clients/rastreamentoServiceClient.js';
import { CorreiosApiClient } from '../clients/correiosApiClient.js';
import { createCaptchaSolver } from '../scraper/captchaSolver.js';
import { TrackingService, type TrackingClient } from './trackingService.js';

const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '15000', 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '1', 10);
const SIMULATION_MODE = process.env.SIMULATION_MODE === 'true';
const TRACKING_PROVIDER = (process.env.TRACKING_PROVIDER || 'crnn').toLowerCase();
const SCRAPER_MAX_CAPTCHA_RETRIES = parseInt(process.env.SCRAPER_MAX_CAPTCHA_RETRIES || '3', 10);
const SCRAPER_REQUEST_DELAY_MS = parseInt(process.env.SCRAPER_REQUEST_DELAY_MS || '1500', 10);
const RASTREAMENTO_SERVICE_URL = process.env.RASTREAMENTO_SERVICE_URL || 'http://localhost:8003';
const RASTREAMENTO_SERVICE_TOKEN = process.env.RASTREAMENTO_SERVICE_TOKEN || '';

function createTrackingClient(): TrackingClient {
  if (TRACKING_PROVIDER === 'correios-api') {
    // API oficial dos Correios (CWS). Faltando credencial, o construtor falha na subida com a lista do que definir.
    return new CorreiosApiClient({
      baseUrl: process.env.CORREIOS_API_URL || 'https://api.correios.com.br',
      user: process.env.CORREIOS_API_USER || '',
      accessCode: process.env.CORREIOS_API_ACCESS_CODE || '',
      postageCard: process.env.CORREIOS_API_POSTAGE_CARD || undefined,
      timeoutMs: TIMEOUT_MS,
      batchSize: parseInt(process.env.CORREIOS_API_BATCH_SIZE || '20', 10),
    });
  }
  if (TRACKING_PROVIDER === 'scraper') {
    return new CorreiosScraperClient(createCaptchaSolver(), SCRAPER_MAX_CAPTCHA_RETRIES, SCRAPER_REQUEST_DELAY_MS);
  }
  return new RastreamentoServiceClient(RASTREAMENTO_SERVICE_URL, RASTREAMENTO_SERVICE_TOKEN, TIMEOUT_MS);
}

export const trackingService = new TrackingService(createTrackingClient(), CONCURRENCY, SIMULATION_MODE);
