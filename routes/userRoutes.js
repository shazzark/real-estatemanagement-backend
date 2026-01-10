const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const router = express.Router();

// ======================
// PUBLIC ROUTES
// ======================

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);
router.patch('/verifyEmail/:token', authController.verifyEmail);
// router.patch(
//   '/updateMyPassword',
//   authController.protect,
//   authController.updatePassword,
// );

// ======================
// PROTECTED ROUTES (All routes after this middleware are protected)
// ======================

router.use(authController.protect);

// CURRENT USER OPERATIONS
router.get('/me', userController.getMe);
router.patch('/updateMe', userController.updateMe);
router.patch('/updateMyPassword', authController.updatePassword);
router.delete('/deleteMe', userController.deleteMe);

// Email verification routes
router.post('/sendVerificationEmail', authController.sendVerificationEmail);

router
  .route('/')
  .get(userController.getAllUsers)
  .post(userController.createUser);
router
  .route('/:id')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;
