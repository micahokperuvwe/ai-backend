import { Router } from 'express';
import { initializePayment, paystackWebhook, mockPaymentSuccess } from '../controllers/payment.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.post('/initialize', protect, initializePayment);
router.post('/webhook', paystackWebhook); // Paystack calls this
router.post('/mock-success', protect, mockPaymentSuccess); // Dev only

export default router;
