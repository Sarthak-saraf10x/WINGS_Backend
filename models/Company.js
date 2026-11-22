const mongoose = require('mongoose');

const RateCardSchema = new mongoose.Schema({
  vehicleCategory: {
    type: String,
    required: [true, 'Vehicle category is required'],
    trim: true
  },
  packageName: {
    type: String,
    required: [true, 'Package name is required'],
    trim: true
  },
  baseHours: {
    type: Number,
    required: [true, 'Base hours are required'],
    default: 8
  },
  baseKms: {
    type: Number,
    required: [true, 'Base KMs are required'],
    default: 80
  },
  basePackageRate: {
    type: Number,
    required: [true, 'Base package rate is required'],
    default: 0
  },
  extraKmRate: {
    type: Number,
    required: [true, 'Extra KM rate is required'],
    default: 0
  },
  extraHourRate: {
    type: Number,
    required: [true, 'Extra hour rate is required'],
    default: 0
  },
  driverDayAllowance: {
    type: Number,
    default: 0
  },
  nightLateAllowance: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const CompanySchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true
  },
  billingAddress: {
    type: String,
    required: [true, 'Billing address is required'],
    trim: true
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true,
    default: 'Maharashtra'
  },
  stateCode: {
    type: String,
    required: [true, 'State code is required'],
    trim: true,
    default: '27-MH'
  },
  gstin: {
    type: String,
    required: [true, 'GSTIN is required'],
    trim: true,
    uppercase: true
  },
  creditPeriodDays: {
    type: Number,
    required: [true, 'Credit period in days is required'],
    default: 30
  },
  gstRate: {
    type: Number,
    required: [true, 'GST rate is required'],
    default: 5.0
  },
  billingCalculationMode: {
    type: String,
    enum: ['GARAGE_TO_GARAGE', 'REPORTING_TO_RELEASING', 'MANUAL_OVERRIDE'],
    default: 'GARAGE_TO_GARAGE'
  },
  extraHourRoundingRule: {
    type: String,
    enum: ['EXACT', 'ROUND_30_MIN', 'ROUND_60_MIN'],
    default: 'ROUND_60_MIN'
  },
  fuelSurchargeRule: {
    ruleType: {
      type: String,
      enum: ['NONE', 'PERCENTAGE_OF_BASE', 'PER_KM'],
      default: 'NONE'
    },
    value: {
      type: Number,
      default: 0
    }
  },
  tollParkingTaxable: {
    type: Boolean,
    default: false
  },
  contactPersonName: {
    type: String,
    trim: true,
    default: ''
  },
  contactPersonPhone: {
    type: String,
    trim: true,
    default: ''
  },
  contactPersonEmail: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  status: {
    type: Boolean,
    default: true
  },
  rateCards: [RateCardSchema],
  createdBy: {
    type: String,
    default: 'SYSTEM'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Company', CompanySchema);
