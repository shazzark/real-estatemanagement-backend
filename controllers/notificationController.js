const Notification = require('../model/notificationModel');
const User = require('../model/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// ======================
// NOTIFICATION CRUD
// ======================

exports.getAllNotifications = catchAsync(async (req, res, next) => {
  // Filter for current user's notifications
  const filter = { user: req.user.id };
  console.log('=== NOTIFICATIONS DEBUG ===');
  console.log('User ID from req.user:', req.user?.id);
  console.log('Full req.user:', req.user);
  console.log('======================');

  // Additional filters
  if (req.query.read !== undefined) {
    filter.read = req.query.read === 'true';
  }

  if (req.query.type) {
    filter.type = req.query.type;
  }

  if (req.query.important === 'true') {
    filter.isImportant = true;
  }

  // Sorting
  let sort = '-createdAt'; // Default: newest first
  if (req.query.sort === 'oldest') {
    sort = 'createdAt';
  }

  // Pagination
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 20;
  const skip = (page - 1) * limit;

  // Execute query
  const notifications = await Notification.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(limit);

  // Get total count for pagination
  const total = await Notification.countDocuments(filter);

  // Get unread count
  const unreadCount = await Notification.countDocuments({
    user: req.user.id,
    read: false,
  });

  res.status(200).json({
    status: 'success',
    results: notifications.length,
    unreadCount,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    data: {
      notifications,
    },
  });
});

exports.getNotification = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    user: req.user.id,
  });

  if (!notification) {
    return next(new AppError('No notification found with that ID', 404));
  }

  // Mark as read when fetched
  if (!notification.read) {
    notification.read = true;
    await notification.save();
  }

  res.status(200).json({
    status: 'success',
    data: {
      notification,
    },
  });
});

exports.createNotification = catchAsync(async (req, res, next) => {
  // Auto-set user to current user if not provided
  if (!req.body.user) req.body.user = req.user.id;

  // Check if user exists
  const user = await User.findById(req.body.user);
  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  // Check permissions - users can only create notifications for themselves
  if (req.body.user !== req.user.id && req.user.role !== 'admin') {
    return next(
      new AppError('You can only create notifications for yourself', 403),
    );
  }

  const notification = await Notification.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      notification,
    },
  });
});

exports.updateNotification = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    user: req.user.id,
  });

  if (!notification) {
    return next(new AppError('No notification found with that ID', 404));
  }

  // Only allow updating read status and isImportant
  const allowedUpdates = {};
  if (req.body.read !== undefined) {
    allowedUpdates.read = req.body.read;
  }
  if (req.body.isImportant !== undefined && req.user.role === 'admin') {
    allowedUpdates.isImportant = req.body.isImportant;
  }

  const updatedNotification = await Notification.findByIdAndUpdate(
    req.params.id,
    allowedUpdates,
    {
      new: true,
      runValidators: true,
    },
  );

  res.status(200).json({
    status: 'success',
    data: {
      notification: updatedNotification,
    },
  });
});

exports.deleteNotification = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    user: req.user.id,
  });

  if (!notification) {
    return next(new AppError('No notification found with that ID', 404));
  }

  await Notification.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// ======================
// NOTIFICATION ACTIONS
// ======================

exports.markAsRead = catchAsync(async (req, res, next) => {
  const notification = await Notification.findOneAndUpdate(
    {
      _id: req.params.id,
      user: req.user.id,
    },
    { read: true },
    { new: true, runValidators: true },
  );

  if (!notification) {
    return next(new AppError('No notification found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      notification,
    },
  });
});

exports.markAllAsRead = catchAsync(async (req, res, next) => {
  await Notification.updateMany(
    { user: req.user.id, read: false },
    { read: true },
  );

  res.status(200).json({
    status: 'success',
    message: 'All notifications marked as read',
  });
});

exports.deleteAllRead = catchAsync(async (req, res, next) => {
  await Notification.deleteMany({
    user: req.user.id,
    read: true,
  });

  res.status(200).json({
    status: 'success',
    message: 'All read notifications deleted',
  });
});

// ======================
// NOTIFICATION UTILITIES
// ======================

exports.getUnreadCount = catchAsync(async (req, res, next) => {
  const count = await Notification.countDocuments({
    user: req.user.id,
    read: false,
  });

  res.status(200).json({
    status: 'success',
    data: {
      unreadCount: count,
    },
  });
});

exports.getNotificationStats = catchAsync(async (req, res, next) => {
  const stats = await Notification.aggregate([
    {
      $match: { user: req.user.id },
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unread: {
          $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] },
        },
        byType: {
          $push: {
            type: '$type',
            read: '$read',
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        total: 1,
        unread: 1,
        read: { $subtract: ['$total', '$unread'] },
        typeBreakdown: {
          $reduce: {
            input: [
              'booking',
              'property',
              'message',
              'review',
              'alert',
              'system',
              'reminder',
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
                          total: {
                            $size: {
                              $filter: {
                                input: '$byType',
                                as: 'item',
                                cond: { $eq: ['$$item.type', '$$this'] },
                              },
                            },
                          },
                          unread: {
                            $size: {
                              $filter: {
                                input: '$byType',
                                as: 'item',
                                cond: {
                                  $and: [
                                    { $eq: ['$$item.type', '$$this'] },
                                    { $eq: ['$$item.read', false] },
                                  ],
                                },
                              },
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

// ======================
// NOTIFICATION TRIGGERS (to be called from other controllers)
// ======================

exports.createBookingNotification = async (booking, type = 'new') => {
  const titles = {
    new: 'New Booking Request',
    confirmed: 'Booking Confirmed',
    cancelled: 'Booking Cancelled',
    reminder: 'Booking Reminder',
  };

  const messages = {
    new: `You have a new booking request for ${booking.property.title}`,
    confirmed: `Your booking for ${booking.property.title} has been confirmed`,
    cancelled: `Your booking for ${booking.property.title} has been cancelled`,
    reminder: `Reminder: You have a booking tomorrow for ${booking.property.title}`,
  };

  // Notification for user
  await Notification.create({
    user: booking.user,
    title: titles[type],
    message: messages[type],
    type: 'booking',
    relatedTo: booking._id,
    relatedModel: 'Booking',
    actionUrl: `/bookings/${booking._id}`,
  });

  // Notification for agent (if different from user)
  if (booking.agent.toString() !== booking.user.toString()) {
    await Notification.create({
      user: booking.agent,
      title: `New Booking - ${type}`,
      message: `${booking.user.name} ${type === 'new' ? 'requested' : type} a booking`,
      type: 'booking',
      relatedTo: booking._id,
      relatedModel: 'Booking',
      actionUrl: `/bookings/${booking._id}`,
    });
  }
};

exports.createPropertyNotification = async (property, user, type = 'new') => {
  const titles = {
    new: 'New Property Listed',
    updated: 'Property Updated',
    sold: 'Property Sold',
    price_change: 'Price Changed',
  };

  const messages = {
    new: `A new property "${property.title}" has been listed`,
    updated: `Property "${property.title}" has been updated`,
    sold: `Property "${property.title}" has been sold`,
    price_change: `Price changed for "${property.title}"`,
  };

  // Notify property owner
  if (property.owner && property.owner.toString() !== user.toString()) {
    await Notification.create({
      user: property.owner,
      title: titles[type],
      message: messages[type],
      type: 'property',
      relatedTo: property._id,
      relatedModel: 'Property',
      actionUrl: `/properties/${property._id}`,
    });
  }

  // Notify agent (if different from owner)
  if (
    property.agent &&
    property.agent.toString() !== property.owner.toString() &&
    property.agent.toString() !== user.toString()
  ) {
    await Notification.create({
      user: property.agent,
      title: titles[type],
      message: messages[type],
      type: 'property',
      relatedTo: property._id,
      relatedModel: 'Property',
      actionUrl: `/properties/${property._id}`,
    });
  }
};
