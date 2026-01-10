const mongoose = require('mongoose');
const slugify = require('slugify');

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'A property must have a title'],
      trim: true,
      unique: true,
      maxlength: [100, 'Property title must be less than 100 characters'],
      minlength: [10, 'Property title must be at least 10 characters'],
    },
    slug: String,
    description: {
      type: String,
      required: [true, 'A property must have a description'],
      trim: true,
      minlength: [50, 'Description must be at least 50 characters'],
    },
    ratingAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      set: (val) => Math.round(val * 10) / 10,
    },
    ratingQuantity: {
      type: Number,
      default: 0,
    },
    images: [
      {
        url: String,
        filename: String,
        isPrimary: { type: Boolean, default: false },
      },
    ],
    price: {
      type: Number,
      required: [true, 'A property must have a price'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          return val < this.price;
        },
        message: 'Discount price must be below regular price',
      },
    },
    status: {
      type: String,
      enum: {
        values: ['available', 'booked', 'sold', 'pending'],
        message: 'Status must be available, booked, sold, or pending',
      },
      default: 'available',
    },
    amenities: {
      swimmingPool: { type: Boolean, default: false },
      wifi: { type: Boolean, default: false },
      parking: { type: Boolean, default: false },
      petFriendly: { type: Boolean, default: false },
      airConditioning: { type: Boolean, default: false },
      gym: { type: Boolean, default: false },
      security: { type: Boolean, default: false },
      furnished: { type: Boolean, default: false },
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, default: 'Nigeria' },
    },
    geoLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: function (coords) {
            return (
              coords.length === 2 &&
              coords[0] >= -180 &&
              coords[0] <= 180 && // longitude
              coords[1] >= -90 &&
              coords[1] <= 90
            ); // latitude
          },
          message: 'Invalid coordinates. Use [longitude, latitude]',
        },
      },
    },
    neighborhood: String,
    landmark: String,
    areaCode: String,
    propertyType: {
      type: String,
      enum: [
        'apartment',
        'house',
        'villa',
        'condo',
        'commercial',
        'land',
        'duplex',
      ],
      required: true,
    },
    listingType: {
      type: String,
      enum: ['sale', 'rent'],
      required: true,
    },
    wishlistCount: {
      type: Number,
      default: 0,
    },
    bedrooms: {
      type: Number,
      required: true,
      min: [0, 'Bedrooms cannot be negative'],
    },
    bathrooms: {
      type: Number,
      required: true,
      min: [0, 'Bathrooms cannot be negative'],
    },
    area: {
      type: Number,
      required: true,
      min: [1, 'Area must be at least 1 square meter'],
    },
    yearBuilt: Number,
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Assuming agents are Users with role 'agent'
      required: [true, 'A property must have an agent'],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'A property must have an owner'],
    },
    isActive: {
      type: Boolean,
      default: true,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for better performance
propertySchema.index({ price: 1, ratingAverage: -1 });
propertySchema.index({ geoLocation: '2dsphere' }); // ✅ CORRECT
propertySchema.index({ slug: 1 });
propertySchema.index({ city: 1, status: 1 });

// Virtual properties
propertySchema.virtual('isNewListing').get(function () {
  return Date.now() - this.createdAt < 7 * 24 * 60 * 60 * 1000; // 7 days
});

propertySchema.virtual('pricePerSqMeter').get(function () {
  return this.area > 0 ? this.price / this.area : this.price;
});

// Document middleware
propertySchema.pre('save', function (next) {
  this.slug = slugify(this.title, { lower: true, strict: true });
  next();
});

// Query middleware - only show active properties
propertySchema.pre(/^find/, function (next) {
  this.find({ isActive: { $ne: false } });
  next();
});

// Populate agent and owner details
propertySchema.pre(/^find/, function (next) {
  this.populate({
    path: 'agent',
    select: 'name email phone photo role',
  }).populate({
    path: 'owner',
    select: 'name email phone',
  });
  next();
});

propertySchema.methods.getDistanceFrom = function (lat, lng) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat - this.geoLocation.coordinates[1]) * Math.PI) / 180;
  const dLon = ((lng - this.geoLocation.coordinates[0]) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((this.geoLocation.coordinates[1] * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

const Property = mongoose.model('Property', propertySchema);
module.exports = Property;
