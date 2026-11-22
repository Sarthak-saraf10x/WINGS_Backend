const mongoose = require('mongoose');

const BrokerProfileSchema = new mongoose.Schema({
  companyLegalName: {
    type: String,
    required: [true, 'Company Legal Name is required'],
    trim: true,
    default: 'Red Cars India Pvt. Ltd.'
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
    default: 'Office No. 402, Business Bay, Pune-Bangalore Highway, Pune'
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
    default: 'Pune'
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true,
    default: 'Maharashtra'
  },
  stateCode: {
    type: String,
    required: [true, 'State Code is required'],
    trim: true,
    default: '27-MH'
  },
  phone: {
    type: String,
    required: [true, 'Phone / Helpline is required'],
    trim: true,
    default: '+91 98220 12345'
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    default: 'billing@redcarsindia.com'
  },
  gstin: {
    type: String,
    required: [true, 'GSTIN is required'],
    trim: true,
    uppercase: true,
    default: '27AAACR1234M1Z5'
  },
  pan: {
    type: String,
    required: [true, 'PAN is required'],
    trim: true,
    uppercase: true,
    default: 'AAACR1234M'
  },
  tan: {
    type: String,
    trim: true,
    uppercase: true,
    default: ''
  },
  sacCode: {
    type: String,
    required: [true, 'SAC Code is required'],
    trim: true,
    default: '996601'
  },
  bankName: {
    type: String,
    required: [true, 'Bank Name is required'],
    trim: true,
    default: 'HDFC Bank Ltd.'
  },
  accountName: {
    type: String,
    required: [true, 'Account Name / Payable To is required'],
    trim: true,
    default: 'Red Cars India Pvt. Ltd.'
  },
  accountNumber: {
    type: String,
    required: [true, 'Account Number is required'],
    trim: true,
    default: '50200012345678'
  },
  ifscCode: {
    type: String,
    required: [true, 'IFSC Code is required'],
    trim: true,
    uppercase: true,
    default: 'HDFC0000123'
  },
  branchName: {
    type: String,
    trim: true,
    default: 'Kothrud Branch, Pune'
  },
  jurisdictionCity: {
    type: String,
    required: [true, 'Jurisdiction City is required'],
    trim: true,
    default: 'Pune'
  },
  invoicePrefix: {
    type: String,
    required: [true, 'Invoice Prefix is required'],
    trim: true,
    default: 'INV-'
  },
  invoiceNextSequence: {
    type: Number,
    required: [true, 'Invoice Next Sequence is required'],
    default: 73426
  },
  dutySlipPrefix: {
    type: String,
    required: [true, 'Duty Slip Prefix is required'],
    trim: true,
    default: 'DS-'
  },
  dutySlipNextSequence: {
    type: Number,
    required: [true, 'Duty Slip Next Sequence is required'],
    default: 73426
  },
  updatedBy: {
    type: String,
    default: 'SYSTEM'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('BrokerProfile', BrokerProfileSchema);
