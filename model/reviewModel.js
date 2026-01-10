const mongoose = require('mongoose');

const slugify = require('slugify');

const reviewSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.ObjectId,
      ref: 'Property',
      required: [true, 'A review must belong to a property'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    slug: String,
    rating: {
      type: Number,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      required: [true, 'A review must have a rating'],
      set: (val) => Math.round(val * 10) / 10,
    },
    comment: {
      type: String,
      trim: true,
      required: [true, 'A review must have a comment'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
    // status: {
    //   type: String,
    //   enum: ['pending', 'approved', 'rejected'],
    //   default: 'pending',
    // },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for better query performance
reviewSchema.index({ property: 1, user: 1 }, { unique: true }); // One review per property per user
reviewSchema.index({ rating: -1, createdAt: -1 });
reviewSchema.index({ property: 1, rating: -1 });

// Document middleware to create slug
// reviewSchema.pre('save', function (next) {
//   if (this.title) {
//     this.slug = slugify(`${this.title}-${Date.now()}`, {
//       lower: true,
//       strict: true,
//     });
//   }
//   next();
// });

// Query middleware to populate user info
reviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'name photo emailVerified', // Only select necessary fields
  });
  next();
});

// Virtual field for isRecent
reviewSchema.virtual('isRecent').get(function () {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return this.createdAt > thirtyDaysAgo;
});

// Static method to calculate average ratings
reviewSchema.statics.calcAverageRatings = async function (propertyId) {
  const stats = await this.aggregate([
    { $match: { property: propertyId } },
    {
      $group: {
        _id: '$property',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  if (stats.length > 0) {
    await mongoose.model('Property').findByIdAndUpdate(propertyId, {
      ratingQuantity: stats[0].nRating,
      ratingAverage: stats[0].avgRating,
    });
  } else {
    await mongoose.model('Property').findByIdAndUpdate(propertyId, {
      ratingQuantity: 0,
      ratingAverage: 4.5, // Default
    });
  }
};

// Call calcAverageRatings after saving a review
reviewSchema.post('save', function () {
  this.constructor.calcAverageRatings(this.property);
});

// Call calcAverageRatings after finding and updating/deleting
reviewSchema.post(/^findOneAnd/, async function (doc) {
  if (doc) {
    await doc.constructor.calcAverageRatings(doc.property);
  }
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
