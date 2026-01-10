const express = require('express');
const reviewController = require('../controllers/reviewsController');
const authController = require('../controllers/authController');

const router = express.Router({ mergeParams: true });

// ======================
// PUBLIC ROUTES
// ======================

// ALIAS ROUTES (Public) - Put these FIRST
router.get(
  '/recent',
  reviewController.aliasRecentReviews,
  reviewController.getAllReviews,
);
router.get(
  '/top-rated',
  reviewController.aliasTopRatedReviews,
  reviewController.getAllReviews,
);

// STATS ROUTES (Public)
router.get('/stats/summary', reviewController.getReviewStats);
router.get(
  '/stats/property/:propertyId',
  reviewController.getPropertyReviewStats,
);

// ======================
// GENERAL CRUD ROUTES (Put LAST)
// ======================

// BASIC CRUD
router
  .route('/')
  .get(reviewController.getAllReviews)
  .post(authController.protect, reviewController.createReview);

router
  .route('/:id')
  .get(reviewController.getReview)
  .patch(authController.protect, reviewController.updateReview)
  .delete(authController.protect, reviewController.deleteReview);

module.exports = router;
