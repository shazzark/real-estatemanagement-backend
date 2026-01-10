const mongoose = require("mongoose");

const agentSchema = new mongoose.Schema({
  contactDetails: {
    phone: {
      type: String,
      required: [true, "An agent must have a phone number"],
    },
    email: {
      type: String,
      required: [true, "An agent must have an email address"],
    },
  },
  agentName: {
    type: String,
    required: [true, "An agent must have a name"],
  },
  agency: {
    type: String,
    required: [true, "An agent must belong to an agency"],
  },
  propertiesManged: {
    type: Number,
    default: 0,
  },
  ratingScore: {
    type: Number,
    default: 0,
  },
  verifiedFlag: {
    type: Boolean,
    default: false,
  },
});

const Agent = mongoose.model("Agent", agentSchema);

module.exports = Agent;
