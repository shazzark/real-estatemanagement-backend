const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema(
  {
    // User who saved the property
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Wishlist must belong to a user'],
    },

    // Property saved to wishlist
    property: {
      type: mongoose.Schema.ObjectId,
      ref: 'Property',
      required: [true, 'Wishlist must have a property'],
    },

    // Optional notes about why they saved it
    notes: {
      type: String,
      trim: true,
      maxlength: [200, 'Notes cannot exceed 200 characters'],
    },

    // Categories/tags for organization
    tags: [
      {
        type: String,
        enum: ['favorite', 'considering', 'viewed', 'dream', 'investment'],
      },
    ],

    // Priority level (1-5 stars)
    priority: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },

    // When user wants to be reminded about this property
    reminderDate: Date,

    // Custom name for the saved item
    customName: {
      type: String,
      trim: true,
      maxlength: [50, 'Custom name cannot exceed 50 characters'],
    },

    // Metadata for tracking
    views: {
      type: Number,
      default: 0,
    },

    // Active status (for soft delete)
    isActive: {
      type: Boolean,
      default: true,
      select: true, // include it by default
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Compound unique index: one user can save a property only once
// wishlistSchema.index({ user: 1, property: 1 }, { unique: true });
// wishlistSchema.index({ user: 1, property: 1, isActive: 1 }, { unique: true });

wishlistSchema.index(
  { user: 1, property: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  },
);

// Indexes for better performance
wishlistSchema.index({ user: 1, createdAt: -1 });
wishlistSchema.index({ user: 1, priority: -1 });
wishlistSchema.index({ property: 1 });

// Virtual for checking if property is still available
wishlistSchema.virtual('isPropertyAvailable').get(async function () {
  const Property = mongoose.model('Property');
  const property = await Property.findById(this.property);
  return property && property.status === 'available' && property.isActive;
});

// Virtual for property details (will be populated)
wishlistSchema.virtual('propertyDetails', {
  ref: 'Property',
  localField: 'property',
  foreignField: '_id',
  justOne: true,
});

// Query middleware to populate property and filter active
wishlistSchema.pre(/^find/, function (next) {
  // Only show active wishlist items
  // this.find({ isActive: { $ne: false } });
  if (!this.getOptions().skipActiveFilter) {
    this.find({ isActive: { $ne: false } });
  }

  // Always populate property details
  this.populate({
    path: 'property',
    select:
      'title price address images status propertyType listingType bedrooms bathrooms area',
  });

  next();
});

// Document middleware to increment property's wishlist count
wishlistSchema.post('save', async function () {
  const Property = mongoose.model('Property');
  await Property.findByIdAndUpdate(this.property, {
    $inc: { wishlistCount: 1 },
  });
});

// Document middleware to decrement property's wishlist count on remove
wishlistSchema.post(/^findOneAndDelete|findOneAndRemove/, async function (doc) {
  if (doc) {
    const Property = mongoose.model('Property');
    await Property.findByIdAndUpdate(doc.property, {
      $inc: { wishlistCount: -1 },
    });
  }
});

// Static method to check if property is in user's wishlist
wishlistSchema.statics.isInWishlist = async function (userId, propertyId) {
  const item = await this.findOne({
    user: userId,
    property: propertyId,
    isActive: { $ne: false },
  });

  return !!item;
};

// Static method to get user's wishlist count
wishlistSchema.statics.getWishlistCount = async function (userId) {
  return await this.countDocuments({
    user: userId,
    isActive: { $ne: false },
  });
};

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

module.exports = Wishlist;
