const express = require('express');
const notificationController = require('../controllers/notificationController');
const authController = require('../controllers/authController');

const router = express.Router();

// ======================
// PROTECTED ROUTES (All notifications require authentication)
// ======================

router.use(authController.protect);

// MAIN CRUD ROUTES
router
  .route('/')
  .get(notificationController.getAllNotifications)
  .post(notificationController.createNotification);

router
  .route('/:id')
  .get(notificationController.getNotification)
  .patch(notificationController.updateNotification)
  .delete(notificationController.deleteNotification);

// NOTIFICATION ACTIONS
router.patch('/:id/read', notificationController.markAsRead);
router.patch('/mark-all-read', notificationController.markAllAsRead);
router.delete('/delete-read', notificationController.deleteAllRead);

// NOTIFICATION UTILITIES
router.get('/stats/count', notificationController.getUnreadCount);
router.get('/stats/summary', notificationController.getNotificationStats);

module.exports = router;
