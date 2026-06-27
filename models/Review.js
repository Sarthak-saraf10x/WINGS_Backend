const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  authorName: {
    type: String,
    required: true,
    trim: true
  },
  authorPhotoUrl: {
    type: String,
    trim: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  relativeTimeDescription: {
    type: String,
    trim: true
  },
  time: {
    type: Number // epoch timestamp
  },
  tripType: {
    type: String,
    trim: true
  },
  isGoogleReview: {
    type: Boolean,
    default: true
  },
  isVisible: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Review', ReviewSchema);
