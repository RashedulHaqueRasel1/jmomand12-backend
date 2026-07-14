import { Router } from 'express';
import auctionProductController from './AuctionProduct.controller';

const router = Router();

router.get('/details/:auctionProductId', auctionProductController.getSingleAuctionProduct);
router.get('/:auctionId', auctionProductController.getProductsByAuctionId);

const auctionProductRouter = router;
export default auctionProductRouter;
