const mongoose = require('mongoose');

const ExtraGuestSchema = new mongoose.Schema({
  srNo: { type: Number, default: 1 },
  guestName: { type: String, trim: true, default: '' },
  reporting: { type: String, trim: true, default: '' },
  drop: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, default: '' },
  empId: { type: String, trim: true, default: '' },
  costCenter: { type: String, trim: true, default: '' },
  taskCode: { type: String, trim: true, default: '' },
  reqId: { type: String, trim: true, default: '' }
}, { _id: true });

const AggregatorBookingSchema = new mongoose.Schema({
  bookingNo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  dutySlipNo: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  status: {
    type: String,
    enum: [
      'NO_TIMING',
      'STATUS_NO',
      'STATUS_YES',
      'STATUS_CANCEL',
      'DR_DUTY_ACCPT',
      'DR_DUTY_START',
      'DR_DUTY_CLOSE'
    ],
    default: 'NO_TIMING'
  },
  isManualStatus: {
    type: Boolean,
    default: false
  },
  cancelReason: {
    type: String,
    trim: true,
    default: ''
  },

  // Dates & Timings
  travelDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  },
  reqTime: {
    type: String,
    trim: true,
    default: ''
  },
  repHours: {
    type: String,
    trim: true,
    default: ''
  },
  repMinutes: {
    type: String,
    trim: true,
    default: ''
  },
  offHours: {
    type: String,
    trim: true,
    default: ''
  },
  offMinutes: {
    type: String,
    trim: true,
    default: ''
  },
  noTiming: {
    type: Boolean,
    default: false
  },
  timingNotes: {
    type: String,
    trim: true,
    default: ''
  },

  // Client info
  clientId: {
    type: String,
    default: ''
  },
  clientName: {
    type: String,
    trim: true,
    default: ''
  },
  location: {
    type: String,
    trim: true,
    default: 'Pune'
  },
  bookedBy: {
    type: String,
    trim: true,
    default: ''
  },
  bookedByPhone: {
    type: String,
    trim: true,
    default: ''
  },

  // Vehicle requested & Package
  vehicleType: {
    type: String,
    trim: true,
    default: ''
  },
  packageType: {
    type: String,
    trim: true,
    default: ''
  },
  destination: {
    type: String,
    trim: true,
    default: 'Local Disposal'
  },
  dutyRefNo: {
    type: String,
    trim: true,
    default: ''
  },
  remarks: {
    type: String,
    trim: true,
    default: ''
  },

  // Primary Guest info
  guestName: {
    type: String,
    trim: true,
    default: ''
  },
  guestPhone: {
    type: String,
    trim: true,
    default: ''
  },
  reportingAddress: {
    type: String,
    trim: true,
    default: ''
  },
  dropAddress: {
    type: String,
    trim: true,
    default: ''
  },

  // Extra Guests
  extraGuests: [ExtraGuestSchema],

  // Plotting Details (Vendor, Vehicle, Driver)
  vendorId: {
    type: String,
    default: ''
  },
  vendorName: {
    type: String,
    trim: true,
    default: ''
  },
  vendorPackage: {
    type: String,
    trim: true,
    default: ''
  },
  vendorPenalty: {
    type: Number,
    default: 0
  },
  vendorFixRate: {
    type: Number,
    default: 0
  },
  vendorKmRate: {
    type: Number,
    default: 0
  },
  cashToVendor: {
    type: Number,
    default: 0
  },
  driverName: {
    type: String,
    trim: true,
    default: ''
  },
  driverPhone: {
    type: String,
    trim: true,
    default: ''
  },
  vehicleNumber: {
    type: String,
    trim: true,
    uppercase: true,
    default: ''
  },
  vehicleSend: {
    type: String,
    trim: true,
    default: ''
  },
  driverAccepted: {
    type: Boolean,
    default: false
  },
  dutyStarted: {
    type: Boolean,
    default: false
  },
  dutyClosed: {
    type: Boolean,
    default: false
  },
  paymentMode: {
    type: String,
    enum: ['CREDIT', 'CASH', 'ONLINE'],
    default: 'CREDIT'
  },

  // Duty Close Readings
  dutyCloseReadings: {
    garageOutKm: { type: Number, default: 0 },
    garageOutTime: { type: String, default: '' },
    reportingKm: { type: Number, default: 0 },
    reportingTime: { type: String, default: '' },
    releasingKm: { type: Number, default: 0 },
    releasingTime: { type: String, default: '' },
    garageInKm: { type: Number, default: 0 },
    garageInTime: { type: String, default: '' },
    totalKms: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    totalDays: { type: Number, default: 1 },
    totalNights: { type: Number, default: 0 },
    driverAllowance: { type: Number, default: 0 },
    lateNightCharges: { type: Number, default: 0 },
    permitCharges: { type: Number, default: 0 },
    fuelSurcharge: { type: Number, default: 0 },
    tollCharges: { type: Number, default: 0 },
    parkingCharges: { type: Number, default: 0 },
    guestSignatureConfirmed: { type: Boolean, default: false }
  },

  // Scanned Duty Slip
  dutySlipUploaded: {
    type: Boolean,
    default: false
  },
  dutySlipFile: {
    type: String,
    default: ''
  },
  dutySlipFileName: {
    type: String,
    default: ''
  },

  // Generated Invoice
  isInvoiced: {
    type: Boolean,
    default: false
  },
  invoiceDetails: {
    invoiceNo: { type: String, default: '' },
    invoiceDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    lineItems: [{
      description: String,
      hsn: String,
      qty: Number,
      rate: Number,
      amount: Number
    }],
    taxableAmount: { type: Number, default: 0 },
    isSameState: { type: Boolean, default: true },
    cgstRate: { type: Number, default: 2.5 },
    cgstAmount: { type: Number, default: 0 },
    sgstRate: { type: Number, default: 2.5 },
    sgstAmount: { type: Number, default: 0 },
    igstRate: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    tollParkingNonTaxable: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    amountInWords: { type: String, default: '' }
  },

  // Audit
  createdBy: {
    type: String,
    default: 'admin'
  },
  updatedBy: {
    type: String,
    default: 'admin'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AggregatorBooking', AggregatorBookingSchema);
