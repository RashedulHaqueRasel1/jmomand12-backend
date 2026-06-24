import { Router } from 'express';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../user/user.constant';
import invoiceController from './invoice.controller';

const router = Router();

router.get('/me', auth(USER_ROLE.USER, USER_ROLE.ADMIN), invoiceController.getMyInvoices);
router.get('/my', auth(USER_ROLE.USER, USER_ROLE.ADMIN), invoiceController.getMyInvoices);
router.get('/', auth(USER_ROLE.ADMIN), invoiceController.getAllInvoices);
router.get('/all', auth(USER_ROLE.ADMIN), invoiceController.getAllInvoices);
router.post('/verify-pickup', auth(USER_ROLE.ADMIN), invoiceController.verifyPickupToken);

const invoiceRouter = router;
export default invoiceRouter;
