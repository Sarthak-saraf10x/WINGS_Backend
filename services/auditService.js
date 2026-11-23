const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');

// Fallback in-memory audit log if DB is unavailable
const memoryAuditLogs = [
  {
    _id: 'mock_audit_1',
    userId: 'mock_u1',
    username: 'admin',
    userRole: 'ADMIN',
    actor_id: 'mock_u1',
    actor_name: 'admin',
    actor_role: 'ADMIN',
    action: 'CREATE_USER',
    action_type: 'USER_CREATED',
    entityType: 'USER',
    target_entity: 'USER',
    entityId: 'mock_u2',
    target_id: 'mock_u2',
    entityName: 'Rahul Deshmukh (dispatcher1)',
    details: { role: 'DISPATCHER', phone: '+91 98500 44332', status: true },
    summary: 'Created Dispatcher account: Rahul Deshmukh (@dispatcher1)',
    timestamp: new Date(Date.now() - 3600000 * 24)
  },
  {
    _id: 'mock_audit_2',
    userId: 'mock_u1',
    username: 'admin',
    userRole: 'ADMIN',
    actor_id: 'mock_u1',
    actor_name: 'admin',
    actor_role: 'ADMIN',
    action: 'UPDATE_COMPANY',
    action_type: 'COMPANY_UPDATED',
    entityType: 'COMPANY',
    target_entity: 'COMPANY',
    entityId: 'comp_1',
    target_id: 'comp_1',
    entityName: 'Infosys Limited',
    details: { stateCode: '27-MH', gst: '27AAACI1234F1Z1' },
    summary: 'Updated company profile and rate card for Infosys Limited',
    timestamp: new Date(Date.now() - 3600000 * 18)
  },
  {
    _id: 'mock_audit_3',
    userId: 'mock_u2',
    username: 'dispatcher1',
    userRole: 'DISPATCHER',
    actor_id: 'mock_u2',
    actor_name: 'dispatcher1',
    actor_role: 'DISPATCHER',
    action: 'CREATE_BOOKING',
    action_type: 'BOOKING_CREATED',
    entityType: 'BOOKING',
    target_entity: 'BOOKING',
    entityId: '73426',
    target_id: '73426',
    entityName: 'Booking #73426 (Infosys Limited)',
    details: { status: 'DR_DUTY_ACCPT', vehicle: 'MH12AB1234', driver: 'Ramesh Pawar' },
    summary: 'Created booking #73426 and plotted vehicle MH12AB1234 (Ramesh Pawar)',
    timestamp: new Date(Date.now() - 3600000 * 5)
  },
  {
    _id: 'mock_audit_4',
    userId: 'mock_u2',
    username: 'dispatcher1',
    userRole: 'DISPATCHER',
    actor_id: 'mock_u2',
    actor_name: 'dispatcher1',
    actor_role: 'DISPATCHER',
    action: 'CLOSE_DUTY',
    action_type: 'DUTY_CLOSED',
    entityType: 'BOOKING',
    target_entity: 'BOOKING',
    entityId: '73426',
    target_id: '73426',
    entityName: 'Booking #73426',
    details: { totalKm: 85, totalHours: '8:30', amount: 3820 },
    summary: 'Closed duty for booking #73426. Duty slip scanned & invoice generated.',
    timestamp: new Date(Date.now() - 3600000 * 2)
  }
];

const logAudit = async ({
  req,
  action,
  action_type,
  entityType,
  target_entity,
  entityId = '',
  target_id = '',
  entityName = '',
  details = {},
  summary = ''
}) => {
  try {
    const userId = req && req.admin ? (req.admin._id || req.admin.id || 'admin') : 'SYSTEM';
    const username = req && req.admin ? (req.admin.username || req.admin.fullName || 'admin') : 'SYSTEM';
    const userRole = req && req.admin ? (String(req.admin.role || 'ADMIN').toUpperCase()) : 'SYSTEM';

    const act = action || action_type || 'SYSTEM_ACTION';
    const actType = action_type || action || act;
    const entType = entityType || target_entity || 'GENERAL';
    const tgtEntity = target_entity || entityType || entType;
    const tgtId = String(target_id || entityId || '');

    let generatedSummary = summary;
    if (!generatedSummary) {
      if (typeof details === 'string') {
        generatedSummary = details;
      } else if (typeof details === 'object' && details !== null) {
        const parts = [];
        if (details.status) parts.push(`Status: ${details.status}`);
        if (details.vehicle) parts.push(`Vehicle: ${details.vehicle}`);
        if (details.driver) parts.push(`Driver: ${details.driver}`);
        if (details.role) parts.push(`Role: ${details.role}`);
        if (details.phone || details.phoneNumber) parts.push(`Phone: ${details.phone || details.phoneNumber}`);
        generatedSummary = parts.length ? parts.join(', ') : `${act} on ${entType} ${tgtId || entityName}`.trim();
      }
    }

    const logEntry = {
      userId: String(userId),
      username,
      userRole,
      actor_id: String(userId),
      actor_name: username,
      actor_role: userRole,
      action: act,
      action_type: actType,
      entityType: entType,
      target_entity: tgtEntity,
      entityId: tgtId,
      target_id: tgtId,
      entityName,
      details,
      summary: generatedSummary,
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

const getAuditLogs = async (filter = {}, limit = 200) => {
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
