import { Router } from 'express';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../user/user.constant';
import pickupController from './pickup.controller';

const router = Router();

router.post('/slots', auth(USER_ROLE.ADMIN), pickupController.createSlot);
router.get('/slots', auth(USER_ROLE.USER, USER_ROLE.ADMIN), pickupController.getAvailableSlots);
router.get('/slots/all', auth(USER_ROLE.ADMIN), pickupController.getAllSlots);
router.get('/ready-invoices', auth(USER_ROLE.USER, USER_ROLE.ADMIN), pickupController.getMyReadyInvoices);
router.post('/', auth(USER_ROLE.USER, USER_ROLE.ADMIN), pickupController.schedulePickup);
router.post('/schedule', auth(USER_ROLE.USER, USER_ROLE.ADMIN), pickupController.schedulePickup);
router.get('/me', auth(USER_ROLE.USER, USER_ROLE.ADMIN), pickupController.getMyAppointments);
router.get('/my-appointments', auth(USER_ROLE.USER, USER_ROLE.ADMIN), pickupController.getMyAppointments);
router.get('/', auth(USER_ROLE.ADMIN), pickupController.getAllAppointments);
router.get('/appointments', auth(USER_ROLE.ADMIN), pickupController.getAllAppointments);
router.post('/complete', auth(USER_ROLE.ADMIN), pickupController.completePickup);

const pickupRouter = router;
export default pickupRouter;
