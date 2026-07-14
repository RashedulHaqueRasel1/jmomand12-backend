import { Router } from 'express';
import cartController from './cart.controller';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../user/user.constant';

const router = Router();

router.post('/', auth(USER_ROLE.USER), cartController.addToCartOrWishlist);
router.get('/cart', auth(USER_ROLE.USER), cartController.getMyCartItems);
router.get('/wishlist', auth(USER_ROLE.USER), cartController.getMyWishListItems);

const cartRouter = router;
export default cartRouter;
