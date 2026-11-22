const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    default: 'SYSTEM'
  },
  username: {
    type: String,
    required: true,
    default: 'admin'
  },
  action: {
    type: String,
    required: true,
    trim: true
  },
  entityType: {
    type: String,
    required: true,
    enum: ['BROKER_PROFILE', 'USER', 'COMPANY', 'RATE_CARD', 'VENDOR', 'VEHICLE', 'DRIVER', 'BOOKING', 'INVOICE'],
    trim: true
  },
  entityId: {
    type: String,
    default: ''
  },
  entityName: {
    type: String,
    default: ''
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
