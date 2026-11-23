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
  userRole: {
    type: String,
    enum: ['ADMIN', 'DISPATCHER', 'SYSTEM', 'admin', 'dispatcher', 'system'],
    default: 'ADMIN'
  },
  actor_id: {
    type: String,
    default: ''
  },
  actor_name: {
    type: String,
    default: ''
  },
  actor_role: {
    type: String,
    default: 'ADMIN'
  },
  action: {
    type: String,
    required: true,
    trim: true
  },
  action_type: {
    type: String,
    default: ''
  },
  entityType: {
    type: String,
    required: true,
    trim: true
  },
  target_entity: {
    type: String,
    default: ''
  },
  entityId: {
    type: String,
    default: ''
  },
  target_id: {
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
  summary: {
    type: String,
    default: ''
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
