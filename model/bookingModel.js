const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.ObjectId,
      ref: 'Property',
      required: [true, 'Booking must belong to a property'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Booking must belong to a user'],
    },
    agent: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      // required: [true, 'Booking must have an assigned agent'],
    },
    bookingType: {
      type: String,
      enum: ['viewing', 'inquiry', 'rental', 'purchase'],
      default: 'viewing',
      required: true,
    },
    status: {
      type: String,
      enum: [
        'pending',
        'agent_confirmed',
        'payment_pending',
        'paid',
        'completed',
        'cancelled',
        'rejected',
        'property_sold',
      ],
      default: 'pending',
    },

    date: {
      type: Date,
      required: function () {
        return this.bookingType === 'viewing';
      },
    },

    timeSlot: {
      start: {
        type: String,
        required: function () {
          return this.bookingType === 'viewing';
        },
      },
      end: {
        type: String,
        required: function () {
          return this.bookingType === 'viewing';
        },
      },
    },

    duration: {
      type: Number, // in minutes
      default: 60,
      min: [15, 'Duration must be at least 15 minutes'],
      max: [240, 'Duration cannot exceed 4 hours'],
    },
    message: {
      type: String,
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    contactPreference: {
      type: String,
      enum: ['phone', 'email', 'whatsapp'],
      default: 'phone',
    },
    numberOfPersons: {
      type: Number,
      min: [1, 'At least one person is required'],
      max: [10, 'Cannot exceed 10 persons'],
      default: 1,
    },
    price: {
      type: Number,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'pending', 'paid'],
      default: 'unpaid',
    },

    specialRequirements: String,
    cancellationReason: String,
    isActive: {
      type: Boolean,
      default: true,
      select: false,
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for better performance
bookingSchema.index({ property: 1, date: 1 });
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ agent: 1, date: 1 });
bookingSchema.index({ status: 1, date: 1 });
bookingSchema.index({ date: 1 }); // For scheduling queries

bookingSchema.virtual('isUpcoming').get(function () {
  if (!this.date) return false;
  return this.date > new Date() && this.status === 'confirmed';
});

bookingSchema.virtual('isToday').get(function () {
  if (!this.date) return false;
  const today = new Date();
  const bookingDate = new Date(this.date);
  return (
    bookingDate.getDate() === today.getDate() &&
    bookingDate.getMonth() === today.getMonth() &&
    bookingDate.getFullYear() === today.getFullYear() &&
    this.status === 'confirmed'
  );
});

// Virtual for formatted date
bookingSchema.virtual('formattedDate').get(function () {
  if (!this.date) return null; // Add this check!
  return this.date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
});

// Document middleware to auto-assign agent if not provided
bookingSchema.pre('save', async function (next) {
  if (!this.agent && this.property) {
    try {
      const Property = mongoose.model('Property');
      const property = await Property.findById(this.property).select('agent');
      if (property && property.agent) {
        this.agent = property.agent;
      }
    } catch (err) {
      // If can't auto-assign, will throw validation error
    }
  }
  next();
});

// Query middleware to populate references
bookingSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'property',
    select: 'title price address images status',
  })
    .populate({
      path: 'user',
      select: 'name email phone photo',
    })
    .populate({
      path: 'agent',
      select: 'name email phone photo',
    });

  next();
});

// Query middleware to filter out inactive bookings
bookingSchema.pre(/^find/, function (next) {
  this.find({ isActive: { $ne: false } });
  next();
});

// Static method to check availability
bookingSchema.statics.checkAvailability = async function (
  propertyId,
  date,
  timeSlot,
) {
  const startTime = new Date(`${date}T${timeSlot.start}`);
  const endTime = new Date(`${date}T${timeSlot.end}`);

  const conflictingBooking = await this.findOne({
    property: propertyId,
    date: new Date(date),
    status: { $in: ['confirmed', 'pending'] },
    $or: [
      {
        $and: [
          { 'timeSlot.start': { $lt: timeSlot.end } },
          { 'timeSlot.end': { $gt: timeSlot.start } },
        ],
      },
    ],
  });

  return !conflictingBooking;
};

// Instance method to check if booking can be cancelled
// bookingSchema.methods.canBeCancelled = function () {
//   const now = new Date();
//   const bookingTime = new Date(this.date);
//   const hoursDifference = (bookingTime - now) / (1000 * 60 * 60);

//   return hoursDifference > 24 && this.status === 'confirmed';
// };

// In your bookingModel.js
bookingSchema.methods.canBeCancelled = function () {
  // Allow cancellation of pending bookings
  if (this.status === 'pending') {
    return true;
  }

  // If no date is set, allow cancellation
  if (!this.date) {
    return true;
  }

  // For confirmed bookings with dates, check if it's more than 24 hours away
  if (this.status === 'confirmed') {
    const now = new Date();
    const bookingTime = new Date(this.date);
    const hoursDifference = (bookingTime - now) / (1000 * 60 * 60);
    return hoursDifference > 24;
  }

  return false;
};

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;
