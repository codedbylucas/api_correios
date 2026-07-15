import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.post('/login', authController.loginUser);
router.post('/logout', authController.logoutUser);
router.get('/me', authController.me);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetUserPassword);
router.get('/check', requireAuth, authController.me);

export default router;
