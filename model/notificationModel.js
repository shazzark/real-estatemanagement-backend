const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    // Recipient of the notification
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Notification must belong to a user'],
    },

    // Notification title
    title: {
      type: String,
      required: [true, 'Notification must have a title'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },

    // Notification message/body
    message: {
      type: String,
      required: [true, 'Notification must have a message'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },

    // Type of notification
    type: {
      type: String,
      enum: {
        values: [
          'booking', // New booking, booking confirmed/cancelled
          'property', // New property, price change, status update
          'message', // New message from agent/user
          'review', // New review on your property
          'alert', // Important alerts
          'system', // System notifications
          'reminder', // Booking/viewing reminders
        ],
        message: 'Notification type is not supported',
      },
      default: 'system',
    },

    // Read status
    read: {
      type: Boolean,
      default: false,
    },

    // Important/priority notifications
    isImportant: {
      type: Boolean,
      default: false,
    },

    // Link to related resource (optional)
    relatedTo: {
      type: mongoose.Schema.ObjectId,
      refPath: 'relatedModel',
    },

    // Which model the relatedTo refers to
    relatedModel: {
      type: String,
      enum: ['Property', 'Booking', 'Review', 'User'],
    },

    // Action link (for buttons in notifications)
    actionUrl: String,

    // Icon for the notification
    icon: {
      type: String,
      enum: ['bell', 'calendar', 'message', 'star', 'alert', 'check', 'info'],
      default: 'bell',
    },

    // Expiration for time-sensitive notifications
    expiresAt: {
      type: Date,
      index: { expires: '1d' }, // Auto-delete after 1 day of expiration
    },

    // For tracking if email was sent
    emailSent: {
      type: Boolean,
      default: false,
    },

    // Metadata for filtering
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for better performance
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, type: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ isImportant: 1, read: 1 });

// Virtual for checking if notification is recent (last 7 days)
notificationSchema.virtual('isRecent').get(function () {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return this.createdAt > sevenDaysAgo;
});

// Virtual for formatted date
notificationSchema.virtual('formattedDate').get(function () {
  const now = new Date();
  const diffInHours = (now - this.createdAt) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    return 'Just now';
  } else if (diffInHours < 24) {
    const hours = Math.floor(diffInHours);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffInHours < 168) {
    // 7 days
    const days = Math.floor(diffInHours / 24);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  } else {
    return this.createdAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
});

// Query middleware to populate user info
notificationSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'name email photo',
  });

  // Populate related resource based on relatedModel
  if (this._conditions.relatedTo && this._conditions.relatedModel) {
    this.populate({
      path: 'relatedTo',
      select: 'title name email', // Will vary by model
    });
  }

  next();
});

// Static method to create notification for multiple users
notificationSchema.statics.createForUsers = async function (
  userIds,
  notificationData,
) {
  const notifications = userIds.map((userId) => ({
    ...notificationData,
    user: userId,
  }));

  return await this.insertMany(notifications);
};

// Static method to mark all as read for a user
notificationSchema.statics.markAllAsRead = async function (userId) {
  return await this.updateMany({ user: userId, read: false }, { read: true });
};

// Static method to get unread count for a user
notificationSchema.statics.getUnreadCount = async function (userId) {
  return await this.countDocuments({
    user: userId,
    read: false,
  });
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
