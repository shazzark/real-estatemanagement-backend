const express = require('express');
const bookingController = require('../controllers/bookingController');
const authController = require('../controllers/authController');

const router = express.Router();

// ======================
// PUBLIC ROUTES
// ======================

// Check availability (public)
router.post('/check-availability', bookingController.checkAvailability);

// ======================
// PROTECTED ROUTES
// ======================

router.use(authController.protect);

// MAIN CRUD ROUTES
router
  .route('/')
  .get(bookingController.getAllBookings)
  .post(bookingController.createBooking);

router
  .route('/:id')
  .get(bookingController.getBooking)
  .patch(bookingController.updateBooking);

// ADMIN DELETE
router.delete(
  '/:id',
  authController.restrictTo('admin'),
  bookingController.deleteBooking,
);

// BOOKING ACTIONS

router.patch('/:id/cancel', bookingController.cancelBooking);

router.patch(
  '/:id/confirm',
  authController.restrictTo('agent', 'admin', 'user'),
  bookingController.confirmBooking,
);
router.patch(
  '/:id/reject',
  authController.restrictTo('agent', 'admin'),
  bookingController.agentRejectBooking,
);
router.patch(
  '/:id/confirm-payment',
  authController.restrictTo('agent', 'admin'),
  bookingController.confirmPayment,
);

// SCHEDULING
router.get('/agent/schedule', bookingController.getAgentSchedule);
router.get('/agent/:agentId/schedule', bookingController.getAgentSchedule);

// STATISTICS
router.get(
  '/stats/summary',
  authController.restrictTo('admin', 'agent'),
  bookingController.getBookingStats,
);

router.get(
  '/stats/monthly/:year?',
  authController.restrictTo('admin', 'agent'),
  bookingController.getMonthlyBookings,
);

module.exports = router;
