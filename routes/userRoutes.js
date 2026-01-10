const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const router = express.Router();

// PUBLIC ROUTES
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);
router.patch('/verifyEmail/:token', authController.verifyEmail);

// PROTECTED ROUTES
router.use(authController.protect);

router.get('/me', userController.getMe);
router.patch('/updateMe', userController.updateMe);
router.patch('/updateMyPassword', authController.updatePassword);
router.delete('/deleteMe', userController.deleteMe);

// Optional: send verification email again
router.post('/sendVerificationEmail', authController.sendVerificationEmail);

module.exports = router;
