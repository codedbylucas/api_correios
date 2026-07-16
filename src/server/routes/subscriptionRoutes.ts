import { Router } from 'express';
import { apiKeyOrSession } from '../middleware/apiKeyOrSession.js';
import * as subscriptionController from '../controllers/subscriptionController.js';

const router = Router();

router.use(apiKeyOrSession);

router.get('/', subscriptionController.listSubscriptions);
router.post('/', subscriptionController.upsertSubscriptions);
router.delete('/', subscriptionController.deleteSubscriptions);

export default router;

