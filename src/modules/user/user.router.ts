import { Router } from 'express';
import userController from './user.controller';
import validateRequest from '../../middleware/validateRequest';
import { userValidation } from './user.validation';
import auth from '../../middleware/auth';
import { USER_ROLE } from './user.constant';
import { upload } from '../../middleware/multer.middleware';

const router = Router();

router.post(
  '/register',
  validateRequest(userValidation.userValidationSchema),
  userController.registerUser,
);
router.post('/', validateRequest(userValidation.userValidationSchema), userController.registerUser);

router.post(
  '/email-verifications',
  auth(USER_ROLE.ADMIN, USER_ROLE.USER),
  userController.verifyEmail,
);
router.post(
  '/email-verifications/resend',
  auth(USER_ROLE.ADMIN, USER_ROLE.USER),
  userController.resendOtpCode,
);
router.post('/verify-email', auth(USER_ROLE.ADMIN, USER_ROLE.USER), userController.verifyEmail);
router.post('/resend-otp', auth(USER_ROLE.ADMIN, USER_ROLE.USER), userController.resendOtpCode);
router.get('/', auth(USER_ROLE.ADMIN), userController.getAllUsers);
router.get('/all-users', auth(USER_ROLE.ADMIN), userController.getAllUsers);
router.get('/me', auth(USER_ROLE.ADMIN, USER_ROLE.USER), userController.getMyProfile);
router.get('/my-profile', auth(USER_ROLE.ADMIN, USER_ROLE.USER), userController.getMyProfile);

router.patch(
  '/me',
  upload.single('image'),
  auth(USER_ROLE.ADMIN, USER_ROLE.USER),
  userController.updateUserProfile,
);
router.put(
  '/update-profile',
  upload.single('image'),
  auth(USER_ROLE.ADMIN, USER_ROLE.USER),
  userController.updateUserProfile,
);

router.get('/admin-id', auth(USER_ROLE.ADMIN, USER_ROLE.USER), userController.getAdminId);
router.get('/admin_id', auth(USER_ROLE.ADMIN, USER_ROLE.USER), userController.getAdminId);
router.get('/:userId', auth(USER_ROLE.ADMIN), userController.getUserDetails);
router.patch('/:id/suspension', auth(USER_ROLE.ADMIN), userController.suspendUser);
router.put('/suspend/:id', auth(USER_ROLE.ADMIN), userController.suspendUser);
router.patch('/:id/block', auth(USER_ROLE.ADMIN), userController.blockUser);
router.put('/block/:id', auth(USER_ROLE.ADMIN), userController.blockUser);

const userRouter = router;
export default userRouter;
