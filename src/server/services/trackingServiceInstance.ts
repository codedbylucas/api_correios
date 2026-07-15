import { WoncaClient } from '../clients/woncaClient.js';
import { TrackingService } from './trackingService.js';

const WONCA_URL = process.env.WONCA_URL || 'https://api-labs.wonca.com.br/wonca.labs.v1.LabsService/Track';
const WONCA_AUTH = process.env.WONCA_AUTH || '';
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || '15000', 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '1', 10);
const SIMULATION_MODE = process.env.SIMULATION_MODE === 'true';

const woncaClient = new WoncaClient(WONCA_URL, WONCA_AUTH, TIMEOUT_MS);

export const trackingService = new TrackingService(woncaClient, CONCURRENCY, SIMULATION_MODE);
