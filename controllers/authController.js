const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../model/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const sendEmail = require('../utils/email');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// const createSendToken = (user, statusCode, res) => {
//   const token = signToken(user._id);

//   const cookieOptions = {
//     expires: new Date(
//       Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
//     ),
//     httpOnly: true,
//     secure: process.env.NODE_ENV === 'production',
//     sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
//   };

//   res.cookie('jwt', token, cookieOptions);

//   // Remove password from output
//   user.password = undefined;

//   res.status(statusCode).json({
//     status: 'success',
//     token,
//     data: {
//       user,
//     },
//   });
// };

// const createSendToken = (user, statusCode, res) => {
//   const token = signToken(user._id);
//   const isLocalhost =
//     res.req.headers.origin?.includes('localhost') ||
//     res.req.headers.origin?.includes('127.0.0.1');

//   const cookieOptions = {
//     expires: new Date(
//       Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
//     ),
//     httpOnly: true,
//     // secure: process.env.NODE_ENV === 'production',
//     secure: !isLocalhost,
//     sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
//   };

//   res.cookie('jwt', token, cookieOptions);

//   user.password = undefined; // remove password from output

//   res.status(statusCode).json({
//     status: 'success',
//     token,
//     data: { user },
//   });
// };
// const createSendToken = (user, statusCode, res) => {
//   const token = signToken(user._id);

//   const origin = res.req.headers.origin || '';
//   const isLocalhost =
//     origin.includes('localhost') || origin.includes('127.0.0.1');

//   const cookieOptions = {
//     httpOnly: true,
//     expires: new Date(
//       Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
//     ),
//     secure: !isLocalhost,
//     sameSite: !isLocalhost ? 'none' : 'lax',
//   };

//   res.cookie('jwt', token, cookieOptions);

//   user.password = undefined;

//   res.status(statusCode).json({
//     status: 'success',
//     token,
//     data: { user },
//   });
// };

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);

  // ✅ FIXED: Simple development/production detection
  const isProduction = process.env.NODE_ENV === 'production';

  const cookieOptions = {
    httpOnly: true,
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    secure: isProduction, // false in development (localhost)
    sameSite: isProduction ? 'none' : 'lax', // 'lax' for localhost
  };

  // ✅ DEBUG: Log cookie settings
  console.log('Cookie Settings:', {
    NODE_ENV: process.env.NODE_ENV,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    origin: req.headers.origin,
  });

  res.cookie('jwt', token, cookieOptions);
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: { user },
  });
};
// const createSendToken = (user, statusCode, req, res) => {
//   const token = signToken(user._id);

//   const origin = req.headers.origin || '';
//   const isLocalhost =
//     origin.includes('localhost') ||
//     origin.includes('127.0.0.1') ||
//     origin.includes('::1');

//   const cookieOptions = {
//     httpOnly: true,
//     expires: new Date(
//       Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
//     ),
//     secure: !isLocalhost,
//     sameSite: !isLocalhost ? 'none' : 'lax',
//   };

//   res.cookie('jwt', token, cookieOptions);

//   user.password = undefined;

//   res.status(statusCode).json({
//     status: 'success',
//     token,
//     data: { user },
//   });
// };

// ======================
// AUTH CONTROLLERS
// ======================

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    phone: req.body.phone,
    role: 'user', // force default role
    agentStatus: 'none',
  });

  // Generate verification token
  const verificationToken = newUser.createVerificationToken();
  await newUser.save({ validateBeforeSave: false });

  try {
    const verificationUrl = `${req.protocol}://${req.get(
      'host',
    )}/api/v1/users/verifyEmail/${verificationToken}`;

    await sendEmail({
      email: newUser.email,
      subject: 'Welcome to Estate Management - Verify Your Email',
      message: `Welcome ${newUser.name}! Please verify your email by clicking: ${verificationUrl}`,
    });
  } catch (err) {
    console.log('Could not send verification email:', err.message);
  }

  createSendToken(newUser, 201, req, res);
});

// exports.login = catchAsync(async (req, res, next) => {
//   const { email, password } = req.body;

//   // 1) Check if email and password exist
//   if (!email || !password) {
//     return next(new AppError('Please provide email and password', 400));
//   }

//   // 2) Check if user exists && password is correct
//   const user = await User.findOne({ email }).select('+password');

//   if (!user || !(await user.correctPassword(password, user.password))) {
//     return next(new AppError('Incorrect email or password', 401));
//   }

//   // 3) If everything ok, send token to client
//   createSendToken(user, 200, res);
// });

// exports.logout = (req, res) => {
//   res.cookie('jwt', 'loggedout', {
//     expires: new Date(Date.now() + 10 * 1000),
//     httpOnly: true,
//   });

//   res.status(200).json({ status: 'success' });
// };

// exports.login = catchAsync(async (req, res, next) => {
//   const { email, password } = req.body;

//   if (!email || !password) {
//     return next(new AppError('Please provide email and password', 400));
//   }

//   const user = await User.findOne({ email }).select('+password');

//   if (!user || !(await user.correctPassword(password, user.password))) {
//     return next(new AppError('Incorrect email or password', 401));
//   }

//   createSendToken(user, 200, req, res);
// });

exports.login = catchAsync(async (req, res, next) => {
  console.log('🔐 LOGIN ATTEMPT ====================');
  console.log('Origin:', req.headers.origin);
  console.log('NODE_ENV:', process.env.NODE_ENV);

  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  console.log('✅ User authenticated:', user.email);

  createSendToken(user, 200, req, res);

  console.log('✅ Token sent to client');
  console.log('====================================\n');
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({ status: 'success' });
};

// ======================
// PROTECTION MIDDLEWARE
// ======================

// exports.protect = catchAsync(async (req, res, next) => {
//   // 1) Getting token and check if it's there
//   let token;
//   if (
//     req.headers.authorization &&
//     req.headers.authorization.startsWith('Bearer')
//   ) {
//     token = req.headers.authorization.split(' ')[1];
//   } else if (req.cookies.jwt) {
//     token = req.cookies.jwt;
//   }

//   if (!token) {
//     return next(
//       new AppError('You are not logged in! Please log in to get access.', 401),
//     );
//   }

//   // 2) Verification token
//   const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

//   // 3) Check if user still exists
//   const currentUser = await User.findById(decoded.id);
//   if (!currentUser) {
//     return next(
//       new AppError('The user belonging to this token no longer exists.', 401),
//     );
//   }

//   // 4) Check if user changed password after the token was issued
//   if (currentUser.changedPasswordAfter(decoded.iat)) {
//     return next(
//       new AppError('User recently changed password! Please log in again.', 401),
//     );
//   }

//   // GRANT ACCESS TO PROTECTED ROUTE
//   req.user = currentUser;
//   res.locals.user = currentUser;
//   next();
// });

exports.protect = catchAsync(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(new AppError('You are not logged in!', 401));
  }

  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('User no longer exists.', 401));
  }

  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(new AppError('Password recently changed. Log in again.', 401));
  }

  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

// ======================
// AUTHORIZATION MIDDLEWARE
// ======================

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403),
      );
    }
    next();
  };
};

// ======================
// PASSWORD RESET / UPDATE
// ======================

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return next(new AppError('No user with that email', 404));

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${req.protocol}://${req.get(
    'host',
  )}/api/v1/users/resetPassword/${resetToken}`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Password Reset Token',
      message: `Reset your password: ${resetUrl}`,
    });
    res.status(200).json({ status: 'success', message: 'Token sent to email' });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError('Error sending email. Try again later!', 500));
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) return next(new AppError('Token invalid or expired', 400));

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('+password');

  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Current password wrong', 401));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  createSendToken(user, 200, res);
});

// ======================
// EMAIL VERIFICATION
// ======================

exports.requireEmailVerification = catchAsync(async (req, res, next) => {
  if (!req.user.emailVerified) {
    return next(new AppError('Please verify your email to access this.', 403));
  }
  next();
});

exports.sendVerificationEmail = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (user.emailVerified)
    return next(new AppError('Email already verified', 400));

  const verificationToken = user.createVerificationToken();
  await user.save({ validateBeforeSave: false });

  const verificationUrl = `${req.protocol}://${req.get(
    'host',
  )}/api/v1/users/verifyEmail/${verificationToken}`;

  await sendEmail({
    email: user.email,
    subject: 'Verify your email address',
    message: `Click to verify: ${verificationUrl}`,
  });

  res.status(200).json({
    status: 'success',
    message: 'Verification email sent!',
  });
});

exports.verifyEmail = catchAsync(async (req, res, next) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({ verificationToken: hashedToken });

  if (!user)
    return next(new AppError('Invalid or expired verification token', 400));

  user.emailVerified = true;
  user.verificationToken = undefined;
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Email verified successfully!',
  });
});

//IN PRODUCTION EMAIL VERIFICATION

// exports.sendVerificationEmail = catchAsync(async (req, res, next) => {
//   // Get current user (from protect middleware)
//   const user = await User.findById(req.user.id);

//   // Check if already verified
//   if (user.emailVerified) {
//     return next(new AppError('Email is already verified', 400));
//   }

//   // Generate verification token using your existing method
//   const verificationToken = user.createVerificationToken();
//   await user.save({ validateBeforeSave: false });

//   // Create verification URL
//   const verificationUrl = `${req.protocol}://${req.get('host')}/api/v1/users/verify-email/${verificationToken}`;

//   // Create email message
//   const message = `Please verify your email address by clicking on this link: \n${verificationUrl}\n\nIf you didn't create an account, please ignore this email.`;

//   try {
//     await sendEmail({
//       email: user.email,
//       subject: 'Verify your email address - Estate Management',
//       message,
//     });

//     res.status(200).json({
//       status: 'success',
//       message: 'Verification email sent! Please check your inbox.',
//     });
//   } catch (err) {
//     // Reset token if email fails
//     user.verificationToken = undefined;
//     await user.save({ validateBeforeSave: false });

//     return next(
//       new AppError(
//         'There was an error sending the verification email. Please try again later.',
//         500,
//       ),
//     );
//   }
// });

// exports.verifyEmail = catchAsync(async (req, res, next) => {
//   // 1) Hash the token from URL
//   const hashedToken = crypto
//     .createHash('sha256')
//     .update(req.params.token)
//     .digest('hex');

//   // 2) Find user with this token
//   const user = await User.findOne({
//     verificationToken: hashedToken,
//   });

//   // 3) Check if token is valid
//   if (!user) {
//     return next(
//       new AppError('Verification token is invalid or has expired', 400),
//     );
//   }

//   // 4) Mark email as verified and clear token
//   user.emailVerified = true;
//   user.verificationToken = undefined;
//   await user.save();

//   res.status(200).json({
//     status: 'success',
//     message:
//       'Email verified successfully! You can now log in with full access.',
//   });
// });

// Optional: Auto-send verification on signup
// exports.signup = catchAsync(async (req, res, next) => {
//   const newUser = await User.create({
//     name: req.body.name,
//     email: req.body.email,
//     password: req.body.password,
//     passwordConfirm: req.body.passwordConfirm,
//     phone: req.body.phone,
//     role: req.body.role,
//     agency: req.body.agency,
//     specialization: req.body.specialization,
//     bio: req.body.bio,
//   });

//   // Generate verification token
//   const verificationToken = newUser.createVerificationToken();
//   await newUser.save({ validateBeforeSave: false });

//   // Send verification email (optional - can be done manually by user)
//   try {
//     const verificationUrl = `${req.protocol}://${req.get('host')}/api/v1/users/verify-email/${verificationToken}`;

//     await sendEmail({
//       email: newUser.email,
//       subject: 'Welcome to Estate Management - Verify Your Email',
//       message: `Welcome ${newUser.name}! Please verify your email by clicking: ${verificationUrl}`,
//     });
//   } catch (err) {
//     // Don't fail signup if email fails
//     console.log('Could not send verification email:', err.message);
//   }

//   createSendToken(newUser, 201, res);
// });

// exports.signup = catchAsync(async (req, res, next) => {
//   const newUser = await User.create({
//     name: req.body.name,
//     email: req.body.email,
//     password: req.body.password,
//     passwordConfirm: req.body.passwordConfirm,
//     phone: req.body.phone,

//     // IMPORTANT: force defaults
//     role: 'user',
//     agentStatus: 'none',
//   });

//   // Generate verification token
//   const verificationToken = newUser.createVerificationToken();
//   await newUser.save({ validateBeforeSave: false });

//   try {
//     const verificationUrl = `${req.protocol}://${req.get(
//       'host',
//     )}/api/v1/users/verify-email/${verificationToken}`;

//     await sendEmail({
//       email: newUser.email,
//       subject: 'Welcome to Estate Management - Verify Your Email',
//       message: `Welcome ${newUser.name}! Please verify your email by clicking: ${verificationUrl}`,
//     });
//   } catch (err) {
//     console.log('Could not send verification email:', err.message);
//   }

//   createSendToken(newUser, 201, res);
// });

// making email controller a requirement

// exports.requireEmailVerification = catchAsync(async (req, res, next) => {
//   // Check if user's email is verified
//   if (!req.user.emailVerified) {
//     return next(
//       new AppError(
//         'Please verify your email address to access this resource.',
//         403,
//       ),
//     );
//   }
//   next();
// });

// ======================
// USER MANAGEMENT
// ======================

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};
