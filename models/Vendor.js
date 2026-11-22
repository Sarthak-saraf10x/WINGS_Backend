const mongoose = require('mongoose');

const VendorVehicleSchema = new mongoose.Schema({
  registrationNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    trim: true,
    uppercase: true
  },
  vehicleCategory: {
    type: String,
    required: [true, 'Vehicle category is required'],
    trim: true
  },
  vehicleModel: {
    type: String,
    trim: true,
    default: ''
  },
  insuranceExpiryDate: {
    type: Date,
    default: null
  },
  fitnessExpiryDate: {
    type: Date,
    default: null
  },
  permitExpiryDate: {
    type: Date,
    default: null
  },
  pucExpiryDate: {
    type: Date,
    default: null
  },
  status: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const VendorDriverSchema = new mongoose.Schema({
  driverName: {
    type: String,
    required: [true, 'Driver name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Driver Phone / WhatsApp is required'],
    trim: true
  },
  licenseNumber: {
    type: String,
    trim: true,
    uppercase: true,
    default: ''
  },
  licenseExpiryDate: {
    type: Date,
    default: null
  },
  badgeStatus: {
    type: String,
    enum: ['VERIFIED', 'PENDING', 'NOT_PROVIDED'],
    default: 'NOT_PROVIDED'
  },
  status: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const VendorSchema = new mongoose.Schema({
  vendorName: {
    type: String,
    required: [true, 'Vendor / Agency Name is required'],
    trim: true
  },
  contactPerson: {
    type: String,
    required: [true, 'Contact person name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone / WhatsApp number is required'],
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  gstin: {
    type: String,
    trim: true,
    uppercase: true,
    default: ''
  },
  pan: {
    type: String,
    trim: true,
    uppercase: true,
    default: ''
  },
  bankDetails: {
    accountNumber: {
      type: String,
      trim: true,
      default: ''
    },
    ifsc: {
      type: String,
      trim: true,
      uppercase: true,
      default: ''
    },
    bankName: {
      type: String,
      trim: true,
      default: ''
    }
  },
  defaultCommissionNotes: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: Boolean,
    default: true
  },
  // Business rule: Adding vehicles and drivers under vendor is OPTIONAL (0 or more)
  vehicles: [VendorVehicleSchema],
  drivers: [VendorDriverSchema],
  createdBy: {
    type: String,
    default: 'SYSTEM'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Vendor', VendorSchema);
