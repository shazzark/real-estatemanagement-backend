const crypto = require('crypto');
const axios = require('axios');
const Payment = require('../model/paymentModels');
const Booking = require('../model/bookingModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// exports.initializePayment = catchAsync(async (req, res, next) => {
//   try {
//     const { bookingId } = req.params;
//     const { type = 'purchase' } = req.body;

//     console.log('Payment initialization started:', { bookingId, type });

//     // 1️⃣ Fetch booking with property
//     const booking = await Booking.findById(bookingId)
//       .populate('property')
//       .populate('user', 'email');

//     if (!booking) {
//       return next(new AppError('Booking not found', 404));
//     }

//     console.log('Booking found:', booking._id);

//     // 2️⃣ Ownership check
//     if (booking.user._id.toString() !== req.user.id) {
//       return next(
//         new AppError('You are not allowed to pay for this booking', 403),
//       );
//     }

//     // 3️⃣ Business rules for different types
//     if (type === 'purchase') {
//       if (booking.bookingType !== 'purchase') {
//         return next(new AppError('Payment type mismatch', 400));
//       }
//       if (booking.status !== 'agent_confirmed') {
//         return next(new AppError('Purchase not confirmed by agent', 400));
//       }
//     } else if (type === 'rental') {
//       if (booking.bookingType !== 'rental') {
//         return next(new AppError('Payment type mismatch', 400));
//       }
//       if (booking.status !== 'agent_confirmed') {
//         return next(new AppError('Rental not confirmed by agent', 400));
//       }
//     } else {
//       return next(new AppError('Invalid payment type', 400));
//     }

//     if (booking.paymentStatus === 'paid') {
//       return next(new AppError('Booking already paid', 400));
//     }

//     // 4️⃣ Calculate amount based on type
//     let paymentAmount = booking.price || 0;

//     if (type === 'rental') {
//       // For rentals: security deposit + first month rent + processing fee
//       const monthlyRent = booking.price || booking.property?.price || 0;
//       paymentAmount = Math.round(monthlyRent * 1.5 + monthlyRent + 10000); // 1.5x deposit + rent + fee
//     }

//     // Ensure amount is valid
//     if (!paymentAmount || paymentAmount <= 0) {
//       return next(new AppError('Invalid payment amount', 400));
//     }

//     // Convert to kobo (smallest currency unit for Paystack)
//     const amountInKobo = paymentAmount * 100;

//     // Paystack requires amount to be at least 100 kobo (₦1)
//     if (amountInKobo < 100) {
//       return next(new AppError('Amount must be at least ₦1', 400));
//     }

//     console.log('Payment amount:', { paymentAmount, amountInKobo });

//     // 5️⃣ Generate reference
//     const reference = `ESTATE_${booking._id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

//     // 6️⃣ Create payment record (PENDING)
//     const payment = await Payment.create({
//       booking: booking._id,
//       user: req.user.id,
//       amount: paymentAmount,
//       paymentType: type,
//       provider: 'paystack',
//       reference,
//       status: 'pending',
//     });

//     console.log('Payment record created:', payment._id);

//     // 7️⃣ Call Paystack with proper error handling
//     const paystackPayload = {
//       email: req.user.email,
//       amount: amountInKobo,
//       reference,
//       metadata: {
//         bookingId: booking._id.toString(),
//         paymentId: payment._id.toString(),
//         type: type,
//         propertyId: booking.property?._id?.toString(),
//         userId: req.user.id.toString(),
//       },
//       callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback?type=${type}`,
//     };

//     console.log('Sending to Paystack:', {
//       email: req.user.email,
//       amount: amountInKobo,
//       reference,
//       callback_url: paystackPayload.callback_url,
//     });

//     const paystackResponse = await axios.post(
//       'https://api.paystack.co/transaction/initialize',
//       paystackPayload,
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//           'Content-Type': 'application/json',
//         },
//         timeout: 10000, // 10 second timeout
//       },
//     );

//     console.log('Paystack response status:', paystackResponse.status);
//     console.log('Paystack response data:', paystackResponse.data);

//     if (!paystackResponse.data.status) {
//       throw new Error(paystackResponse.data.message || 'Paystack API error');
//     }

//     if (!paystackResponse.data.data.authorization_url) {
//       throw new Error('No authorization URL received from Paystack');
//     }

//     // 8️⃣ Save authorization URL
//     payment.authorizationUrl = paystackResponse.data.data.authorization_url;
//     await payment.save();

//     // 9️⃣ Return URL to frontend
//     res.status(200).json({
//       status: 'success',
//       data: {
//         authorizationUrl: payment.authorizationUrl,
//         reference: payment.reference,
//         amount: paymentAmount,
//         type: type,
//         currency: 'NGN',
//       },
//     });
//   } catch (error) {
//     console.error('Payment initialization error:', {
//       message: error.message,
//       stack: error.stack,
//       response: error.response?.data,
//     });

//     // Handle specific Paystack errors
//     if (error.response) {
//       console.error('Paystack API error details:', error.response.data);

//       // Return more specific error message
//       return next(
//         new AppError(
//           `Paystack error: ${error.response.data.message || 'Payment initialization failed'}`,
//           error.response.status || 400,
//         ),
//       );
//     }

//     // Handle network or other errors
//     return next(
//       new AppError(error.message || 'Payment initialization failed', 500),
//     );
//   }
// });

exports.initializePayment = catchAsync(async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { type = 'purchase' } = req.body;

    console.log('Payment initialization started:', { bookingId, type });

    // Fetch booking
    const booking = await Booking.findById(bookingId)
      .populate('property')
      .populate('user', 'email');

    if (!booking) {
      return next(new AppError('Booking not found', 404));
    }

    // Ownership check
    if (booking.user._id.toString() !== req.user.id) {
      return next(
        new AppError('You are not allowed to pay for this booking', 403),
      );
    }

    // Business rules
    if (type === 'purchase' && booking.bookingType !== 'purchase') {
      return next(new AppError('Payment type mismatch', 400));
    }
    if (type === 'rental' && booking.bookingType !== 'rental') {
      return next(new AppError('Payment type mismatch', 400));
    }

    if (booking.status !== 'agent_confirmed') {
      return next(new AppError('Booking not confirmed by agent', 400));
    }

    if (booking.paymentStatus === 'paid') {
      return next(new AppError('Booking already paid', 400));
    }

    // Calculate amount with development override
    let paymentAmount = booking.price || 0;

    if (type === 'rental') {
      const monthlyRent = booking.price || booking.property?.price || 0;
      paymentAmount = Math.round(monthlyRent * 1.5 + monthlyRent + 10000);
    }

    // DEVELOPMENT OVERRIDE - Use small test amounts
    if (process.env.NODE_ENV === 'development') {
      console.log('DEVELOPMENT MODE: Using test amounts');

      if (paymentAmount > 10000) {
        // If amount is > ₦100
        // Scale down the amount for testing
        const originalAmount = paymentAmount;
        paymentAmount = Math.min(5000, Math.round(paymentAmount / 100)); // Max ₦50 for testing

        console.log(
          `Amount scaled from ₦${originalAmount.toLocaleString()} to ₦${paymentAmount.toLocaleString()} for testing`,
        );
      }
    }

    // Ensure amount is valid
    if (!paymentAmount || paymentAmount <= 0) {
      return next(new AppError('Invalid payment amount', 400));
    }

    // Paystack requires at least ₦1 (100 kobo)
    const amountInKobo = paymentAmount * 100;
    if (amountInKobo < 100) {
      paymentAmount = 1; // Set to minimum ₦1
    }

    // Generate reference
    const reference = `ESTATE_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Create payment record
    const payment = await Payment.create({
      booking: booking._id,
      user: req.user.id,
      amount: paymentAmount,
      paymentType: type,
      provider: 'paystack',
      reference,
      status: 'pending',
    });

    // Paystack payload
    const paystackPayload = {
      email: req.user.email,
      amount: paymentAmount * 100, // Convert to kobo
      reference,
      metadata: {
        bookingId: booking._id.toString(),
        paymentId: payment._id.toString(),
        type: type,
        propertyId: booking.property?._id?.toString(),
        userId: req.user.id.toString(),
      },
      callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback?type=${type}&ref=${reference}`,
    };

    console.log('Paystack request:', {
      amount: paystackPayload.amount,
      email: paystackPayload.email.substring(0, 10) + '...', // Log partial email
      reference: paystackPayload.reference,
    });

    // Call Paystack
    const paystackResponse = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      paystackPayload,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    );

    if (!paystackResponse.data.status) {
      throw new Error(paystackResponse.data.message || 'Paystack API error');
    }

    // Save authorization URL
    payment.authorizationUrl = paystackResponse.data.data.authorization_url;
    await payment.save();

    res.status(200).json({
      status: 'success',
      data: {
        authorizationUrl: payment.authorizationUrl,
        reference: payment.reference,
        amount: paymentAmount,
        type: type,
        currency: 'NGN',
      },
    });
  } catch (error) {
    console.error('Payment error details:', {
      message: error.message,
      response: error.response?.data,
      amount: paymentAmount, // Check what amount was sent
    });

    // Handle Paystack amount restriction
    if (
      error.response?.data?.message?.includes('Watch your spending') ||
      error.response?.data?.message?.includes('Amount cannot be processed')
    ) {
      return next(
        new AppError(
          'Amount too high for test mode. Please use smaller amounts for testing.',
          400,
        ),
      );
    }

    return next(
      new AppError(
        error.response?.data?.message || error.message || 'Payment failed',
        error.response?.status || 500,
      ),
    );
  }
});

exports.paystackWebhook = catchAsync(async (req, res, next) => {
  try {
    const signature = req.headers['x-paystack-signature'];

    // Get the raw body
    const rawBody = req.body;

    // Verify signature
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      console.error('Webhook signature verification failed');
      return res
        .status(401)
        .json({ received: false, message: 'Invalid signature' });
    }

    // Parse the event
    const event = JSON.parse(rawBody.toString());

    console.log('Webhook received:', event.event);

    // Handle failed payments
    if (event.event === 'charge.failed') {
      await Payment.findOneAndUpdate(
        { reference: event.data.reference },
        {
          status: 'failed',
          rawResponse: event,
        },
      );

      return res.status(200).json({ received: true });
    }

    // Ignore unrelated events
    if (event.event !== 'charge.success') {
      return res.status(200).json({ received: true });
    }

    const { reference, metadata } = event.data;
    const { bookingId, paymentId } = metadata || {};

    if (!bookingId || !paymentId) {
      console.error('Missing metadata in webhook:', metadata);
      return res.status(200).json({ received: true });
    }

    // Fetch payment
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      console.error('Payment not found:', paymentId);
      return res.status(200).json({ received: true });
    }

    if (payment.status === 'success') {
      return res.status(200).json({ received: true });
    }

    // Update payment
    payment.status = 'success';
    payment.paidAt = new Date();
    payment.rawResponse = event;
    await payment.save();

    // Update booking
    const booking = await Booking.findById(bookingId).populate('property');
    if (!booking) {
      console.error('Booking not found:', bookingId);
      return res.status(200).json({ received: true });
    }

    booking.paymentStatus = 'paid';
    booking.status = 'completed';
    await booking.save();

    // Mark property as sold for purchases
    if (payment.paymentType === 'purchase' && booking.property) {
      booking.property.status = 'sold';
      await booking.property.save();
    }

    // For rentals, mark property as rented
    if (payment.paymentType === 'rental' && booking.property) {
      booking.property.status = 'rented';
      await booking.property.save();
    }

    console.log('Payment completed successfully:', reference);

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ received: false, message: error.message });
  }
});

exports.verifyPayment = catchAsync(async (req, res, next) => {
  const { reference } = req.params;

  const payment = await Payment.findOne({ reference }).populate('booking');

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  // Ownership check
  if (payment.user.toString() !== req.user.id) {
    return next(new AppError('Not authorized', 403));
  }

  return res.status(200).json({
    status: 'success',
    data: {
      paymentStatus: payment.status,
      bookingStatus: payment.booking?.status,
      paymentType: payment.paymentType,
      amount: payment.amount,
      paidAt: payment.paidAt,
    },
  });
});
