import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import * as webhookAdminController from '../controllers/webhookAdminController.js';

const router = Router();

router.use(requireAuth);

router.post('/endpoints', webhookAdminController.createEndpoint);
router.get('/endpoints', webhookAdminController.listEndpoints);
router.get('/endpoints/:id', webhookAdminController.getEndpoint);
router.patch('/endpoints/:id', webhookAdminController.updateEndpoint);
router.post('/endpoints/:id/test', webhookAdminController.testEndpoint);
router.patch('/endpoints/:id/active', webhookAdminController.setEndpointActive);

router.post('/profiles', webhookAdminController.createProfile);
router.get('/profiles', webhookAdminController.listProfiles);
router.get('/profiles/:id', webhookAdminController.getProfile);

router.get('/keys', webhookAdminController.listKeys);
router.post('/keys', webhookAdminController.createKey);
router.delete('/keys/:id', webhookAdminController.revokeKey);

router.get('/deliveries', webhookAdminController.getDeliveries);
router.post('/deliveries/:id/redeliver', webhookAdminController.redeliverDelivery);

export default router;

