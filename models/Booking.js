const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  pickup: {
    type: String,
    required: [true, 'Pickup location is required'],
    trim: true
  },
  destination: {
    type: String,
    required: [true, 'Destination is required'],
    trim: true
  },
  travelDate: {
    type: Date,
    required: [true, 'Travel date is required']
  },
  people: {
    type: Number,
    required: [true, 'Number of travelers is required'],
    min: [1, 'Must have at least 1 traveler']
  },
  service: {
    type: String,
    required: [true, 'Service type is required'],
    trim: true
  },
  message: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    default: 'Pending',
    enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled']
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Booking', BookingSchema);
