const express = require('express');
const propertyController = require('../controllers/propertyController');
const authController = require('../controllers/authController');
const upload = require('../utils/multer');

// We'll create this next

const router = express.Router();

// ======================
// PUBLIC ROUTES
// ======================

// ALIASED ROUTES - Grouped logically
// router
//   .route('/featured/family-homes')
//   .get(
//     propertyController.aliasFamilyHomes,
//     propertyController.getAllProperties,
//   );

// router
//   .route('/featured/luxury')
//   .get(
//     propertyController.aliasLuxuryProperties,
//     propertyController.getAllProperties,
//   );

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

// router
//   .route('/nearby-properties')
//   .get(
//     propertyController.aliasNearbyProperties,
//     propertyController.getAllProperties,
//   );

// router
//   .route('/new-listings') // Fixed: kebab-case consistency
//   .get(
//     propertyController.aliasNewListings,
//     propertyController.getAllProperties,
//   );

router
  .route('/city/:cityName')
  .get(
    propertyController.aliasPropertiesByCity,
    propertyController.getAllProperties,
  );

// STATISTICS ROUTES - Better organized
router.route('/stats/summary').get(propertyController.getPropertyStats);

router.route('/stats/cities').get(propertyController.getPropertyStatsByCity);

router.route('/stats/top-cities').get(propertyController.getTopCities);

router.route('/stats/top-agents').get(propertyController.getTopAgents);

router.route('/stats/yearly/:year').get(propertyController.getYearlyListings);

// ======================
// PROTECTED ROUTES (Require Authentication)
// ======================

// Apply authentication to all following routes
// router.use(authController.protect);

// ADMIN/MANAGEMENT STATS
router.route('/stats/monthly').get(
  // authController.restrictTo('admin', 'agent'),
  propertyController.getMonthlyListing,
);

// MAIN CRUD OPERATIONS
router.route('/').get(propertyController.getAllProperties).post(
  authController.protect,
  authController.restrictTo('admin', 'agent'),
  upload.array('images', 5),
  // Add validation middleware here later
  propertyController.createProperty,
);

router
  .route('/:id')
  .get(propertyController.getProperty)
  .patch(
    authController.protect,
    authController.restrictTo('admin', 'agent'),
    // Add ownership check middleware
    propertyController.updateProperty,
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin', 'agent'),
    propertyController.deleteProperty,
  );

module.exports = router;
