const mongoose = require('mongoose');

const GallerySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Gallery item title is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['cars', 'buses', 'destinations', 'trips'],
      message: '{VALUE} is not a valid category. Choose from: cars, buses, destinations, trips'
    },
    trim: true
  },
  imageUrl: {
    type: String,
    required: [true, 'Cloudinary image URL is required']
  },
  imagePublicId: {
    type: String,
    required: false
  },
  description: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Gallery', GallerySchema);
