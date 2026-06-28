const mongoose = require('mongoose');

const RentalSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Vehicle name is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Vehicle type is required'],
    enum: ['Sedan', 'SUV', 'Hatchback', 'Innova', 'Ertiga', 'Tempo Traveller', 'Mini Bus', 'Luxury Bus', 'Other'],
    default: 'Sedan'
  },
  capacity: {
    type: Number,
    required: [true, 'Seating capacity is required'],
    min: 1
  },
  ac: {
    type: Boolean,
    default: true
  },
  ratePerKm: {
    type: String,
    trim: true
  },
  ratePerDay: {
    type: String,
    trim: true
  },
  ratePerHour: {
    type: String,
    trim: true
  },
  minFare: {
    type: String,
    trim: true
  },
  features: {
    type: String,
    trim: true
  },
  imageUrl: {
    type: String,
    required: [true, 'Vehicle image URL is required']
  },
  imagePublicId: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Rental', RentalSchema);
