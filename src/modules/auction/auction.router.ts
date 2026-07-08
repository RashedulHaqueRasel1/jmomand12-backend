import { Router } from 'express';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../user/user.constant';
import auctionController from './auction.controller';

const router = Router();

router.post('/', auth(USER_ROLE.ADMIN), auctionController.createAuction);
router.get('/', auctionController.getAllAuctions);
// router.get('/all', auctionController.getAllAuctions);
router.get('/active', auctionController.getActiveAuction);
router.get('/upcoming', auctionController.getUpcomingAuctions);
router.get('/:id', auctionController.getAuctionDetails);

const auctionRouter = router;
export default auctionRouter;
