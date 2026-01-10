const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// ======================
// AUTHENTICATION ROUTES
// ======================

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/logout', authController.logout);

// ======================
// PASSWORD MANAGEMENT ROUTES
// ======================

router.post('/forgot-password', authController.forgotPassword);
router.patch('/reset-password/:token', authController.resetPassword);
router.patch(
  '/update-password',
  authController.protect,
  authController.updatePassword,
);

module.exports = router;
