const mongoose = require('mongoose');

const PackageSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Package title is required'],
    trim: true
  },
  duration: {
    type: String,
    required: [true, 'Duration is required (e.g. 3 Nights / 4 Days)'],
    trim: true
  },
  rating: {
    type: Number,
    default: 5.0,
    min: 0,
    max: 5
  },
  price: {
    type: String,
    required: [true, 'Price details are required (e.g. ₹6,999)'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  imageUrl: {
    type: String,
    required: [true, 'Cloudinary image URL is required']
  },
  imagePublicId: {
    type: String,
    required: false // Optional, but recommended for cleanups
  },
  isFeatured: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  badge: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Package', PackageSchema);
