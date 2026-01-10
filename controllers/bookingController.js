const Booking = require('../model/bookingModel');
const Property = require('../model/propertyModel');
const User = require('../model/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const notificationController = require('../controllers/notificationController');
const APIFeatures = require('../utils/apiFeatures');
// const sendEmail = require('../utils/email');
const sendEmail = require('../utils/email');

// ======================
// CRUD OPERATIONS
// ======================

exports.getAllBookings = catchAsync(async (req, res, next) => {
  let filter = {};

  // Filter based on user role
  if (req.user.role === 'user') {
    filter.user = req.user.id;
  } else if (req.user.role === 'agent') {
    filter.agent = req.user.id;
  }

  // Additional filters from query params
  if (req.query.property) filter.property = req.query.property;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.bookingType) filter.bookingType = req.query.bookingType;

  const features = new APIFeatures(Booking.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const bookings = await features.query;

  res.status(200).json({
    status: 'success',
    results: bookings.length,
    data: {
      bookings,
    },
  });
});

exports.getBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return next(new AppError('No booking found with that ID', 404));
  }

  // Check authorization
  if (
    req.user.role === 'user' &&
    booking.user.toString() !== req.user.id.toString()
  ) {
    return next(new AppError('You can only view your own bookings', 403));
  }

  if (
    req.user.role === 'agent' &&
    booking.agent.toString() !== req.user.id.toString()
  ) {
    return next(
      new AppError('You can only view bookings assigned to you', 403),
    );
  }

  res.status(200).json({
    status: 'success',
    data: {
      booking,
    },
  });
});

exports.createBooking = catchAsync(async (req, res, next) => {
  // 1️⃣ Check if property exists and is available
  const property = await Property.findById(req.body.property);
  if (!property)
    return next(new AppError('No property found with that ID', 404));
  if (property.status !== 'available')
    return next(
      new AppError('This property is not available for booking', 400),
    );

  // 2️⃣ Auto-set user if not provided
  if (!req.body.user) req.body.user = req.user.id;

  // 3️⃣ Check availability for viewing bookings only
  if (req.body.bookingType === 'viewing') {
    const isAvailable = await Booking.checkAvailability(
      req.body.property,
      req.body.date,
      req.body.timeSlot,
    );
    if (!isAvailable)
      return next(new AppError('This time slot is not available', 400));
  }

  if (req.body.bookingType === 'purchase') {
    req.body.status = 'pending';
    req.body.paymentStatus = 'unpaid';
    req.body.price = property.price;
  }

  // 4️⃣ Create the booking
  let newBooking = await Booking.create(req.body);

  // 5️⃣ Populate all necessary fields for emails/notifications
  newBooking = await Booking.findById(newBooking._id)
    .populate('user', 'name email')
    .populate('property', 'title')
    .populate('agent', 'name email');

  // 6️⃣ Create notification
  await notificationController.createBookingNotification(newBooking, 'new');

  // 7️⃣ Send emails asynchronously (don't await)
  setTimeout(async () => {
    try {
      if (newBooking.bookingType === 'viewing' && newBooking.user?.email) {
        await sendBookingConfirmationEmail(newBooking);
      }

      if (newBooking.agent?.email) {
        await sendEmail({
          to: newBooking.agent.email,
          subject: 'New Booking Request',
          html: `
            <p>
              New ${newBooking.bookingType} request for 
              <strong>${newBooking.property?.title || 'Property'}</strong><br/>
              Date: ${newBooking.date ? new Date(newBooking.date).toLocaleDateString() : 'To be scheduled'}<br/>
              User: ${newBooking.user?.name || 'User'}
            </p>
            ${newBooking.message ? `<p>Message: ${newBooking.message}</p>` : ''}
            ${newBooking.price ? `<p>Price: $${newBooking.price}</p>` : ''}
          `,
        });
      }
    } catch (err) {
      console.log('Email error (non-blocking):', err.message);
    }
  }, 0);

  // 8️⃣ Send response
  res.status(201).json({
    status: 'success',
    data: {
      booking: newBooking,
    },
  });
});

exports.updateBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return next(new AppError('No booking found with that ID', 404));
  }

  // Check authorization
  if (
    req.user.role === 'user' &&
    booking.user.toString() !== req.user.id.toString()
  ) {
    return next(new AppError('You can only update your own bookings', 403));
  }

  // Filter allowed update fields based on user role
  const allowedUpdates = filterBookingUpdates(req.body, req.user.role);

  // Special handling for status changes
  if (allowedUpdates.status) {
    const canChangeStatus = checkStatusChangePermission(
      booking.status,
      allowedUpdates.status,
      req.user.role,
    );

    if (!canChangeStatus) {
      return next(
        new AppError('You cannot change booking status to this value', 403),
      );
    }
  }

  const updatedBooking = await Booking.findByIdAndUpdate(
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
      booking: updatedBooking,
    },
  });
});

exports.deleteBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return next(new AppError('No booking found with that ID', 404));
  }

  // Users can delete their own pending bookings
  if (req.user.role === 'user') {
    if (booking.user.toString() !== req.user.id.toString()) {
      return next(new AppError('You can only delete your own bookings', 403));
    }

    if (booking.status !== 'pending') {
      return next(new AppError('Only pending bookings can be deleted', 400));
    }

    // Soft delete for user
    await Booking.findByIdAndDelete(req.params.id);
  } else if (req.user.role === 'admin') {
    // Admin can delete any booking (soft delete)
    booking.isActive = false;
    await booking.save();
  } else {
    return next(
      new AppError('You do not have permission to delete bookings', 403),
    );
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// ======================
// BOOKING ACTIONS
// ======================

// exports.confirmBooking = catchAsync(async (req, res, next) => {
//   const booking = await Booking.findById(req.params.id)
//     .populate('user')
//     .populate('agent')
//     .populate('property');

//   if (!booking) {
//     return next(new AppError('No booking found with that ID', 404));
//   }

//   // Only agent or admin can confirm
//   if (
//     req.user.role !== 'agent' &&
//     req.user.role !== 'admin' &&
//     booking.agent.toString() !== req.user.id.toString()
//   ) {
//     return next(
//       new AppError('Only assigned agent or admin can confirm bookings', 403),
//     );
//   }

//   if (booking.bookingType === 'viewing') {
//     booking.status = 'confirmed';
//   }

//   if (booking.bookingType === 'rental') {
//     booking.status = 'agent_confirmed';
//   }

//   if (booking.bookingType === 'purchase') {
//     booking.status = 'agent_confirmed';
//   }

//   await booking.save();

//   // Send notification
//   await notificationController.createBookingNotification(booking, 'confirmed');

//   // Send confirmation email
//   try {
//     await sendBookingConfirmedEmail(booking);
//   } catch (err) {
//     console.log('Could not send confirmation email:', err.message);
//   }

//   res.status(200).json({
//     status: 'success',
//     data: {
//       booking,
//     },
//   });
// });

exports.confirmBooking = catchAsync(async (req, res, next) => {
  // Use process.stdout.write to ensure logs appear
  process.stdout.write('\n\n🎯 === CONFIRM BOOKING CALLED ===\n');
  process.stdout.write(`📝 Booking ID: ${req.params.id}\n`);
  process.stdout.write(`👤 User ID: ${req.user?.id || 'NO USER'}\n`);
  process.stdout.write(`🎭 User Role: ${req.user?.role || 'NO ROLE'}\n`);

  // ALWAYS log the user object
  console.error('🔍 REQ.USER OBJECT:', req.user);
  console.error('🔍 REQ.USER TYPE:', typeof req.user);

  const booking = await Booking.findById(req.params.id)
    .populate('user', 'name email _id')
    .populate('agent', 'name email _id')
    .populate('property', 'title');

  if (!booking) {
    console.error('❌ Booking not found');
    return next(new AppError('No booking found with that ID', 404));
  }

  console.error('✅ Booking found');
  console.error('   Booking ID:', booking._id);
  console.error('   Booking Agent ID:', booking.agent?._id);
  console.error('   Booking Agent:', booking.agent);
  console.error('   Current User ID:', req.user?.id);

  // SIMPLE AUTHORIZATION CHECK - Debug version
  console.error('🔐 Starting authorization check...');

  // Check 1: Is user authenticated?
  if (!req.user || !req.user.id) {
    console.error('❌ FAIL: No user authenticated');
    return next(new AppError('You must be logged in', 401));
  }

  // Check 2: Is user agent or admin?
  if (req.user.role !== 'agent' && req.user.role !== 'admin') {
    console.error(
      `❌ FAIL: User role is "${req.user.role}", need "agent" or "admin"`,
    );
    return next(
      new AppError('Only agents or admins can confirm bookings', 403),
    );
  }

  // Check 3: If user is agent, are they the booking's agent?
  if (req.user.role === 'agent') {
    if (!booking.agent) {
      console.error('❌ FAIL: Booking has no agent assigned');
      return next(new AppError('No agent assigned to this booking', 403));
    }

    const bookingAgentId = booking.agent._id?.toString();
    const userId = req.user.id.toString();

    console.error(
      `   Comparing: Booking Agent "${bookingAgentId}" vs User "${userId}"`,
    );

    if (bookingAgentId !== userId) {
      console.error(`❌ FAIL: Agent mismatch`);
      return next(
        new AppError('You can only confirm bookings assigned to you', 403),
      );
    }
  }

  console.error('✅ Authorization PASSED!');

  // Update booking
  if (booking.bookingType === 'viewing') {
    booking.status = 'confirmed';
  } else if (
    booking.bookingType === 'rental' ||
    booking.bookingType === 'purchase'
  ) {
    booking.status = 'agent_confirmed';
  }

  await booking.save();
  console.error('✅ Booking updated successfully');

  // Send response
  res.status(200).json({
    status: 'success',
    data: { booking },
  });
});

exports.cancelBooking = catchAsync(async (req, res, next) => {
  // Get the booking
  const booking = await Booking.findById(req.params.id)
    .select('user agent status date')
    .populate('user', '_id')
    .populate('agent', '_id');

  if (!booking) {
    return next(new AppError('No booking found with that ID', 404));
  }

  // Check authorization
  const isBookingOwner = booking.user._id.toString() === req.user.id.toString();

  if (req.user.role === 'user' && !isBookingOwner) {
    return next(new AppError('You can only cancel your own bookings', 403));
  }

  // Check cancellation rules (only for regular users, not agents/admins)
  if (req.user.role === 'user' && !booking.canBeCancelled()) {
    return next(
      new AppError('Bookings can only be cancelled 24 hours in advance', 400),
    );
  }

  // Handle the cancellation reason
  let cancellationReason = '';
  if (req.body.cancellationReason) {
    if (typeof req.body.cancellationReason === 'string') {
      cancellationReason = req.body.cancellationReason;
    } else if (typeof req.body.cancellationReason === 'object') {
      cancellationReason = JSON.stringify(req.body.cancellationReason);
    }
  }

  // Update the booking
  const updateData = {
    status: 'cancelled',
  };

  if (cancellationReason) {
    updateData.cancellationReason = cancellationReason;
  }

  const updatedBooking = await Booking.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true },
  );

  res.status(200).json({
    status: 'success',
    data: {
      booking: updatedBooking,
    },
    message: 'Booking cancelled successfully',
  });
});

exports.completeBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return next(new AppError('No booking found with that ID', 404));
  }

  // Only agent or admin can mark as completed
  if (
    req.user.role !== 'agent' &&
    req.user.role !== 'admin' &&
    booking.agent.toString() !== req.user.id.toString()
  ) {
    return next(
      new AppError('Only assigned agent or admin can complete bookings', 403),
    );
  }

  booking.status = 'completed';
  await booking.save();

  res.status(200).json({
    status: 'success',
    data: {
      booking,
    },
  });
});

// ======================
// AVAILABILITY & SCHEDULING
// ======================

exports.checkAvailability = catchAsync(async (req, res, next) => {
  const { propertyId, date, startTime, endTime } = req.body;

  if (!propertyId || !date || !startTime || !endTime) {
    return next(
      new AppError(
        'Please provide propertyId, date, startTime, and endTime',
        400,
      ),
    );
  }

  const isAvailable = await Booking.checkAvailability(propertyId, date, {
    start: startTime,
    end: endTime,
  });

  res.status(200).json({
    status: 'success',
    data: {
      available: isAvailable,
    },
  });
});

exports.getAgentSchedule = catchAsync(async (req, res, next) => {
  const agentId = req.params.agentId || req.user.id;
  const { date } = req.query;

  let filter = { agent: agentId };

  if (date) {
    filter.date = new Date(date);
  } else {
    // Default to today's schedule
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    filter.date = { $gte: today };
  }

  const bookings = await Booking.find(filter)
    .select('property date timeSlot status user')
    .sort('date timeSlot.start');

  res.status(200).json({
    status: 'success',
    results: bookings.length,
    data: {
      schedule: bookings,
    },
  });
});

// ======================
// STATISTICS & ANALYTICS
// ======================

exports.getBookingStats = catchAsync(async (req, res, next) => {
  const stats = await Booking.aggregate([
    {
      $match: { isActive: { $ne: false } },
    },
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        pendingBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
        },
        confirmedBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] },
        },
        completedBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        cancelledBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
        },
        upcomingBookings: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'confirmed'] },
                  { $gt: ['$date', new Date()] },
                ],
              },
              1,
              0,
            ],
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

exports.getMonthlyBookings = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1 || new Date().getFullYear();

  const monthlyStats = await Booking.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
        isActive: { $ne: false },
      },
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        count: { $sum: 1 },
        revenue: { $sum: '$price' },
        confirmedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] },
        },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      monthlyStats,
    },
  });
});

// ======================
// HELPER FUNCTIONS
// ======================

const filterBookingUpdates = (body, userRole) => {
  const allowedFields = [];

  if (userRole === 'user') {
    allowedFields.push(
      'date',
      'timeSlot',
      'message',
      'contactPreference',
      'numberOfPersons',
    );
  } else if (userRole === 'agent') {
    allowedFields.push('status', 'agent', 'date', 'timeSlot', 'message');
  } else if (userRole === 'admin') {
    allowedFields.push(
      'status',
      'agent',
      'date',
      'timeSlot',
      'message',
      'price',
      'paymentStatus',
    );
  }

  const filteredBody = {};
  allowedFields.forEach((field) => {
    if (body[field] !== undefined) {
      filteredBody[field] = body[field];
    }
  });

  return filteredBody;
};

const checkStatusChangePermission = (currentStatus, newStatus, userRole) => {
  const allowedTransitions = {
    user: {
      pending: ['cancelled'],
      confirmed: ['cancelled'],
    },
    agent: {
      pending: ['confirmed', 'rejected'],
      confirmed: ['completed', 'cancelled'],
    },
    admin: {
      pending: ['confirmed', 'rejected', 'cancelled'],
      confirmed: ['completed', 'cancelled'],
      completed: [],
      cancelled: ['pending'], // Admin can resurrect cancelled bookings
    },
  };

  return (
    allowedTransitions[userRole]?.[currentStatus]?.includes(newStatus) || false
  );
};

// Email helper functions (you'll need to implement these)

const sendBookingConfirmationEmail = async (booking) => {
  const bookingDate = booking.date
    ? new Date(booking.date).toLocaleDateString()
    : 'To be scheduled';

  let subject = 'Booking Received';
  let content = '';

  if (booking.bookingType === 'viewing') {
    content = `Your viewing for <strong>${booking.property?.title || 'Property'}</strong> on <strong>${bookingDate}</strong> has been received.`;
  } else if (booking.bookingType === 'purchase') {
    subject = 'Purchase Intent Received';
    content = `Your purchase intent for <strong>${booking.property?.title || 'Property'}</strong> has been received. An agent will contact you shortly.`;
  } else if (booking.bookingType === 'rental') {
    subject = 'Rental Inquiry Received';
    content = `Your rental inquiry for <strong>${booking.property?.title || 'Property'}</strong> has been received. An agent will contact you shortly.`;
  }

  const html = `
    <h1>${subject}</h1>
    <p>Hi ${booking.user?.name || 'User'},</p>
    <p>${content}</p>
    <p>Status: ${booking.status}</p>
    <p>Thank you for using our service!</p>
  `;

  if (booking.user?.email) {
    await sendEmail({
      to: booking.user.email,
      subject: subject,
      html,
    });
  }
};

const sendBookingConfirmedEmail = async (booking) => {
  const bookingDate = booking.date
    ? booking.date.toLocaleDateString()
    : 'To be scheduled';

  const html = `
    <h1>Booking Confirmed</h1>
    <p>Hi ${booking.user.name},</p>
    <p>Your booking for <strong>${booking.property.title}</strong><br/>
    Date: <strong>${bookingDate}</strong></p>
    <p>Agent: ${booking.agent?.name || 'Not assigned'}</p>
    <p>Thank you for using our service!</p>
  `;

  await sendEmail({
    to: booking.user.email,
    subject: 'Booking Confirmed',
    html,
  });
};

exports.approveBooking = catchAsync(async (req, res, next) => {
  req.params.id = req.params.id; // make sure id is passed
  // reuse confirmBooking logic
  await exports.confirmBooking(req, res, next);
});

exports.agentRejectBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) return next(new AppError('Booking not found', 404));

  // Only assigned agent or admin can reject
  if (
    req.user.role !== 'agent' &&
    req.user.role !== 'admin' &&
    booking.agent.toString() !== req.user.id
  ) {
    return next(new AppError('Not authorized to reject this booking', 403));
  }

  booking.status = 'rejected';
  if (req.body.reason) booking.cancellationReason = req.body.reason;
  await booking.save();

  await notificationController.createBookingNotification(booking, 'rejected');

  // Send rejection email to user (optional)
  try {
    await sendEmail({
      to: booking.user.email,
      subject: 'Booking Rejected',
      html: `<p>Your booking for <strong>${booking.property.title}</strong> has been rejected by the agent.</p>
             <p>Reason: ${req.body.reason || 'Not specified'}</p>`,
    });
  } catch (err) {
    console.log('Email failed:', err.message);
  }

  res.status(200).json({
    status: 'success',
    data: { booking },
    message: 'Booking rejected successfully',
  });
});

exports.confirmPayment = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) return next(new AppError('Booking not found', 404));

  // Only agent/admin can confirm payment
  if (
    req.user.role !== 'agent' &&
    req.user.role !== 'admin' &&
    booking.agent.toString() !== req.user.id
  ) {
    return next(new AppError('Not authorized to confirm payment', 403));
  }

  booking.paymentStatus = 'paid';
  booking.status = 'paid';

  await booking.save();

  await notificationController.createBookingNotification(booking, 'paid');

  // Notify user about payment
  try {
    await sendEmail({
      to: booking.user.email,
      subject: 'Payment Confirmed',
      html: `<p>Your payment for <strong>${booking.property.title}</strong> has been confirmed.</p>`,
    });
  } catch (err) {
    console.log('Email failed:', err.message);
  }

  res.status(200).json({
    status: 'success',
    data: { booking },
    message: 'Payment confirmed successfully',
  });
});
