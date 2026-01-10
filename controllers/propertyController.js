const Property = require('../model/propertyModel');
const APIFeatures = require('../utils/apiFeatures');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const fs = require('fs');
const path = require('path');
const notificationController = require('./notificationController');

// Alias Middlewares - Improved with constants
const DEFAULT_LIMIT = 10;
const COMMON_FIELDS =
  'title,price,location,description,status,amenities,images';

exports.aliasPropertiesByCity = (req, res, next) => {
  req.query = {
    ...req.query,
    city: req.params.cityName,
    status: 'available',
    limit: DEFAULT_LIMIT.toString(),
    sort: 'price',
    fields: COMMON_FIELDS,
  };
  next();
};

exports.aliasBudgetFriendlyProperties = (req, res, next) => {
  req.query = {
    ...req.query,
    limit: DEFAULT_LIMIT.toString(),
    sort: 'price',
    fields: COMMON_FIELDS,
    price: { lte: 300000 },
    status: 'available',
  };
  next();
};

exports.aliasFeaturedProperties = (req, res, next) => {
  req.query = {
    ...req.query,
    limit: '10',
    sort: 'price',
    fields: 'title price location status images',
    status: 'available',
  };
  next();
};

exports.aliasTopProperties = (req, res, next) => {
  req.query = {
    ...req.query,
    limit: '5',
    sort: 'price',
    fields: 'title price location status images',
    status: 'available',
  };
  next();
};

// Similar improvements for other aliases...

// CRUD OPERATIONS - Using catchAsync and better error handling
exports.getAllProperties = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(Property.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const properties = await features.query;

  res.status(200).json({
    status: 'success',
    requestedAt: req.requestTime,
    results: properties.length,
    data: {
      properties, // Changed from 'property' to 'properties' for consistency
    },
  });
});

exports.getProperty = catchAsync(async (req, res, next) => {
  const property = await Property.findById(req.params.id);

  console.log(property);

  if (!property) {
    return next(new AppError('No property found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      property,
    },
  });
});

exports.createProperty = catchAsync(async (req, res, next) => {
  // Fix coordinates if they come as a string from form-data
  if (
    req.body.geoLocation &&
    req.body.geoLocation.coordinates &&
    typeof req.body.geoLocation.coordinates === 'string'
  ) {
    req.body.geoLocation.coordinates = req.body.geoLocation.coordinates
      .split(',')
      .map(Number);
  }

  // Validate coordinates range
  if (req.body.geoLocation && req.body.geoLocation.coordinates) {
    const [lng, lat] = req.body.geoLocation.coordinates;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return next(new AppError('Invalid coordinates provided', 400));
    }
  }

  // Handle uploaded files from form-data (Multer)
  if (req.files && req.files.length > 0) {
    req.body.images = req.files.map((file, index) => ({
      url: `/img/properties/${file.filename}`,
      filename: file.filename,
      isPrimary: index === 0,
    }));
  }

  // Only agents can create properties
  if (req.user.role !== 'agent') {
    return next(new AppError('Only agents can create properties', 403));
  }

  // Assign agent and owner
  req.body.agent = req.user.id;
  req.body.owner = req.user.id;

  const newProperty = await Property.create(req.body);

  res.status(201).json({
    status: 'success',
    data: { property: newProperty },
  });
});

exports.updateProperty = catchAsync(async (req, res, next) => {
  const property = await Property.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!property) {
    return next(new AppError('No property found with that ID', 404));
  }
  // await notificationController.createPropertyNotification(
  //   updatedProperty,
  //   req.user.id,
  //   'updated',
  // );
  await notificationController.createPropertyNotification(
    property,
    req.user.id,
    'updated',
  );

  res.status(200).json({
    status: 'success',
    data: {
      property,
    },
  });
});

exports.deleteProperty = catchAsync(async (req, res, next) => {
  const property = await Property.findByIdAndDelete(req.params.id);

  if (!property) {
    return next(new AppError('No property found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// AGGREGATION PIPELINE to calculate property statistics
// shows the stats of properties with ratingAverage greater than or equal to 4.5
exports.getPropertyStats = catchAsync(async (req, res, next) => {
  const stats = await Property.aggregate([
    {
      $match: { ratingAverage: { $gte: 4.5 } },
    },
    {
      $group: {
        _id: { $toUpper: '$status' },
        numProperties: { $sum: 1 },
        numRatings: { $sum: '$ratingQuantity' },
        avgRating: { $avg: '$ratingAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      $sort: { avgPrice: -1 },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats,
    },
  });
});

// Get monthly listings for a given year
exports.getYearlyListings = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1; // 2023
  const monthlyListings = await Property.aggregate([
    // {
    //   $unwind: '$createdAt',
    // },
    {
      $match: {
        createdAt: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        numListings: { $sum: 1 },
        properties: { $push: '$title' },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 12 },
  ]);
  res.status(200).json({
    status: 'success',
    data: {
      monthlyListings,
    },
  });
});

// get properties stats by City with rating average, average price, total number of properties
exports.getPropertyStatsByCity = catchAsync(async (req, res, next) => {
  // try {
  const cityStats = await Property.aggregate([
    // Unwind the city field if it's an array (optional, depending on your schema)
    // { $unwind: "$city" },
    // Group by city and calculate statistics
    {
      $group: {
        _id: '$city',
        numProperties: { $sum: 1 },
        totalProperties: { $sum: 1 },
        availableProperties: {
          $sum: {
            $cond: [{ $eq: ['$status', 'available'] }, 1, 0],
          },
        },
        averagePrice: { $avg: '$price' },
        averageRating: { $avg: '$ratingAverage' },
      },
    },
    // Sort cities by total number of properties in descending order
    {
      $sort: { totalProperties: -1 },
    },
  ]);
  res.status(200).json({
    status: 'success',
    data: {
      cityStats,
    },
  });
});
// / get top agents properties count, average rating, total reviews, average price of their listings
exports.getTopAgents = catchAsync(async (req, res, next) => {
  const topAgent = await Property.aggregate([
    {
      $group: {
        _id: '$agent',
        avgRating: { $avg: '$ratingAverage' },
        totalListings: { $sum: 1 },
        totalReviews: { $sum: '$ratingQuantity' },
        averagePrice: { $avg: '$price' },
      },
    },
    {
      $lookup: {
        from: 'agents',
        localField: '_id',
        foreignField: '_id',
        as: 'agentDetails',
      },
    },
    { $unwind: '$agentDetails' },
    {
      $sort: { avgRating: -1, totalListings: -1 },
    },
    {
      $limit: 5,
    },
  ]);
  res.status(200).json({
    status: 'success',
    data: {
      topAgent,
    },
  });
});

// get most searched cities for properties

//top cities with most available properties
//  $match: { ratingAverage: { $gte: 4.5 } }
exports.getTopCities = catchAsync(async (req, res, next) => {
  const topCities = await Property.aggregate([
    {
      $match: { status: 'available' },
    },
    {
      $group: {
        _id: '$city',
        numAvailableProperties: { $sum: 1 },
      },
    },
    {
      $sort: { numAvailableProperties: -1 },
    },
    {
      $limit: 10,
    },
  ]);
  res.status(200).json({
    status: 'success',
    data: {
      topCities,
    },
  });
});

// for admin
// how many properties did i list in a  month
exports.getMonthlyListing = catchAsync(async (req, res, next) => {
  const monthlyStats = await Property.aggregate([
    {
      $group: {
        _id: {
          year: { $year: 'createdAt' },
          month: { $month: '$createdAt' },
        },
        listingsCount: { $sum: 1 },
        soldCount: {
          $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] },
        },
        totalRevenue: { $sum: '$price' },
      },
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
  ]);
  res.status(200).json({
    status: 'success',
    data: {
      monthlyStats,
    },
  });
});
//
