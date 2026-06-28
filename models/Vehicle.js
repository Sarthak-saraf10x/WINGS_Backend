const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Vehicle name is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Vehicle type is required'],
    enum: ['Sedan', 'SUV', 'Hatchback', 'Tempo Traveller', 'Mini Bus', 'Luxury Bus', 'Innova', 'Ertiga', 'Other'],
    default: 'Sedan'
  },
  capacity: {
    type: Number,
    required: [true, 'Seating capacity is required'],
    min: 1
  },
  fuelType: {
    type: String,
    enum: ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'],
    default: 'Diesel'
  },
  transmission: {
    type: String,
    enum: ['Manual', 'Automatic'],
    default: 'Manual'
  },
  ac: {
    type: Boolean,
    default: true
  },
  features: {
    type: String,
    trim: true
  },
  pricePerKm: {
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

module.exports = mongoose.model('Vehicle', VehicleSchema);
