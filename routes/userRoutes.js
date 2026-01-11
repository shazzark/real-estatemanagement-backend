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
// router.patch('/verifyEmail/:token', authController.verifyEmail);
// Add these routes right after your other routes
router.get('/debug-env', (req, res) => {
  res.json({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE: process.env.DATABASE ? 'Set' : 'Not set',
    JWT_SECRET: process.env.JWT_SECRET ? 'Set' : 'Not set',
    headers: req.headers,
    cookies: req.cookies,
    origin: req.headers.origin,
  });
});

router.post('/set-test-cookie', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('testCookie', 'testValue123', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    message: 'Test cookie set',
    cookieSettings: {
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      NODE_ENV: process.env.NODE_ENV,
    },
  });
});

router.get('/check-cookie', (req, res) => {
  res.json({
    jwtCookie: req.cookies.jwt ? 'Present' : 'Missing',
    testCookie: req.cookies.testCookie ? 'Present' : 'Missing',
    allCookies: req.cookies,
  });
});

// PROTECTED ROUTES
router.use(authController.protect);

router.get('/me', userController.getMe);
router.patch('/updateMe', userController.updateMe);
router.patch('/updateMyPassword', authController.updatePassword);
router.delete('/deleteMe', userController.deleteMe);

// Optional: send verification email again
router.post('/sendVerificationEmail', authController.sendVerificationEmail);

module.exports = router;
