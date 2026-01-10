const mongoose = require("mongoose");

const Locationschema = new mongoose.Schema(
  {
    country: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },

    address: {
      type: String,
      required: true,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: "2dsphere",
    },
    postalCode: {
      type: String,
    },
    placeName: {
      type: String,
    },
    locationType: {
      type: String,
      enum: ["residential", "commercial", "industrial", "land"],
      default: "other",
    },
    timeZone: {
      type: String,
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Location = mongoose.model("Location", Locationschema);
module.exports = Location;
