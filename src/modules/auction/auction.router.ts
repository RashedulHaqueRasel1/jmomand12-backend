import { Router } from 'express';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../user/user.constant';
import auctionController from './auction.controller';

const router = Router();

router.post('/', auth(USER_ROLE.ADMIN), auctionController.createAuction);
router.get('/', auctionController.getAllAuctions);
router.get('/all', auctionController.getAllAuctions);
router.post('/process-due', auth(USER_ROLE.ADMIN), auctionController.closeDueAuctions);
router.post('/close-due', auth(USER_ROLE.ADMIN), auctionController.closeDueAuctions);
router.get('/:id', auctionController.getAuctionDetails);
router.get('/:id/bids', auth(USER_ROLE.ADMIN), auctionController.getAuctionBids);
router.post('/:id/bids', auth(USER_ROLE.USER, USER_ROLE.ADMIN), auctionController.placeBid);
router.post('/:id/bid', auth(USER_ROLE.USER, USER_ROLE.ADMIN), auctionController.placeBid);
router.post('/:id/close', auth(USER_ROLE.ADMIN), auctionController.closeAuction);

const auctionRouter = router;
export default auctionRouter;
