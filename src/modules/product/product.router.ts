import { Router } from 'express';
import productController from './product.controller';
import { upload } from '../../middleware/multer.middleware';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../user/user.constant';

const router = Router();

router.post(
  '/',
  upload.fields([
    {
      name: 'images',
      maxCount: 5,
    },
    {
      name: 'categoryImage',
      maxCount: 1,
    },
  ]),
  auth(USER_ROLE.ADMIN),
  productController.creteNewProduct,
);

router.post(
  '/bulk',
  auth(USER_ROLE.ADMIN),
  upload.single('file'),
  productController.productBulkUpload,
);

router.get('/', productController.getAllProducts);
router.get('/browse', productController.browseProducts);
router.get('/categories', productController.getAllCategory);
router.get(
  '/inventory',
  // auth(USER_ROLE.ADMIN, USER_ROLE.USER),
  productController.getInventoryProducts,
);
router.get('/auctions', auth(USER_ROLE.ADMIN), productController.getAuctionProducts);
router.get(
  '/inventory-monitoring',
  auth(USER_ROLE.ADMIN),
  productController.getInventoryMonitoring,
);
router.get('/:id', productController.getProductDetails);
router.patch(
  '/:id',
  upload.array('images', 5),
  auth(USER_ROLE.ADMIN),
  productController.updateProduct,
);
router.delete('/:id', auth(USER_ROLE.ADMIN), productController.deleteProduct);

const productRouter = router;
export default productRouter;
