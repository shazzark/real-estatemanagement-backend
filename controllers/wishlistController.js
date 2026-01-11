const Wishlist = require('../model/wishlistModel');
const Property = require('../model/propertyModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const mongoose = require('mongoose');

// ======================
// WISHLIST CRUD
// ======================

exports.getAllWishlistItems = catchAsync(async (req, res, next) => {
  // Filter for current user's wishlist
  const filter = { user: req.user._id };

  // Additional filters
  if (req.query.tags) {
    filter.tags = { $in: req.query.tags.split(',') };
  }

  if (req.query.priority) {
    filter.priority = req.query.priority * 1;
  }

  // Sorting
  let sort = '-createdAt'; // Default: newest first
  if (req.query.sort === 'oldest') {
    sort = 'createdAt';
  } else if (req.query.sort === 'priority') {
    sort = '-priority -createdAt';
  } else if (req.query.sort === 'price') {
    // Need to sort by populated property price
    // This would be handled differently in a real app
    sort = '-createdAt';
  }

  // Pagination
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 20;
  const skip = (page - 1) * limit;

  // Execute query
  const wishlistItems = await Wishlist.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit);

  // Get total count for pagination
  const total = await Wishlist.countDocuments(filter);

  // Get wishlist count
  const wishlistCount = await Wishlist.getWishlistCount(req.user._id);

  res.status(200).json({
    status: 'success',
    results: wishlistItems.length,
    wishlistCount,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    data: {
      wishlist: wishlistItems,
    },
  });
});

exports.getWishlistItem = catchAsync(async (req, res, next) => {
  const wishlistItem = await Wishlist.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!wishlistItem) {
    return next(new AppError('No wishlist item found with that ID', 404));
  }

  // Increment views
  wishlistItem.views += 1;
  await wishlistItem.save();

  res.status(200).json({
    status: 'success',
    data: {
      wishlist: wishlistItem,
    },
  });
});

exports.addToWishlist = catchAsync(async (req, res, next) => {
  // Check if property exists and is active
  const property = await Property.findOne({
    _id: req.body.property,
    isActive: { $ne: false },
  });

  if (!property) {
    return next(new AppError('No property found with that ID', 404));
  }

  // Check if already in wishlist
  const existingItem = await Wishlist.findOne({
    user: req.user._id,
    property: req.body.property,
  });

  if (existingItem) {
    // If exists but inactive, reactivate it
    if (!existingItem.isActive) {
      console.log('Reactivating wishlist item:', existingItem);
      existingItem.isActive = true;
      existingItem.notes = req.body.notes || existingItem.notes;
      existingItem.tags = req.body.tags || existingItem.tags;
      existingItem.priority = req.body.priority || existingItem.priority;
      await existingItem.save();
      console.log('Reactivated:', existingItem);

      return res.status(200).json({
        status: 'success',
        message: 'Property re-added to wishlist',
        data: {
          wishlist: existingItem,
        },
      });
    }

    return next(new AppError('Property already in your wishlist', 400));
  }

  // Auto-set user
  req.body.user = req.user._id;

  const wishlistItem = await Wishlist.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      wishlist: wishlistItem,
    },
  });
});

exports.updateWishlistItem = catchAsync(async (req, res, next) => {
  const wishlistItem = await Wishlist.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!wishlistItem) {
    return next(new AppError('No wishlist item found with that ID', 404));
  }

  // Only allow updating specific fields
  const allowedUpdates = [
    'notes',
    'tags',
    'priority',
    'reminderDate',
    'customName',
  ];
  const filteredBody = {};

  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      filteredBody[field] = req.body[field];
    }
  });

  const updatedItem = await Wishlist.findByIdAndUpdate(
    req.params.id,
    filteredBody,
    {
      new: true,
      runValidators: true,
    },
  );

  res.status(200).json({
    status: 'success',
    data: {
      wishlist: updatedItem,
    },
  });
});

exports.removeFromWishlist = catchAsync(async (req, res, next) => {
  // Option 1: Soft delete by property ID
  if (req.params.propertyId) {
    const wishlistItem = await Wishlist.findOneAndUpdate(
      {
        user: req.user._id,
        property: req.params.propertyId,
      },
      { isActive: false },
      { new: true },
    );

    if (!wishlistItem) {
      return next(new AppError('Property not found in your wishlist', 404));
    }

    return res.status(200).json({
      status: 'success',
      message: 'Property removed from wishlist',
      data: null,
    });
  }

  // Option 2: Delete by wishlist item ID
  const wishlistItem = await Wishlist.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!wishlistItem) {
    return next(new AppError('No wishlist item found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// ======================
// WISHLIST UTILITIES
// ======================

exports.checkInWishlist = catchAsync(async (req, res, next) => {
  const { propertyId } = req.params;

  // Check if property exists
  const property = await Property.findById(propertyId);
  if (!property) {
    return next(new AppError('No property found with that ID', 404));
  }

  const inWishlist = await Wishlist.isInWishlist(req.user._id, propertyId);

  res.status(200).json({
    status: 'success',
    data: {
      inWishlist,
      propertyId,
    },
  });
});

exports.getWishlistStats = catchAsync(async (req, res, next) => {
  const stats = await Wishlist.aggregate([
    {
      $match: { user: req.user._id, isActive: { $ne: false } },
    },
    {
      $lookup: {
        from: 'properties',
        localField: 'property',
        foreignField: '_id',
        as: 'propertyDetails',
      },
    },
    {
      $unwind: '$propertyDetails',
    },
    {
      $group: {
        _id: null,
        totalItems: { $sum: 1 },
        totalValue: { $sum: '$propertyDetails.price' },
        byPropertyType: {
          $push: '$propertyDetails.propertyType',
        },
        byStatus: {
          $push: '$propertyDetails.status',
        },
        averagePriority: { $avg: '$priority' },
      },
    },
    {
      $project: {
        _id: 0,
        totalItems: 1,
        totalValue: 1,
        averagePriority: { $round: ['$averagePriority', 2] },
        propertyTypeBreakdown: {
          $reduce: {
            input: [
              'apartment',
              'house',
              'villa',
              'condo',
              'commercial',
              'land',
            ],
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [
                    [
                      [
                        '$$this',
                        {
                          $size: {
                            $filter: {
                              input: '$byPropertyType',
                              as: 'type',
                              cond: { $eq: ['$$type', '$$this'] },
                            },
                          },
                        },
                      ],
                    ],
                  ],
                },
              ],
            },
          },
        },
        statusBreakdown: {
          $reduce: {
            input: ['available', 'booked', 'sold', 'pending'],
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [
                    [
                      [
                        '$$this',
                        {
                          $size: {
                            $filter: {
                              input: '$byStatus',
                              as: 'status',
                              cond: { $eq: ['$$status', '$$this'] },
                            },
                          },
                        },
                      ],
                    ],
                  ],
                },
              ],
            },
          },
        },
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats: stats[0] || {},
    },
  });
});

exports.getPopularWishlistProperties = catchAsync(async (req, res, next) => {
  const popularProperties = await Wishlist.aggregate([
    {
      $group: {
        _id: '$property',
        count: { $sum: 1 },
        users: { $addToSet: '$user' },
      },
    },
    {
      $sort: { count: -1 },
    },
    {
      $limit: 10,
    },
    {
      $lookup: {
        from: 'properties',
        localField: '_id',
        foreignField: '_id',
        as: 'propertyDetails',
      },
    },
    {
      $unwind: '$propertyDetails',
    },
    {
      $project: {
        _id: 0,
        property: {
          _id: '$propertyDetails._id',
          title: '$propertyDetails.title',
          price: '$propertyDetails.price',
          images: '$propertyDetails.images',
          status: '$propertyDetails.status',
          city: '$propertyDetails.address.city',
        },
        wishlistCount: '$count',
        uniqueUsers: { $size: '$users' },
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    results: popularProperties.length,
    data: {
      popularProperties,
    },
  });
});

// ======================
// BULK OPERATIONS
// ======================

exports.bulkAddToWishlist = catchAsync(async (req, res, next) => {
  const { propertyIds } = req.body;

  if (!propertyIds || !Array.isArray(propertyIds) || propertyIds.length === 0) {
    return next(new AppError('Please provide an array of property IDs', 400));
  }

  // Check if properties exist
  const properties = await Property.find({
    _id: { $in: propertyIds },
    isActive: { $ne: false },
  });

  if (properties.length !== propertyIds.length) {
    return next(new AppError('Some properties were not found', 404));
  }

  // Check which properties are already in wishlist
  const existingItems = await Wishlist.find({
    user: req.user.id,
    property: { $in: propertyIds },
  }).select('property');

  const existingPropertyIds = existingItems.map((item) =>
    item.property.toString(),
  );
  const newPropertyIds = propertyIds.filter(
    (id) => !existingPropertyIds.includes(id.toString()),
  );

  // Create wishlist items for new properties
  const wishlistItems = newPropertyIds.map((propertyId) => ({
    user: req.user._id,
    property: propertyId,
  }));

  const createdItems = await Wishlist.insertMany(wishlistItems);

  res.status(201).json({
    status: 'success',
    message: `${createdItems.length} properties added to wishlist`,
    skipped: existingPropertyIds.length,
    data: {
      wishlist: createdItems,
    },
  });
});

exports.toggleWishlist = catchAsync(async (req, res, next) => {
  const { property } = req.body;
  const userId = req.user._id;

  if (!property) {
    return next(new AppError('Property ID is required', 400));
  }

  // console.log('=== TOGGLE WISHLIST ===');
  // console.log('Looking for existing wishlist item...');

  // Use skipActiveFilter option to find even inactive items
  let wishlistItem = await Wishlist.findOne({
    user: userId,
    property: property,
  }).setOptions({ skipActiveFilter: true });

  // console.log(
  //   'Found item:',
  //   wishlistItem
  //     ? `ID: ${wishlistItem._id}, isActive: ${wishlistItem.isActive}`
  //     : 'Not found',
  // );

  if (wishlistItem) {
    // console.log('Toggling existing item...');
    // Toggle isActive
    wishlistItem.isActive = !wishlistItem.isActive;

    await wishlistItem.save();
    // console.log('Successfully saved toggle');

    // Populate for response
    await wishlistItem.populate({
      path: 'property',
      select: 'title price images',
    });

    return res.status(200).json({
      status: 'success',
      message: wishlistItem.isActive
        ? 'Property added to wishlist'
        : 'Property removed from wishlist',
      data: { wishlist: wishlistItem },
    });
  }

  // console.log('Creating new wishlist item...');
  // Create new wishlist item
  wishlistItem = await Wishlist.create({
    user: userId,
    property: property,
    isActive: true,
    notes: '',
    priority: 3,
  });
  // console.log('Created new item:', wishlistItem._id);

  // Populate for response
  await wishlistItem.populate({
    path: 'property',
    select: 'title price images',
  });

  res.status(201).json({
    status: 'success',
    message: 'Property added to wishlist',
    data: { wishlist: wishlistItem },
  });
});

exports.clearWishlist = catchAsync(async (req, res, next) => {
  await Wishlist.updateMany(
    { user: req.user._id, isActive: true },
    { isActive: false },
  );

  res.status(200).json({
    status: 'success',
    message: 'Wishlist cleared successfully',
    data: null,
  });
});
