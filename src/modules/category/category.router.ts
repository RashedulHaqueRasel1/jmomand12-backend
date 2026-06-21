import { Router } from 'express';
import categoryController from './category.controller';
import { upload } from '../../middleware/multer.middleware';

const router = Router();

router.post('/', upload.single('image'), categoryController.createNewCategory);
router.get('/all', categoryController.getAllCategories);
router.get('/:id', categoryController.getSingleCategory);
router.put('/update/:id', upload.single('image'), categoryController.updateCategory);
router.put('/toggle/:id', categoryController.toggleDeletedCategory);

const categoryRouter = router;
export default categoryRouter;
