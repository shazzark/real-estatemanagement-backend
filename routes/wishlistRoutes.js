const express = require('express');
const wishlistController = require('../controllers/wishlistController');
const authController = require('../controllers/authController');

const router = express.Router();

// ======================
// PROTECTED ROUTES (All wishlist operations require authentication)
// ======================

router.use(authController.protect);

// MAIN CRUD ROUTES
router
  .route('/')
  .get(wishlistController.getAllWishlistItems)
  .post(wishlistController.addToWishlist);

router
  .route('/:id')
  .get(wishlistController.getWishlistItem)
  .patch(wishlistController.updateWishlistItem)
  .delete(wishlistController.removeFromWishlist);

// REMOVE by property ID
router.delete('/property/:propertyId', wishlistController.removeFromWishlist);

// WISHLIST UTILITIES
router.get('/check/:propertyId', wishlistController.checkInWishlist);
router.get('/stats/summary', wishlistController.getWishlistStats);
router.get(
  '/popular/properties',
  wishlistController.getPopularWishlistProperties,
);

// SINGLE PROPERTY TOGGLE
router.post('/toggle', wishlistController.toggleWishlist);

// BULK OPERATIONS
router.post('/bulk/add', wishlistController.bulkAddToWishlist);
router.delete('/clear/all', wishlistController.clearWishlist);

module.exports = router;
