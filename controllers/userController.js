const User = require('../model/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// ======================
// USER MANAGEMENT CONTROLLERS
// ======================

// Filter allowed fields for update
const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

// ======================
// USER CRUD OPERATIONS
// ======================

exports.getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find().select('-__v');

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: {
      users,
    },
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

exports.getMe = catchAsync(async (req, res, next) => {
  // req.user is set from protect middleware
  const user = await User.findById(req.user.id);

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

// exports.updateMe = catchAsync(async (req, res, next) => {
//   // 1) Create error if user POSTs password data
//   if (req.body.password || req.body.passwordConfirm) {
//     return next(
//       new AppError(
//         'This route is not for password updates. Please use /updateMyPassword.',
//         400,
//       ),
//     );
//   }

//   // 2) Filtered out unwanted fields that are not allowed to be updated
//   const filteredBody = filterObj(req.body, 'name', 'email', 'phone', 'photo');

//   // 3) Update user document
//   const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
//     new: true,
//     runValidators: true,
//   });

//   res.status(200).json({
//     status: 'success',
//     data: {
//       user: updatedUser,
//     },
//   });
// });

exports.updateMe = catchAsync(async (req, res, next) => {
  console.log('UPDATE ME BODY:', req.body); // Add this
  console.log('User ID:', req.user.id); // Add this

  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword.',
        400,
      ),
    );
  }

  // 2) Filtered out unwanted fields that are not allowed to be updated
  const filteredBody = filterObj(
    req.body,
    'name',
    'email',
    'phone',
    'photo',
    'role',
  );
  console.log('FILTERED BODY:', filteredBody); // Add this

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  console.log('UPDATED USER:', updatedUser); // Add this

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// ======================
// ADMIN ONLY OPERATIONS
// ======================

exports.createUser = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    phone: req.body.phone,
    role: req.body.role,
  });

  // Remove password from output
  newUser.password = undefined;

  res.status(201).json({
    status: 'success',
    data: {
      user: newUser,
    },
  });
});

exports.updateUser = catchAsync(async (req, res, next) => {
  // 1) Check if user is trying to update password
  if (req.body.password) {
    return next(
      new AppError(
        'This route is not for password updates. Please use dedicated password update route.',
        400,
      ),
    );
  }

  // 2) Filter allowed fields for admin update
  const filteredBody = filterObj(
    req.body,
    'name',
    'email',
    'phone',
    'photo',
    'role',
    'active',
  );

  // 3) Update user
  const updatedUser = await User.findByIdAndUpdate(
    req.params.id,
    filteredBody,
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updatedUser) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// ======================
// USER STATISTICS
// ======================

exports.getUserStats = catchAsync(async (req, res, next) => {
  const stats = await User.aggregate([
    {
      $match: { active: { $ne: false } },
    },
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
        avgProperties: { $avg: { $size: { $ifNull: ['$properties', []] } } },
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats,
    },
  });
});

exports.getAgentsWithListings = catchAsync(async (req, res, next) => {
  const agents = await User.aggregate([
    {
      $match: {
        role: 'agent',
        active: { $ne: false },
      },
    },
    {
      $lookup: {
        from: 'properties',
        localField: '_id',
        foreignField: 'agent',
        as: 'listings',
      },
    },
    {
      $project: {
        name: 1,
        email: 1,
        phone: 1,
        photo: 1,
        listingsCount: { $size: '$listings' },
        activeListings: {
          $size: {
            $filter: {
              input: '$listings',
              as: 'listing',
              cond: { $eq: ['$$listing.status', 'available'] },
            },
          },
        },
        avgListingPrice: { $avg: '$listings.price' },
        totalValue: { $sum: '$listings.price' },
      },
    },
    {
      $sort: { listingsCount: -1 },
    },
  ]);

  res.status(200).json({
    status: 'success',
    results: agents.length,
    data: {
      agents,
    },
  });
});
