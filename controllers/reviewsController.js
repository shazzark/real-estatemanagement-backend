const Review = require('../model/reviewModel');
const Property = require('../model/propertyModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const mongoose = require('mongoose');

// ======================
// ALIAS MIDDLEWARES
// ======================

exports.aliasRecentReviews = (req, res, next) => {
  req.query.limit = '10';
  req.query.sort = '-createdAt';
  req.query.fields = 'user,rating,title,comment,createdAt';
  next();
};

exports.aliasTopRatedReviews = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-rating,-helpfulCount';
  req.query.fields =
    'user,rating,title,comment,helpfulCount,isVerifiedPurchase';
  next();
};

exports.aliasPropertyReviews = (req, res, next) => {
  req.query.property = req.params.propertyId;
  req.query.sort = '-createdAt';
  req.query.status = 'approved';
  next();
};

// ======================
// CRUD OPERATIONS
// ======================

exports.getAllReviews = catchAsync(async (req, res, next) => {
  let filter = {};

  // Filter by property if propertyId is provided
  if (req.params.propertyId) {
    filter.property = req.params.propertyId;
  }

  // Only show approved reviews for non-admins
  // if (req.user?.role !== 'admin') {
  //   filter.status = 'approved';
  // }

  const features = new APIFeatures(Review.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const reviews = await features.query;

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    data: {
      reviews,
    },
  });
});

exports.getReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new AppError('No review found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      review,
    },
  });
});

exports.createReview = catchAsync(async (req, res, next) => {
  // Allow nested routes
  if (!req.body.property) req.body.property = req.params.propertyId;
  if (!req.body.user) req.body.user = req.user.id;

  // Check if property exists
  const property = await Property.findById(req.body.property);
  if (!property) {
    return next(new AppError('No property found with that ID', 404));
  }

  // Check if user already reviewed this property
  const existingReview = await Review.findOne({
    property: req.body.property,
    user: req.body.user,
  });

  if (existingReview) {
    return next(new AppError('You have already reviewed this property', 400));
  }

  // Check if user can review (optional - if you want to restrict to buyers/viewers)
  // Add your logic here (check bookings, etc.)

  const newReview = await Review.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      review: newReview,
    },
  });
});

exports.updateReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new AppError('No review found with that ID', 404));
  }

  // Check ownership or admin rights
  if (review.user.id !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('You can only update your own reviews', 403));
  }

  // Remove restricted fields
  const filteredBody = filterUpdateBody(req.body, req.user.role);

  const updatedReview = await Review.findByIdAndUpdate(
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
      review: updatedReview,
    },
  });
});

exports.deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new AppError('No review found with that ID', 404));
  }

  // Check ownership or admin rights
  if (review.user.id !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('You can only delete your own reviews', 403));
  }

  await Review.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// ======================
// HELPER FUNCTIONS
// ======================

const filterUpdateBody = (body, userRole) => {
  const allowedFields = ['rating', 'title', 'comment'];
  const filteredBody = {};

  Object.keys(body).forEach((field) => {
    if (allowedFields.includes(field)) {
      filteredBody[field] = body[field];
    }
  });

  // Only admins can change status
  if (userRole === 'admin' && body.status) {
    filteredBody.status = body.status;
  }

  return filteredBody;
};

// ======================
// STATISTICS & ANALYTICS
// ======================

exports.getReviewStats = catchAsync(async (req, res, next) => {
  const stats = await Review.aggregate([
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        helpfulReviews: {
          $sum: { $cond: [{ $gt: ['$helpfulCount', 0] }, 1, 0] },
        },
        verifiedReviews: {
          $sum: { $cond: ['$isVerifiedPurchase', 1, 0] },
        },
        recentReviews: {
          $sum: {
            $cond: [
              {
                $gt: [
                  '$createdAt',
                  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalReviews: 1,
        averageRating: { $round: ['$averageRating', 2] },
        helpfulReviews: 1,
        verifiedReviews: 1,
        recentReviews: 1,
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

// exports.getPropertyReviewStats = catchAsync(async (req, res, next) => {
//   const stats = await Review.aggregate([
//     {
//       $match: {
//         property: req.params.propertyId,
//       },
//     },
//     {
//       $group: {
//         _id: '$property',
//         totalReviews: { $sum: 1 },
//         averageRating: { $avg: '$rating' },
//         ratingDistribution: {
//           $push: '$rating',
//         },

//         verifiedCount: {
//           $sum: { $cond: ['$isVerifiedPurchase', 1, 0] },
//         },
//       },
//     },
//     {
//       $project: {
//         _id: 0,
//         totalReviews: 1,
//         averageRating: { $round: ['$averageRating', 2] },
//         // helpfulCount: 1,
//         verifiedCount: 1,
//         ratingBreakdown: {
//           $reduce: {
//             input: [1, 2, 3, 4, 5],
//             initialValue: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
//             in: {
//               $let: {
//                 vars: {
//                   rating: { $toString: '$$this' },
//                 },
//                 in: {
//                   $mergeObjects: [
//                     '$$value',
//                     {
//                       $arrayToObject: [
//                         [
//                           [
//                             '$$rating',
//                             {
//                               $size: {
//                                 $filter: {
//                                   input: '$ratingDistribution',
//                                   as: 'r',
//                                   cond: { $eq: ['$$r', '$$this'] },
//                                 },
//                               },
//                             },
//                           ],
//                         ],
//                       ],
//                     },
//                   ],
//                 },
//               },
//             },
//           },
//         },
//       },
//     },
//   ]);

//   res.status(200).json({
//     status: 'success',
//     data: {
//       stats: stats[0] || {},
//     },
//   });
// });

// Get top reviewers

exports.getPropertyReviewStats = catchAsync(async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.propertyId)) {
    return next(new AppError('Invalid property ID', 400));
  }

  const stats = await Review.aggregate([
    {
      $match: {
        property: new mongoose.Types.ObjectId(req.params.propertyId),
      },
    },
    {
      $group: {
        _id: '$property',
        totalReviews: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        ratingDistribution: { $push: '$rating' },
        helpfulCount: { $sum: '$helpfulCount' },
        verifiedCount: { $sum: { $cond: ['$isVerifiedPurchase', 1, 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        totalReviews: 1,
        averageRating: { $round: ['$averageRating', 2] },
        helpfulCount: 1,
        verifiedCount: 1,
        ratingBreakdown: {
          $reduce: {
            input: [1, 2, 3, 4, 5],
            initialValue: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [
                    [
                      [
                        { $toString: '$$this' },
                        {
                          $size: {
                            $filter: {
                              input: '$ratingDistribution',
                              as: 'r',
                              cond: { $eq: ['$$r', '$$this'] },
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
