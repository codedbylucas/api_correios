import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { apiKeyOrSession } from '../middleware/apiKeyOrSession.js';
import * as webhookAdminController from '../controllers/webhookAdminController.js';

const router = Router();

// Gerenciamento de chaves exige sessão real de login (uma API key não pode mintar outras).
router.get('/keys', requireAuth, webhookAdminController.listKeys);
router.post('/keys', requireAuth, webhookAdminController.createKey);
router.delete('/keys/:id', requireAuth, webhookAdminController.revokeKey);

// Demais rotas aceitam sessão OU API key (uso programático externo).
router.use(apiKeyOrSession);

router.post('/endpoints', webhookAdminController.createEndpoint);
router.get('/endpoints', webhookAdminController.listEndpoints);
router.get('/endpoints/:id', webhookAdminController.getEndpoint);
router.patch('/endpoints/:id', webhookAdminController.updateEndpoint);
router.post('/endpoints/:id/test', webhookAdminController.testEndpoint);
router.patch('/endpoints/:id/active', webhookAdminController.setEndpointActive);

router.post('/profiles', webhookAdminController.createProfile);
router.get('/profiles', webhookAdminController.listProfiles);
router.get('/profiles/:id', webhookAdminController.getProfile);

router.get('/deliveries', webhookAdminController.getDeliveries);
router.post('/deliveries/:id/redeliver', webhookAdminController.redeliverDelivery);

export default router;

