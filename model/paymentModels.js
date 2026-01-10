const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: 'NGN',
    },

    provider: {
      type: String,
      enum: ['paystack'],
      required: true,
    },

    // Add this field
    paymentType: {
      type: String,
      enum: ['purchase', 'rental'],
      default: 'purchase',
    },

    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
      index: true,
    },

    authorizationUrl: {
      type: String,
    },

    paidAt: {
      type: Date,
    },

    rawResponse: {
      type: Object,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('Payment', paymentSchema);
