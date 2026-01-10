const express = require('express');
const paymentController = require('../controllers/paymentController');
const authController = require('../controllers/authController');

const router = express.Router();

router.post(
  '/webhook/paystack',
  express.raw({ type: 'application/json' }),
  paymentController.paystackWebhook,
);

router.use(authController.protect);

// User initializes payment
router.post('/initialize/:bookingId', paymentController.initializePayment);
router.get('/verify/:reference', paymentController.verifyPayment);

module.exports = router;
