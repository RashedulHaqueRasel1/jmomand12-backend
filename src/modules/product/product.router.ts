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

router.get('/', productController.getAllProducts);
router.get('/all', productController.getAllProducts);
router.get('/inventory-monitoring', auth(USER_ROLE.ADMIN), productController.getInventoryMonitoring);
router.get('/:id', productController.getProductDetails);
router.patch(
  '/:id',
  upload.array('images', 5),
  auth(USER_ROLE.ADMIN),
  productController.updateProduct,
);
router.put(
  '/update/:id',
  upload.array('images', 5),
  auth(USER_ROLE.ADMIN),
  productController.updateProduct,
);
router.delete('/:id', auth(USER_ROLE.ADMIN), productController.deleteProduct);

const productRouter = router;
export default productRouter;
