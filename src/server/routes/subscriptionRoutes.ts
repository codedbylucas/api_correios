import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import * as subscriptionController from '../controllers/subscriptionController.js';

const router = Router();

router.use(requireAuth);

router.get('/', subscriptionController.listSubscriptions);
router.post('/', subscriptionController.upsertSubscriptions);
router.delete('/', subscriptionController.deleteSubscriptions);

export default router;

