const User = require('../model/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

/**
 * USER applies to become an agent
 */
// exports.applyForAgent = catchAsync(async (req, res, next) => {
//   if (req.user.role !== 'user') {
//     return next(new AppError('Only users can apply to become agents', 400));
//   }

//   if (req.user.agentStatus === 'pending') {
//     return next(new AppError('Your application is already pending', 400));
//   }

//   const updatedUser = await User.findByIdAndUpdate(
//     req.user.id,
//     {
//       agency: req.body.agency,
//       specialization: req.body.specialization,
//       bio: req.body.bio,
//       phone: req.body.phone,
//       agentStatus: 'pending',
//     },
//     { new: true, runValidators: true },
//   );

//   res.status(200).json({
//     status: 'success',
//     message: 'Agent application submitted',
//     data: {
//       user: updatedUser,
//     },
//   });
// });

exports.applyForAgent = catchAsync(async (req, res, next) => {
  console.log('=== APPLY FOR AGENT CALLED ===');
  console.log('User ID:', req.user.id);
  console.log('User role:', req.user.role);
  console.log('User agentStatus:', req.user.agentStatus);
  console.log('Request body:', req.body);

  try {
    if (req.user.role !== 'user') {
      console.log('Error: User role is not "user"');
      return next(new AppError('Only users can apply to become agents', 400));
    }

    if (req.user.agentStatus === 'pending') {
      console.log('Error: Already has pending application');
      return next(new AppError('Your application is already pending', 400));
    }

    console.log('Updating user...');
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        agency: req.body.agency,
        specialization: req.body.specialization,
        bio: req.body.bio,
        phone: req.body.phone,
        agentStatus: 'pending',
      },
      { new: true, runValidators: true },
    );

    console.log('User updated successfully:', updatedUser._id);

    res.status(200).json({
      status: 'success',
      message: 'Agent application submitted',
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    console.log('Error in applyForAgent:', error.message);
    console.log('Stack trace:', error.stack);
    next(error);
  }
});

/**
 * ADMIN approves agent
 */
exports.approveAgent = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  if (user.agentStatus !== 'pending') {
    return next(new AppError('User has not applied for agent role', 400));
  }

  user.role = 'agent';
  user.agentStatus = 'approved';
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'Agent approved',
    data: {
      user,
    },
  });
});

/**
 * ADMIN rejects agent
 */
exports.rejectAgent = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  user.agentStatus = 'rejected';
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'Agent application rejected',
  });
});

/**
 * ADMIN fetch pending agents
 */
exports.getPendingAgents = catchAsync(async (req, res, next) => {
  const agents = await User.find({
    agentStatus: 'pending',
  });

  res.status(200).json({
    status: 'success',
    results: agents.length,
    data: {
      agents,
    },
  });
});
