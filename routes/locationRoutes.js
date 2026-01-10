const express = require('express');
const LocationController = require('../controllers/locationController');

const router = express.Router();

router
  .route('/')
  .get(LocationController.getAllLocations)
  .post(LocationController.createLocation);

router
  .route('/:id')
  .get(LocationController.getLocation)
  .patch(LocationController.updateLocation)
  .delete(LocationController.deleteLocation);

module.exports = router;
