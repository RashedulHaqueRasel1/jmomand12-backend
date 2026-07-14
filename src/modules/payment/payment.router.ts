import { Router } from 'express';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../user/user.constant';
import paymentController from './payment.controller';

const router = Router();

// Webhook endpoint - must be first and without authentication
router.post('/webhook', paymentController.handleStripeWebhook);

router.post(
  '/setup-intents',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  paymentController.createSetupIntent,
);
router.get(
  '/setup-intents/:setupIntentId',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  paymentController.getSetupIntentStatus,
);
router.post(
  '/default-payment-method',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  paymentController.saveDefaultPaymentMethod,
);
router.post(
  '/test-default-payment-method',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  paymentController.createTestDefaultPaymentMethod,
);

const paymentRouter = router;
export default paymentRouter;
