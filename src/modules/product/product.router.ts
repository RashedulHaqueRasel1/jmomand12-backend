import { Router } from 'express';
import productController from './product.controller';
import { upload } from '../../middleware/multer.middleware';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../user/user.constant';

const router = Router();

router.post(
  '/',
  upload.array('images', 5),
  auth(USER_ROLE.ADMIN),
  productController.creteNewProduct,
);

router.get('/all', productController.getAllProducts);
router.get('/:id', productController.getProductDetails);

const productRouter = router;
export default productRouter;
