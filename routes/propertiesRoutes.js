const express = require('express');
const propertyController = require('../controllers/propertyController');
const authController = require('../controllers/authController');
const upload = require('../utils/multer'); // Make sure this points to your multer setup

const router = express.Router();

// ================= FEATURED & SPECIAL ROUTES =================
router
  .route('/featured/affordable')
  .get(
    propertyController.aliasBudgetFriendlyProperties,
    propertyController.getAllProperties,
  );

router
  .route('/featured-properties')
  .get(
    propertyController.aliasFeaturedProperties,
    propertyController.getAllProperties,
  );

router
  .route('/top-5-cheap')
  .get(
    propertyController.aliasTopProperties,
    propertyController.getAllProperties,
  );

router
  .route('/city/:cityName')
  .get(
    propertyController.aliasPropertiesByCity,
    propertyController.getAllProperties,
  );

// ================= STATISTICS ROUTES =================
router.route('/stats/summary').get(propertyController.getPropertyStats);
router.route('/stats/cities').get(propertyController.getPropertyStatsByCity);
router.route('/stats/top-cities').get(propertyController.getTopCities);
router.route('/stats/top-agents').get(propertyController.getTopAgents);
router.route('/stats/yearly/:year').get(propertyController.getYearlyListings);
router.route('/stats/monthly').get(
  // authController.restrictTo('admin', 'agent'),
  propertyController.getMonthlyListing,
);

// ================= MAIN CRUD ROUTES =================

// GET all properties
router.route('/').get(propertyController.getAllProperties);

// CREATE new property (with multiple images)
router.route('/').post(
  authController.protect,
  authController.restrictTo('admin', 'agent'),
  upload.array('images', 5), // Handles up to 5 images
  propertyController.createProperty,
);

// GET / PATCH / DELETE individual property
router
  .route('/:id')
  .get(propertyController.getProperty)
  .patch(
    authController.protect,
    authController.restrictTo('admin', 'agent'),
    upload.array('images', 5), // Optional: allow updating images
    propertyController.updateProperty,
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin', 'agent'),
    propertyController.deleteProperty,
  );

module.exports = router;
