import { Router } from 'express';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../user/user.constant';
import paymentController from './payment.controller';

const router = Router();

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
router.post('/setup-intent', auth(USER_ROLE.USER, USER_ROLE.ADMIN), paymentController.createSetupIntent);
router.get(
  '/setup-intent/:setupIntentId',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  paymentController.getSetupIntentStatus,
);
router.post(
  '/default-payment-method',
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  paymentController.saveDefaultPaymentMethod,
);
router.post(
  '/default-method',
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
