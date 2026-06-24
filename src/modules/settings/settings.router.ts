import { Router } from 'express';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../user/user.constant';
import settingsController from './settings.controller';

const router = Router();

router.get('/', auth(USER_ROLE.ADMIN), settingsController.getSettings);
router.patch('/', auth(USER_ROLE.ADMIN), settingsController.updateSettings);
router.get('/public', settingsController.getSettings);

const settingsRouter = router;
export default settingsRouter;
