const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');

// Fallback in-memory audit log if DB is unavailable
const memoryAuditLogs = [];

const logAudit = async ({
  req,
  action,
  entityType,
  entityId = '',
  entityName = '',
  details = {}
}) => {
  try {
    const userId = req && req.admin ? (req.admin._id || req.admin.id || 'admin') : 'SYSTEM';
    const username = req && req.admin ? (req.admin.username || req.admin.fullName || 'admin') : 'SYSTEM';

    const logEntry = {
      userId: String(userId),
      username,
      action,
      entityType,
      entityId: String(entityId),
      entityName,
      details,
      timestamp: new Date()
    };

    if (mongoose.connection.readyState === 1) {
      await AuditLog.create(logEntry);
    } else {
      memoryAuditLogs.unshift({ _id: 'audit_' + Date.now(), ...logEntry });
      if (memoryAuditLogs.length > 500) memoryAuditLogs.pop();
    }
    return true;
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
    return false;
  }
};

const getAuditLogs = async (filter = {}, limit = 100) => {
  if (mongoose.connection.readyState === 1) {
    return await AuditLog.find(filter).sort({ timestamp: -1 }).limit(limit).lean();
  }
  return memoryAuditLogs.slice(0, limit);
};

module.exports = {
  logAudit,
  getAuditLogs,
  memoryAuditLogs
};
