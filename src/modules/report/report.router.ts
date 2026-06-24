import { Router } from 'express';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../user/user.constant';
import reportController from './report.controller';

const router = Router();

router.get('/revenue', auth(USER_ROLE.ADMIN), reportController.getRevenueSummary);
router.get('/auctions', auth(USER_ROLE.ADMIN), reportController.getAuctionSummary);
router.get('/pickups', auth(USER_ROLE.ADMIN), reportController.getPickupSummary);
router.get('/inventory', auth(USER_ROLE.ADMIN), reportController.getInventorySummary);

const reportRouter = router;
export default reportRouter;
