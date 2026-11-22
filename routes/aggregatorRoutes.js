const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const BrokerProfile = require('../models/BrokerProfile');
const Admin = require('../models/Admin');
const Company = require('../models/Company');
const Vendor = require('../models/Vendor');
const AggregatorBooking = require('../models/AggregatorBooking');
const AuditLog = require('../models/AuditLog');
const { protect, requireAdmin } = require('../middleware/auth');
const { logAudit, getAuditLogs } = require('../services/auditService');
const { calculateInvoiceForBooking } = require('../services/invoiceService');
const upload = require('../middleware/multer');
const {
  mockBrokerProfile,
  mockUsers,
  mockCompanies,
  mockVendors,
  mockBookings
} = require('../config/aggregatorMockStore');

const isDb = () => mongoose.connection.readyState === 1;

// Safe document lookup helpers to prevent Cast to ObjectId errors
async function findBookingDoc(id) {
  if (!id) return null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    const b = await AggregatorBooking.findById(id);
    if (b) return b;
  }
  const rawId = String(id).replace('mock_bk_', '');
  return await AggregatorBooking.findOne({
    $or: [
      { bookingNo: String(id) },
      { dutySlipNo: String(id) },
      { bookingNo: rawId },
      { dutySlipNo: rawId }
    ]
  });
}

async function findCompanyDoc(id, name) {
  if (id && mongoose.Types.ObjectId.isValid(id)) {
    const c = await Company.findById(id);
    if (c) return c;
  }
  if (name) {
    const c = await Company.findOne({ companyName: name });
    if (c) return c;
  }
  return null;
}

async function findVendorDoc(id, name) {
  if (id && mongoose.Types.ObjectId.isValid(id)) {
    const v = await Vendor.findById(id);
    if (v) return v;
  }
  if (name) {
    const v = await Vendor.findOne({ vendorName: name });
    if (v) return v;
  }
  return null;
}

// Helper: Calculate document expiry alert level
// red = expired, amber = expiring in <= 7 days, green = safe, null = no date
const getExpiryStatus = (dateStr) => {
  if (!dateStr) return null;
  const expiry = new Date(dateStr);
  if (isNaN(expiry.getTime())) return null;

  const now = new Date();
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { level: 'red', text: 'Expired', days: diffDays };
  } else if (diffDays <= 7) {
    return { level: 'amber', text: `Expiring in ${diffDays} day${diffDays === 1 ? '' : 's'}`, days: diffDays };
  }
  return { level: 'green', text: 'Valid', days: diffDays };
};

// Auto-derive booking status from field completeness and progress
function computeBookingStatus(b) {
  // 1. Manual Cancellation:
  if (b.status === 'STATUS_CANCEL' || b.cancelled) {
    if (b.cancelReason && b.cancelReason.trim().length > 0) {
      return 'STATUS_CANCEL';
    }
  }

  // 2. Duty Closed:
  if (b.dutyClosed || b.dutySlipUploaded || b.status === 'DR_DUTY_CLOSE') {
    return 'DR_DUTY_CLOSE';
  }

  // 3. Duty Started:
  if (b.dutyStarted || b.status === 'DR_DUTY_START') {
    return 'DR_DUTY_START';
  }

  // 4. Driver Duty Accepted:
  const hasPlotting = Boolean(
    (b.vendorName || b.vendorId) &&
    b.vehicleNumber && b.vehicleNumber.trim().length > 0 &&
    b.driverName && b.driverName.trim().length > 0
  );

  if (hasPlotting && (b.driverAccepted === true || String(b.driverAccepted).toUpperCase() === 'YES')) {
    return 'DR_DUTY_ACCPT';
  }

  // 5. Missing Timing:
  const hasTiming = Boolean(
    !b.noTiming &&
    (
      (b.reqTime && b.reqTime.trim().length > 0) ||
      (b.repHours && b.repHours.trim().length > 0)
    )
  );
  if (!hasTiming || b.noTiming) {
    return 'NO_TIMING';
  }

  // 6. Incomplete Core / Unconfirmed Details (STATUS_NO):
  const hasCore = Boolean(
    (b.clientName || b.clientId) &&
    b.travelDate &&
    b.guestName && b.guestName.trim().length > 0 &&
    b.vehicleType && b.vehicleType.trim().length > 0 &&
    b.packageType && b.packageType.trim().length > 0
  );

  if (!hasCore || !hasPlotting) {
    return 'STATUS_NO';
  }

  // 7. Complete & Ready (STATUS_YES):
  return 'STATUS_YES';
}

// =========================================================================
// 1. MY COMPANY / BROKER PROFILE SETTINGS
// =========================================================================

router.get('/profile', protect, async (req, res) => {
  try {
    if (!isDb()) {
      return res.json({ success: true, data: mockBrokerProfile });
    }
    let profile = await BrokerProfile.findOne();
    if (!profile) {
      profile = await BrokerProfile.create({});
      await logAudit({
        req,
        action: 'INIT_BROKER_PROFILE',
        entityType: 'BROKER_PROFILE',
        entityId: profile._id,
        entityName: profile.companyLegalName,
        details: { note: 'Initial default broker profile generated' }
      });
    }
    res.json({ success: true, data: profile });
  } catch (err) {
    console.error('Error fetching broker profile:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/profile', protect, requireAdmin, async (req, res) => {
  try {
    const {
      companyLegalName,
      address,
      city,
      state,
      stateCode,
      phone,
      email,
      gstin,
      pan,
      tan,
      sacCode,
      bankName,
      accountName,
      accountNumber,
      ifscCode,
      branchName,
      jurisdictionCity,
      invoicePrefix,
      invoiceNextSequence,
      dutySlipPrefix,
      dutySlipNextSequence
    } = req.body;

    if (!companyLegalName || !address || !city || !state || !stateCode || !phone || !email || !gstin || !pan || !bankName || !accountName || !accountNumber || !ifscCode) {
      return res.status(400).json({ success: false, message: 'Please provide all required broker profile fields' });
    }

    const cleanGstin = gstin.trim().toUpperCase();
    if (cleanGstin.length !== 15) {
      return res.status(400).json({ success: false, message: 'GSTIN must be exactly 15 alphanumeric characters' });
    }

    const cleanPan = pan.trim().toUpperCase();
    if (cleanPan.length !== 10) {
      return res.status(400).json({ success: false, message: 'PAN must be exactly 10 alphanumeric characters' });
    }

    const profileData = {
      companyLegalName: companyLegalName.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      stateCode: stateCode.trim().toUpperCase(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      gstin: cleanGstin,
      pan: cleanPan,
      tan: (tan || '').trim().toUpperCase(),
      sacCode: (sacCode || '996601').trim(),
      bankName: bankName.trim(),
      accountName: accountName.trim(),
      accountNumber: accountNumber.trim(),
      ifscCode: ifscCode.trim().toUpperCase(),
      branchName: (branchName || '').trim(),
      jurisdictionCity: (jurisdictionCity || 'Pune').trim(),
      invoicePrefix: (invoicePrefix || 'INV-').trim(),
      invoiceNextSequence: Number(invoiceNextSequence) || 1,
      dutySlipPrefix: (dutySlipPrefix || 'DS-').trim(),
      dutySlipNextSequence: Number(dutySlipNextSequence) || 1,
      updatedBy: req.admin.username || 'admin',
      updatedAt: new Date()
    };

    if (!isDb()) {
      Object.assign(mockBrokerProfile, profileData);
      await logAudit({
        req,
        action: 'UPDATE_BROKER_PROFILE',
        entityType: 'BROKER_PROFILE',
        entityId: mockBrokerProfile._id,
        entityName: mockBrokerProfile.companyLegalName,
        details: profileData
      });
      return res.json({ success: true, message: 'Broker profile updated successfully', data: mockBrokerProfile });
    }

    let profile = await BrokerProfile.findOne();
    const isNew = !profile;
    if (!profile) profile = new BrokerProfile();

    Object.assign(profile, profileData);
    await profile.save();

    await logAudit({
      req,
      action: isNew ? 'CREATE_BROKER_PROFILE' : 'UPDATE_BROKER_PROFILE',
      entityType: 'BROKER_PROFILE',
      entityId: profile._id,
      entityName: profile.companyLegalName,
      details: profileData
    });

    res.json({ success: true, message: 'Broker profile updated successfully', data: profile });
  } catch (err) {
    console.error('Error updating broker profile:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// 2. USER MANAGEMENT (DISPATCHER & ADMIN ACCOUNTS)
// =========================================================================

router.get('/users', protect, async (req, res) => {
  try {
    if (!isDb()) {
      return res.json({ success: true, count: mockUsers.length, data: mockUsers });
    }
    const users = await Admin.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/users', protect, requireAdmin, async (req, res) => {
  try {
    const { fullName, username, email, phoneNumber, password, role, status } = req.body;

    if (!fullName || !username || !phoneNumber || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full Name, Username / Email, Phone Number, and Password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email ? email.trim().toLowerCase() : cleanUsername;
    const formattedRole = (role || 'DISPATCHER').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'DISPATCHER';

    if (!isDb()) {
      const existing = mockUsers.find(u => u.username === cleanUsername || u.email === cleanEmail);
      if (existing) {
        return res.status(400).json({ success: false, message: 'Username or Email is already registered' });
      }
      const newUser = {
        _id: 'mock_u_' + Date.now(),
        fullName: fullName.trim(),
        username: cleanUsername,
        email: cleanEmail,
        phoneNumber: phoneNumber.trim(),
        role: formattedRole,
        status: status !== undefined ? Boolean(status) : true,
        createdBy: req.admin.username || 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockUsers.unshift(newUser);

      await logAudit({
        req,
        action: 'CREATE_USER',
        entityType: 'USER',
        entityId: newUser._id,
        entityName: `${newUser.fullName} (${newUser.username})`,
        details: { role: newUser.role, phone: newUser.phoneNumber, status: newUser.status }
      });

      return res.status(201).json({ success: true, message: `${formattedRole} account created successfully`, data: newUser });
    }

    const existing = await Admin.findOne({
      $or: [{ username: cleanUsername }, { email: cleanEmail }]
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Username or Email is already registered' });
    }

    const newUser = new Admin({
      fullName: fullName.trim(),
      username: cleanUsername,
      email: cleanEmail,
      phoneNumber: phoneNumber.trim(),
      password,
      role: formattedRole,
      status: status !== undefined ? Boolean(status) : true,
      createdBy: req.admin.username || 'admin'
    });

    await newUser.save();

    await logAudit({
      req,
      action: 'CREATE_USER',
      entityType: 'USER',
      entityId: newUser._id,
      entityName: `${newUser.fullName} (${newUser.username})`,
      details: { role: newUser.role, phoneNumber: newUser.phoneNumber, status: newUser.status }
    });

    const sanitized = newUser.toObject();
    delete sanitized.password;

    res.status(201).json({
      success: true,
      message: `${formattedRole} account created successfully`,
      data: sanitized
    });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/users/:id', protect, requireAdmin, async (req, res) => {
  try {
    const { fullName, phoneNumber, role, status, email, password } = req.body;

    if (!isDb()) {
      const user = mockUsers.find(u => String(u._id) === String(req.params.id));
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      if (fullName) user.fullName = fullName.trim();
      if (phoneNumber) user.phoneNumber = phoneNumber.trim();
      if (email) user.email = email.trim().toLowerCase();
      if (role) user.role = role.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'DISPATCHER';
      if (status !== undefined) user.status = Boolean(status);
      user.updatedAt = new Date();

      await logAudit({
        req,
        action: 'UPDATE_USER',
        entityType: 'USER',
        entityId: user._id,
        entityName: `${user.fullName} (${user.username})`,
        details: { role: user.role, status: user.status }
      });

      return res.json({ success: true, message: 'User updated successfully', data: user });
    }

    const user = await Admin.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (fullName) user.fullName = fullName.trim();
    if (phoneNumber) user.phoneNumber = phoneNumber.trim();
    if (email) user.email = email.trim().toLowerCase();
    if (role) user.role = role.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'DISPATCHER';
    if (status !== undefined) user.status = Boolean(status);
    if (password && password.trim().length >= 6) user.password = password.trim();

    await user.save();

    await logAudit({
      req,
      action: 'UPDATE_USER',
      entityType: 'USER',
      entityId: user._id,
      entityName: `${user.fullName} (${user.username})`,
      details: { role: user.role, status: user.status, phone: user.phoneNumber }
    });

    const sanitized = user.toObject();
    delete sanitized.password;
    res.json({ success: true, message: 'User updated successfully', data: sanitized });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/users/:id/status', protect, requireAdmin, async (req, res) => {
  try {
    if (!isDb()) {
      const user = mockUsers.find(u => String(u._id) === String(req.params.id));
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      user.status = req.body.status !== undefined ? Boolean(req.body.status) : !user.status;
      user.updatedAt = new Date();

      await logAudit({
        req,
        action: user.status ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
        entityType: 'USER',
        entityId: user._id,
        entityName: `${user.fullName} (${user.username})`,
        details: { status: user.status }
      });

      return res.json({ success: true, message: `User ${user.status ? 'activated' : 'deactivated'} successfully`, data: { id: user._id, status: user.status } });
    }

    const user = await Admin.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.status = req.body.status !== undefined ? Boolean(req.body.status) : !user.status;
    await user.save();

    await logAudit({
      req,
      action: user.status ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      entityType: 'USER',
      entityId: user._id,
      entityName: `${user.fullName} (${user.username})`,
      details: { status: user.status }
    });

    res.json({ success: true, message: `User ${user.status ? 'activated' : 'deactivated'} successfully`, data: { id: user._id, status: user.status } });
  } catch (err) {
    console.error('Error toggling user status:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/users/:id/reset-password', protect, requireAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    if (!isDb()) {
      const user = mockUsers.find(u => String(u._id) === String(req.params.id));
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      await logAudit({
        req,
        action: 'RESET_PASSWORD',
        entityType: 'USER',
        entityId: user._id,
        entityName: `${user.fullName} (${user.username})`,
        details: { resetBy: req.admin.username }
      });
      return res.json({ success: true, message: `Password reset successfully for ${user.username}` });
    }

    const user = await Admin.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.password = newPassword;
    await user.save();

    await logAudit({
      req,
      action: 'RESET_PASSWORD',
      entityType: 'USER',
      entityId: user._id,
      entityName: `${user.fullName} (${user.username})`,
      details: { resetBy: req.admin.username }
    });

    res.json({ success: true, message: `Password reset successfully for ${user.username}` });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// 3. CLIENT COMPANIES & RATE CARDS
// =========================================================================

router.get('/companies', protect, async (req, res) => {
  try {
    const { search, status } = req.query;

    if (!isDb()) {
      let filtered = [...mockCompanies];
      if (status !== undefined && status !== '') {
        const boolStatus = status === 'true';
        filtered = filtered.filter(c => c.status === boolStatus);
      }
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(c =>
          c.companyName.toLowerCase().includes(s) ||
          c.gstin.toLowerCase().includes(s) ||
          c.state.toLowerCase().includes(s)
        );
      }
      return res.json({ success: true, count: filtered.length, data: filtered });
    }

    let query = {};
    if (status !== undefined && status !== '') query.status = status === 'true';
    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { gstin: { $regex: search, $options: 'i' } },
        { state: { $regex: search, $options: 'i' } },
        { contactPersonName: { $regex: search, $options: 'i' } }
      ];
    }

    const companies = await Company.find(query).sort({ createdAt: -1 });
    res.json({ success: true, count: companies.length, data: companies });
  } catch (err) {
    console.error('Error fetching companies:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/companies/:id', protect, async (req, res) => {
  try {
    if (!isDb()) {
      const comp = mockCompanies.find(c => String(c._id) === String(req.params.id));
      if (!comp) return res.status(404).json({ success: false, message: 'Company not found' });
      return res.json({ success: true, data: comp });
    }

    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true, data: company });
  } catch (err) {
    console.error('Error fetching company:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/companies', protect, async (req, res) => {
  try {
    const {
      companyName,
      billingAddress,
      state,
      stateCode,
      gstin,
      creditPeriodDays,
      gstRate,
      billingCalculationMode,
      extraHourRoundingRule,
      fuelSurchargeRule,
      tollParkingTaxable,
      contactPersonName,
      contactPersonPhone,
      contactPersonEmail,
      status,
      rateCards
    } = req.body;

    if (!companyName || !billingAddress || !state || !stateCode || !gstin) {
      return res.status(400).json({
        success: false,
        message: 'Company Name, Billing Address, State, State Code, and GSTIN are required'
      });
    }

    const cleanGstin = gstin.trim().toUpperCase();
    if (cleanGstin.length !== 15) {
      return res.status(400).json({ success: false, message: 'GSTIN must be exactly 15 alphanumeric characters' });
    }

    const companyData = {
      companyName: companyName.trim(),
      billingAddress: billingAddress.trim(),
      state: state.trim(),
      stateCode: stateCode.trim().toUpperCase(),
      gstin: cleanGstin,
      creditPeriodDays: Number(creditPeriodDays) || 30,
      gstRate: gstRate !== undefined ? Number(gstRate) : 5.0,
      billingCalculationMode: billingCalculationMode || 'GARAGE_TO_GARAGE',
      extraHourRoundingRule: extraHourRoundingRule || 'ROUND_60_MIN',
      fuelSurchargeRule: fuelSurchargeRule || { ruleType: 'NONE', value: 0 },
      tollParkingTaxable: Boolean(tollParkingTaxable),
      contactPersonName: (contactPersonName || '').trim(),
      contactPersonPhone: (contactPersonPhone || '').trim(),
      contactPersonEmail: (contactPersonEmail || '').trim().toLowerCase(),
      status: status !== undefined ? Boolean(status) : true,
      rateCards: Array.isArray(rateCards) ? rateCards : [],
      createdBy: req.admin.username || 'admin',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!isDb()) {
      delete companyData._id;
      const newComp = { ...companyData, _id: 'mock_comp_' + Date.now() };
      mockCompanies.unshift(newComp);

      await logAudit({
        req,
        action: 'CREATE_COMPANY',
        entityType: 'COMPANY',
        entityId: newComp._id,
        entityName: newComp.companyName,
        details: { gstin: newComp.gstin, stateCode: newComp.stateCode, creditPeriodDays: newComp.creditPeriodDays }
      });

      return res.status(201).json({ success: true, message: 'Client company created successfully', data: newComp });
    }

    const newCompany = new Company(companyData);
    await newCompany.save();

    await logAudit({
      req,
      action: 'CREATE_COMPANY',
      entityType: 'COMPANY',
      entityId: newCompany._id,
      entityName: newCompany.companyName,
      details: {
        gstin: newCompany.gstin,
        stateCode: newCompany.stateCode,
        creditPeriodDays: newCompany.creditPeriodDays,
        rateCardsCount: newCompany.rateCards.length
      }
    });

    res.status(201).json({ success: true, message: 'Client company created successfully', data: newCompany });
  } catch (err) {
    console.error('Error creating company:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/companies/:id', protect, async (req, res) => {
  try {
    const {
      companyName,
      billingAddress,
      state,
      stateCode,
      gstin,
      creditPeriodDays,
      gstRate,
      billingCalculationMode,
      extraHourRoundingRule,
      fuelSurchargeRule,
      tollParkingTaxable,
      contactPersonName,
      contactPersonPhone,
      contactPersonEmail,
      status
    } = req.body;

    if (!isDb()) {
      const comp = mockCompanies.find(c => String(c._id) === String(req.params.id));
      if (!comp) return res.status(404).json({ success: false, message: 'Company not found' });

      if (companyName) comp.companyName = companyName.trim();
      if (billingAddress) comp.billingAddress = billingAddress.trim();
      if (state) comp.state = state.trim();
      if (stateCode) comp.stateCode = stateCode.trim().toUpperCase();
      if (gstin) comp.gstin = gstin.trim().toUpperCase();
      if (creditPeriodDays !== undefined) comp.creditPeriodDays = Number(creditPeriodDays);
      if (gstRate !== undefined) comp.gstRate = Number(gstRate);
      if (billingCalculationMode) comp.billingCalculationMode = billingCalculationMode;
      if (extraHourRoundingRule) comp.extraHourRoundingRule = extraHourRoundingRule;
      if (fuelSurchargeRule) comp.fuelSurchargeRule = fuelSurchargeRule;
      if (tollParkingTaxable !== undefined) comp.tollParkingTaxable = Boolean(tollParkingTaxable);
      if (contactPersonName !== undefined) comp.contactPersonName = contactPersonName.trim();
      if (contactPersonPhone !== undefined) comp.contactPersonPhone = contactPersonPhone.trim();
      if (contactPersonEmail !== undefined) comp.contactPersonEmail = contactPersonEmail.trim().toLowerCase();
      if (status !== undefined) comp.status = Boolean(status);
      comp.updatedAt = new Date();

      await logAudit({
        req,
        action: 'UPDATE_COMPANY',
        entityType: 'COMPANY',
        entityId: comp._id,
        entityName: comp.companyName,
        details: { gstin: comp.gstin, stateCode: comp.stateCode, status: comp.status }
      });

      return res.json({ success: true, message: 'Company updated successfully', data: comp });
    }

    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    if (companyName) company.companyName = companyName.trim();
    if (billingAddress) company.billingAddress = billingAddress.trim();
    if (state) company.state = state.trim();
    if (stateCode) company.stateCode = stateCode.trim().toUpperCase();
    if (gstin) company.gstin = gstin.trim().toUpperCase();
    if (creditPeriodDays !== undefined) company.creditPeriodDays = Number(creditPeriodDays);
    if (gstRate !== undefined) company.gstRate = Number(gstRate);
    if (billingCalculationMode) company.billingCalculationMode = billingCalculationMode;
    if (extraHourRoundingRule) company.extraHourRoundingRule = extraHourRoundingRule;
    if (fuelSurchargeRule) company.fuelSurchargeRule = fuelSurchargeRule;
    if (tollParkingTaxable !== undefined) company.tollParkingTaxable = Boolean(tollParkingTaxable);
    if (contactPersonName !== undefined) company.contactPersonName = contactPersonName.trim();
    if (contactPersonPhone !== undefined) company.contactPersonPhone = contactPersonPhone.trim();
    if (contactPersonEmail !== undefined) company.contactPersonEmail = contactPersonEmail.trim().toLowerCase();
    if (status !== undefined) company.status = Boolean(status);

    await company.save();

    await logAudit({
      req,
      action: 'UPDATE_COMPANY',
      entityType: 'COMPANY',
      entityId: company._id,
      entityName: company.companyName,
      details: { gstin: company.gstin, stateCode: company.stateCode, status: company.status }
    });

    res.json({ success: true, message: 'Company updated successfully', data: company });
  } catch (err) {
    console.error('Error updating company:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/companies/:id/status', protect, async (req, res) => {
  try {
    if (!isDb()) {
      const comp = mockCompanies.find(c => String(c._id) === String(req.params.id));
      if (!comp) return res.status(404).json({ success: false, message: 'Company not found' });
      comp.status = req.body.status !== undefined ? Boolean(req.body.status) : !comp.status;
      comp.updatedAt = new Date();

      await logAudit({
        req,
        action: comp.status ? 'ACTIVATE_COMPANY' : 'DEACTIVATE_COMPANY',
        entityType: 'COMPANY',
        entityId: comp._id,
        entityName: comp.companyName,
        details: { status: comp.status }
      });

      return res.json({ success: true, message: `Company ${comp.status ? 'activated' : 'deactivated'} successfully`, data: { id: comp._id, status: comp.status } });
    }

    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    company.status = req.body.status !== undefined ? Boolean(req.body.status) : !company.status;
    await company.save();

    await logAudit({
      req,
      action: company.status ? 'ACTIVATE_COMPANY' : 'DEACTIVATE_COMPANY',
      entityType: 'COMPANY',
      entityId: company._id,
      entityName: company.companyName,
      details: { status: company.status }
    });

    res.json({ success: true, message: `Company ${company.status ? 'activated' : 'deactivated'} successfully`, data: { id: company._id, status: company.status } });
  } catch (err) {
    console.error('Error toggling company status:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/companies/:id', protect, requireAdmin, async (req, res) => {
  try {
    if (!isDb()) {
      const idx = mockCompanies.findIndex(c => String(c._id) === String(req.params.id));
      if (idx === -1) return res.status(404).json({ success: false, message: 'Company not found' });
      const name = mockCompanies[idx].companyName;
      mockCompanies.splice(idx, 1);

      await logAudit({
        req,
        action: 'DELETE_COMPANY',
        entityType: 'COMPANY',
        entityId: req.params.id,
        entityName: name,
        details: { deletedCompany: name }
      });

      return res.json({ success: true, message: 'Company deleted successfully' });
    }

    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    await Company.findByIdAndDelete(req.params.id);

    await logAudit({
      req,
      action: 'DELETE_COMPANY',
      entityType: 'COMPANY',
      entityId: req.params.id,
      entityName: company.companyName,
      details: { deletedCompany: company.companyName }
    });

    res.json({ success: true, message: 'Company deleted successfully' });
  } catch (err) {
    console.error('Error deleting company:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- Rate Card Sub-routes ---

router.post('/companies/:id/rate-cards', protect, async (req, res) => {
  try {
    const {
      vehicleCategory,
      packageName,
      baseHours,
      baseKms,
      basePackageRate,
      extraKmRate,
      extraHourRate,
      driverDayAllowance,
      nightLateAllowance
    } = req.body;

    if (!vehicleCategory || !packageName || baseHours === undefined || baseKms === undefined || basePackageRate === undefined || extraKmRate === undefined || extraHourRate === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle Category, Package Name, Base Hours, Base KMs, Base Rate, Extra KM Rate, and Extra Hour Rate are required'
      });
    }

    const rateCard = {
      vehicleCategory: vehicleCategory.trim(),
      packageName: packageName.trim(),
      baseHours: Number(baseHours),
      baseKms: Number(baseKms),
      basePackageRate: Number(basePackageRate),
      extraKmRate: Number(extraKmRate),
      extraHourRate: Number(extraHourRate),
      driverDayAllowance: Number(driverDayAllowance) || 0,
      nightLateAllowance: Number(nightLateAllowance) || 0
    };

    if (!isDb()) {
      const comp = mockCompanies.find(c => String(c._id) === String(req.params.id));
      if (!comp) return res.status(404).json({ success: false, message: 'Company not found' });
      delete rateCard._id;
      const newCard = { ...rateCard, _id: 'mock_rc_' + Date.now() };
      comp.rateCards.push(newCard);

      await logAudit({
        req,
        action: 'ADD_RATE_CARD',
        entityType: 'RATE_CARD',
        entityId: newCard._id,
        entityName: `${comp.companyName} - ${rateCard.vehicleCategory} (${rateCard.packageName})`,
        details: { companyId: comp._id, ...rateCard }
      });

      return res.status(201).json({ success: true, message: 'Rate card added successfully', data: newCard });
    }

    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    company.rateCards.push(rateCard);
    await company.save();

    const createdCard = company.rateCards[company.rateCards.length - 1];

    await logAudit({
      req,
      action: 'ADD_RATE_CARD',
      entityType: 'RATE_CARD',
      entityId: createdCard._id,
      entityName: `${company.companyName} - ${rateCard.vehicleCategory} (${rateCard.packageName})`,
      details: { companyId: company._id, ...rateCard }
    });

    res.status(201).json({ success: true, message: 'Rate card added successfully', data: createdCard });
  } catch (err) {
    console.error('Error adding rate card:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/companies/:id/rate-cards/:rateCardId', protect, async (req, res) => {
  try {
    const {
      vehicleCategory,
      packageName,
      baseHours,
      baseKms,
      basePackageRate,
      extraKmRate,
      extraHourRate,
      driverDayAllowance,
      nightLateAllowance
    } = req.body;

    if (!isDb()) {
      const comp = mockCompanies.find(c => String(c._id) === String(req.params.id));
      if (!comp) return res.status(404).json({ success: false, message: 'Company not found' });
      const card = comp.rateCards.find(rc => String(rc._id) === String(req.params.rateCardId));
      if (!card) return res.status(404).json({ success: false, message: 'Rate card not found' });

      if (vehicleCategory) card.vehicleCategory = vehicleCategory.trim();
      if (packageName) card.packageName = packageName.trim();
      if (baseHours !== undefined) card.baseHours = Number(baseHours);
      if (baseKms !== undefined) card.baseKms = Number(baseKms);
      if (basePackageRate !== undefined) card.basePackageRate = Number(basePackageRate);
      if (extraKmRate !== undefined) card.extraKmRate = Number(extraKmRate);
      if (extraHourRate !== undefined) card.extraHourRate = Number(extraHourRate);
      if (driverDayAllowance !== undefined) card.driverDayAllowance = Number(driverDayAllowance);
      if (nightLateAllowance !== undefined) card.nightLateAllowance = Number(nightLateAllowance);

      await logAudit({
        req,
        action: 'UPDATE_RATE_CARD',
        entityType: 'RATE_CARD',
        entityId: card._id,
        entityName: `${comp.companyName} - ${card.vehicleCategory} (${card.packageName})`,
        details: { companyId: comp._id, ...card }
      });

      return res.json({ success: true, message: 'Rate card updated successfully', data: card });
    }

    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    const card = company.rateCards.id(req.params.rateCardId);
    if (!card) return res.status(404).json({ success: false, message: 'Rate card not found' });

    if (vehicleCategory) card.vehicleCategory = vehicleCategory.trim();
    if (packageName) card.packageName = packageName.trim();
    if (baseHours !== undefined) card.baseHours = Number(baseHours);
    if (baseKms !== undefined) card.baseKms = Number(baseKms);
    if (basePackageRate !== undefined) card.basePackageRate = Number(basePackageRate);
    if (extraKmRate !== undefined) card.extraKmRate = Number(extraKmRate);
    if (extraHourRate !== undefined) card.extraHourRate = Number(extraHourRate);
    if (driverDayAllowance !== undefined) card.driverDayAllowance = Number(driverDayAllowance);
    if (nightLateAllowance !== undefined) card.nightLateAllowance = Number(nightLateAllowance);

    await company.save();

    await logAudit({
      req,
      action: 'UPDATE_RATE_CARD',
      entityType: 'RATE_CARD',
      entityId: card._id,
      entityName: `${company.companyName} - ${card.vehicleCategory} (${card.packageName})`,
      details: { companyId: company._id, ...card.toObject() }
    });

    res.json({ success: true, message: 'Rate card updated successfully', data: card });
  } catch (err) {
    console.error('Error updating rate card:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/companies/:id/rate-cards/:rateCardId', protect, async (req, res) => {
  try {
    if (!isDb()) {
      const comp = mockCompanies.find(c => String(c._id) === String(req.params.id));
      if (!comp) return res.status(404).json({ success: false, message: 'Company not found' });
      const idx = comp.rateCards.findIndex(rc => String(rc._id) === String(req.params.rateCardId));
      if (idx === -1) return res.status(404).json({ success: false, message: 'Rate card not found' });
      const card = comp.rateCards[idx];
      comp.rateCards.splice(idx, 1);

      await logAudit({
        req,
        action: 'DELETE_RATE_CARD',
        entityType: 'RATE_CARD',
        entityId: req.params.rateCardId,
        entityName: `${comp.companyName} - ${card.vehicleCategory} (${card.packageName})`,
        details: { companyId: comp._id }
      });

      return res.json({ success: true, message: 'Rate card deleted successfully' });
    }

    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    const card = company.rateCards.id(req.params.rateCardId);
    if (!card) return res.status(404).json({ success: false, message: 'Rate card not found' });

    const cardName = `${card.vehicleCategory} - ${card.packageName}`;
    company.rateCards.pull(req.params.rateCardId);
    await company.save();

    await logAudit({
      req,
      action: 'DELETE_RATE_CARD',
      entityType: 'RATE_CARD',
      entityId: req.params.rateCardId,
      entityName: `${company.companyName} - ${cardName}`,
      details: { companyId: company._id }
    });

    res.json({ success: true, message: 'Rate card deleted successfully' });
  } catch (err) {
    console.error('Error deleting rate card:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// 4. VENDORS & OPTIONAL FLEET (VEHICLES & DRIVERS)
// =========================================================================

router.get('/vendors', protect, async (req, res) => {
  try {
    const { search, status } = req.query;

    let list = [];
    if (!isDb()) {
      list = [...mockVendors];
      if (status !== undefined && status !== '') {
        const boolStatus = status === 'true';
        list = list.filter(v => v.status === boolStatus);
      }
      if (search) {
        const s = search.toLowerCase();
        list = list.filter(v =>
          v.vendorName.toLowerCase().includes(s) ||
          v.contactPerson.toLowerCase().includes(s) ||
          v.phone.includes(s)
        );
      }
    } else {
      let query = {};
      if (status !== undefined && status !== '') query.status = status === 'true';
      if (search) {
        query.$or = [
          { vendorName: { $regex: search, $options: 'i' } },
          { contactPerson: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { gstin: { $regex: search, $options: 'i' } }
        ];
      }
      const dbVendors = await Vendor.find(query).sort({ createdAt: -1 });
      list = dbVendors.map(v => v.toObject());
    }

    const enriched = list.map(v => {
      let alertCount = 0;
      let expiredCount = 0;
      let expiringSoonCount = 0;

      (v.vehicles || []).forEach(veh => {
        ['insuranceExpiryDate', 'fitnessExpiryDate', 'permitExpiryDate'].forEach(field => {
          const exp = getExpiryStatus(veh[field]);
          if (exp) {
            if (exp.level === 'red') { alertCount++; expiredCount++; }
            if (exp.level === 'amber') { alertCount++; expiringSoonCount++; }
          }
        });
      });

      (v.drivers || []).forEach(drv => {
        const exp = getExpiryStatus(drv.licenseExpiryDate);
        if (exp) {
          if (exp.level === 'red') { alertCount++; expiredCount++; }
          if (exp.level === 'amber') { alertCount++; expiringSoonCount++; }
        }
      });

      return {
        ...v,
        summary: {
          vehicleCount: (v.vehicles || []).length,
          driverCount: (v.drivers || []).length,
          alertCount,
          expiredCount,
          expiringSoonCount
        }
      };
    });

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (err) {
    console.error('Error fetching vendors:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/vendors/:id', protect, async (req, res) => {
  try {
    let doc = null;
    if (!isDb()) {
      const vendor = mockVendors.find(v => String(v._id) === String(req.params.id));
      if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
      doc = JSON.parse(JSON.stringify(vendor));
    } else {
      const vendor = await Vendor.findById(req.params.id);
      if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
      doc = vendor.toObject();
    }

    // Attach computed expiry alert badges
    doc.vehicles = (doc.vehicles || []).map(v => ({
      ...v,
      insuranceAlert: getExpiryStatus(v.insuranceExpiryDate),
      fitnessAlert: getExpiryStatus(v.fitnessExpiryDate),
      permitAlert: getExpiryStatus(v.permitExpiryDate),
      pucAlert: getExpiryStatus(v.pucExpiryDate)
    }));

    doc.drivers = (doc.drivers || []).map(d => ({
      ...d,
      licenseAlert: getExpiryStatus(d.licenseExpiryDate)
    }));

    res.json({ success: true, data: doc });
  } catch (err) {
    console.error('Error fetching vendor:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/vendors', protect, async (req, res) => {
  try {
    const {
      vendorName,
      contactPerson,
      phone,
      email,
      address,
      gstin,
      pan,
      bankDetails,
      defaultCommissionNotes,
      status,
      vehicles,
      drivers
    } = req.body;

    if (!vendorName || !contactPerson || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Vendor / Agency Name, Contact Person Name, and Phone / WhatsApp Number are required'
      });
    }

    const cleanGstin = (gstin || '').trim().toUpperCase();
    const cleanPan = (pan || '').trim().toUpperCase();

    const vendorData = {
      vendorName: vendorName.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: (email || '').trim().toLowerCase(),
      address: (address || '').trim(),
      gstin: cleanGstin,
      pan: cleanPan,
      bankDetails: bankDetails || { accountNumber: '', ifsc: '', bankName: '' },
      defaultCommissionNotes: (defaultCommissionNotes || '').trim(),
      status: status !== undefined ? Boolean(status) : true,
      vehicles: Array.isArray(vehicles) ? vehicles : [],
      drivers: Array.isArray(drivers) ? drivers : [],
      createdBy: req.admin.username || 'admin',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (!isDb()) {
      delete vendorData._id;
      const newV = { ...vendorData, _id: 'mock_v_' + Date.now() };
      mockVendors.unshift(newV);

      await logAudit({
        req,
        action: 'CREATE_VENDOR',
        entityType: 'VENDOR',
        entityId: newV._id,
        entityName: newV.vendorName,
        details: { contactPerson: newV.contactPerson, phone: newV.phone, vehiclesCount: newV.vehicles.length, driversCount: newV.drivers.length }
      });

      return res.status(201).json({
        success: true,
        message: 'Vendor created successfully (with optional vehicles and drivers)',
        data: newV
      });
    }

    const newVendor = new Vendor(vendorData);
    await newVendor.save();

    await logAudit({
      req,
      action: 'CREATE_VENDOR',
      entityType: 'VENDOR',
      entityId: newVendor._id,
      entityName: newVendor.vendorName,
      details: {
        contactPerson: newVendor.contactPerson,
        phone: newVendor.phone,
        vehiclesCount: newVendor.vehicles.length,
        driversCount: newVendor.drivers.length
      }
    });

    res.status(201).json({
      success: true,
      message: 'Vendor created successfully (with optional vehicles and drivers)',
      data: newVendor
    });
  } catch (err) {
    console.error('Error creating vendor:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/vendors/:id', protect, async (req, res) => {
  try {
    const {
      vendorName,
      contactPerson,
      phone,
      email,
      address,
      gstin,
      pan,
      bankDetails,
      defaultCommissionNotes,
      status
    } = req.body;

    if (!isDb()) {
      const vendor = mockVendors.find(v => String(v._id) === String(req.params.id));
      if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

      if (vendorName) vendor.vendorName = vendorName.trim();
      if (contactPerson) vendor.contactPerson = contactPerson.trim();
      if (phone) vendor.phone = phone.trim();
      if (email !== undefined) vendor.email = email.trim().toLowerCase();
      if (address !== undefined) vendor.address = address.trim();
      if (gstin !== undefined) vendor.gstin = gstin.trim().toUpperCase();
      if (pan !== undefined) vendor.pan = pan.trim().toUpperCase();
      if (bankDetails) vendor.bankDetails = bankDetails;
      if (defaultCommissionNotes !== undefined) vendor.defaultCommissionNotes = defaultCommissionNotes.trim();
      if (status !== undefined) vendor.status = Boolean(status);
      vendor.updatedAt = new Date();

      await logAudit({
        req,
        action: 'UPDATE_VENDOR',
        entityType: 'VENDOR',
        entityId: vendor._id,
        entityName: vendor.vendorName,
        details: { contactPerson: vendor.contactPerson, phone: vendor.phone, status: vendor.status }
      });

      return res.json({ success: true, message: 'Vendor updated successfully', data: vendor });
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    if (vendorName) vendor.vendorName = vendorName.trim();
    if (contactPerson) vendor.contactPerson = contactPerson.trim();
    if (phone) vendor.phone = phone.trim();
    if (email !== undefined) vendor.email = email.trim().toLowerCase();
    if (address !== undefined) vendor.address = address.trim();
    if (gstin !== undefined) vendor.gstin = gstin.trim().toUpperCase();
    if (pan !== undefined) vendor.pan = pan.trim().toUpperCase();
    if (bankDetails) vendor.bankDetails = bankDetails;
    if (defaultCommissionNotes !== undefined) vendor.defaultCommissionNotes = defaultCommissionNotes.trim();
    if (status !== undefined) vendor.status = Boolean(status);

    await vendor.save();

    await logAudit({
      req,
      action: 'UPDATE_VENDOR',
      entityType: 'VENDOR',
      entityId: vendor._id,
      entityName: vendor.vendorName,
      details: { contactPerson: vendor.contactPerson, phone: vendor.phone, status: vendor.status }
    });

    res.json({ success: true, message: 'Vendor updated successfully', data: vendor });
  } catch (err) {
    console.error('Error updating vendor:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/vendors/:id/status', protect, async (req, res) => {
  try {
    if (!isDb()) {
      const vendor = mockVendors.find(v => String(v._id) === String(req.params.id));
      if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
      vendor.status = req.body.status !== undefined ? Boolean(req.body.status) : !vendor.status;
      vendor.updatedAt = new Date();

      await logAudit({
        req,
        action: vendor.status ? 'ACTIVATE_VENDOR' : 'DEACTIVATE_VENDOR',
        entityType: 'VENDOR',
        entityId: vendor._id,
        entityName: vendor.vendorName,
        details: { status: vendor.status }
      });

      return res.json({ success: true, message: `Vendor ${vendor.status ? 'activated' : 'deactivated'} successfully`, data: { id: vendor._id, status: vendor.status } });
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    vendor.status = req.body.status !== undefined ? Boolean(req.body.status) : !vendor.status;
    await vendor.save();

    await logAudit({
      req,
      action: vendor.status ? 'ACTIVATE_VENDOR' : 'DEACTIVATE_VENDOR',
      entityType: 'VENDOR',
      entityId: vendor._id,
      entityName: vendor.vendorName,
      details: { status: vendor.status }
    });

    res.json({ success: true, message: `Vendor ${vendor.status ? 'activated' : 'deactivated'} successfully`, data: { id: vendor._id, status: vendor.status } });
  } catch (err) {
    console.error('Error toggling vendor status:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/vendors/:id', protect, requireAdmin, async (req, res) => {
  try {
    if (!isDb()) {
      const idx = mockVendors.findIndex(v => String(v._id) === String(req.params.id));
      if (idx === -1) return res.status(404).json({ success: false, message: 'Vendor not found' });
      const name = mockVendors[idx].vendorName;
      mockVendors.splice(idx, 1);

      await logAudit({
        req,
        action: 'DELETE_VENDOR',
        entityType: 'VENDOR',
        entityId: req.params.id,
        entityName: name,
        details: { deletedVendor: name }
      });

      return res.json({ success: true, message: 'Vendor deleted successfully' });
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    await Vendor.findByIdAndDelete(req.params.id);

    await logAudit({
      req,
      action: 'DELETE_VENDOR',
      entityType: 'VENDOR',
      entityId: req.params.id,
      entityName: vendor.vendorName,
      details: { deletedVendor: vendor.vendorName }
    });

    res.json({ success: true, message: 'Vendor deleted successfully' });
  } catch (err) {
    console.error('Error deleting vendor:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- Vendor Vehicles Sub-routes ---

router.post('/vendors/:id/vehicles', protect, async (req, res) => {
  try {
    const {
      registrationNumber,
      vehicleCategory,
      vehicleModel,
      insuranceExpiryDate,
      fitnessExpiryDate,
      permitExpiryDate,
      pucExpiryDate,
      status
    } = req.body;

    if (!registrationNumber || !vehicleCategory) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle Registration Number and Vehicle Category are required'
      });
    }

    const cleanReg = registrationNumber.trim().toUpperCase().replace(/\s+/g, ' ');

    const vehicleObj = {
      registrationNumber: cleanReg,
      vehicleCategory: vehicleCategory.trim(),
      vehicleModel: (vehicleModel || '').trim(),
      insuranceExpiryDate: insuranceExpiryDate ? new Date(insuranceExpiryDate) : null,
      fitnessExpiryDate: fitnessExpiryDate ? new Date(fitnessExpiryDate) : null,
      permitExpiryDate: permitExpiryDate ? new Date(permitExpiryDate) : null,
      pucExpiryDate: pucExpiryDate ? new Date(pucExpiryDate) : null,
      status: status !== undefined ? Boolean(status) : true
    };

    if (!isDb()) {
      const vendor = mockVendors.find(v => String(v._id) === String(req.params.id));
      if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
      const dup = vendor.vehicles.find(v => v.registrationNumber === cleanReg);
      if (dup) return res.status(400).json({ success: false, message: `Vehicle ${cleanReg} already exists under this vendor` });

      delete vehicleObj._id;
      const createdVeh = { ...vehicleObj, _id: 'mock_veh_' + Date.now() };
      vendor.vehicles.push(createdVeh);

      await logAudit({
        req,
        action: 'ADD_VEHICLE',
        entityType: 'VEHICLE',
        entityId: createdVeh._id,
        entityName: `${cleanReg} (${vehicleObj.vehicleCategory})`,
        details: { vendorId: vendor._id, vendorName: vendor.vendorName, registrationNumber: cleanReg }
      });

      return res.status(201).json({ success: true, message: 'Vehicle added successfully', data: createdVeh });
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const duplicate = vendor.vehicles.find(v => v.registrationNumber === cleanReg);
    if (duplicate) return res.status(400).json({ success: false, message: `Vehicle ${cleanReg} already exists under this vendor` });

    vendor.vehicles.push(vehicleObj);
    await vendor.save();

    const createdVeh = vendor.vehicles[vendor.vehicles.length - 1];

    await logAudit({
      req,
      action: 'ADD_VEHICLE',
      entityType: 'VEHICLE',
      entityId: createdVeh._id,
      entityName: `${cleanReg} (${vehicleObj.vehicleCategory})`,
      details: { vendorId: vendor._id, vendorName: vendor.vendorName, registrationNumber: cleanReg, category: vehicleObj.vehicleCategory }
    });

    res.status(201).json({ success: true, message: 'Vehicle added successfully', data: createdVeh });
  } catch (err) {
    console.error('Error adding vehicle:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/vendors/:id/vehicles/:vehicleId', protect, async (req, res) => {
  try {
    const {
      registrationNumber,
      vehicleCategory,
      vehicleModel,
      insuranceExpiryDate,
      fitnessExpiryDate,
      permitExpiryDate,
      pucExpiryDate,
      status
    } = req.body;

    if (!isDb()) {
      const vendor = mockVendors.find(v => String(v._id) === String(req.params.id));
      if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
      const vehicle = vendor.vehicles.find(v => String(v._id) === String(req.params.vehicleId));
      if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

      if (registrationNumber) vehicle.registrationNumber = registrationNumber.trim().toUpperCase().replace(/\s+/g, ' ');
      if (vehicleCategory) vehicle.vehicleCategory = vehicleCategory.trim();
      if (vehicleModel !== undefined) vehicle.vehicleModel = vehicleModel.trim();
      if (insuranceExpiryDate !== undefined) vehicle.insuranceExpiryDate = insuranceExpiryDate ? new Date(insuranceExpiryDate) : null;
      if (fitnessExpiryDate !== undefined) vehicle.fitnessExpiryDate = fitnessExpiryDate ? new Date(fitnessExpiryDate) : null;
      if (permitExpiryDate !== undefined) vehicle.permitExpiryDate = permitExpiryDate ? new Date(permitExpiryDate) : null;
      if (pucExpiryDate !== undefined) vehicle.pucExpiryDate = pucExpiryDate ? new Date(pucExpiryDate) : null;
      if (status !== undefined) vehicle.status = Boolean(status);

      await logAudit({
        req,
        action: 'UPDATE_VEHICLE',
        entityType: 'VEHICLE',
        entityId: vehicle._id,
        entityName: `${vehicle.registrationNumber} (${vehicle.vehicleCategory})`,
        details: { vendorId: vendor._id, registrationNumber: vehicle.registrationNumber }
      });

      return res.json({ success: true, message: 'Vehicle updated successfully', data: vehicle });
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const vehicle = vendor.vehicles.id(req.params.vehicleId);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    if (registrationNumber) vehicle.registrationNumber = registrationNumber.trim().toUpperCase().replace(/\s+/g, ' ');
    if (vehicleCategory) vehicle.vehicleCategory = vehicleCategory.trim();
    if (vehicleModel !== undefined) vehicle.vehicleModel = vehicleModel.trim();
    if (insuranceExpiryDate !== undefined) vehicle.insuranceExpiryDate = insuranceExpiryDate ? new Date(insuranceExpiryDate) : null;
    if (fitnessExpiryDate !== undefined) vehicle.fitnessExpiryDate = fitnessExpiryDate ? new Date(fitnessExpiryDate) : null;
    if (permitExpiryDate !== undefined) vehicle.permitExpiryDate = permitExpiryDate ? new Date(permitExpiryDate) : null;
    if (pucExpiryDate !== undefined) vehicle.pucExpiryDate = pucExpiryDate ? new Date(pucExpiryDate) : null;
    if (status !== undefined) vehicle.status = Boolean(status);

    await vendor.save();

    await logAudit({
      req,
      action: 'UPDATE_VEHICLE',
      entityType: 'VEHICLE',
      entityId: vehicle._id,
      entityName: `${vehicle.registrationNumber} (${vehicle.vehicleCategory})`,
      details: { vendorId: vendor._id, vendorName: vendor.vendorName, registrationNumber: vehicle.registrationNumber }
    });

    res.json({ success: true, message: 'Vehicle updated successfully', data: vehicle });
  } catch (err) {
    console.error('Error updating vehicle:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/vendors/:id/vehicles/:vehicleId', protect, async (req, res) => {
  try {
    if (!isDb()) {
      const vendor = mockVendors.find(v => String(v._id) === String(req.params.id));
      if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
      const idx = vendor.vehicles.findIndex(v => String(v._id) === String(req.params.vehicleId));
      if (idx === -1) return res.status(404).json({ success: false, message: 'Vehicle not found' });
      const reg = vendor.vehicles[idx].registrationNumber;
      vendor.vehicles.splice(idx, 1);

      await logAudit({
        req,
        action: 'DELETE_VEHICLE',
        entityType: 'VEHICLE',
        entityId: req.params.vehicleId,
        entityName: `${reg} under ${vendor.vendorName}`,
        details: { vendorId: vendor._id }
      });

      return res.json({ success: true, message: 'Vehicle removed successfully' });
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const vehicle = vendor.vehicles.id(req.params.vehicleId);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    const reg = vehicle.registrationNumber;
    vendor.vehicles.pull(req.params.vehicleId);
    await vendor.save();

    await logAudit({
      req,
      action: 'DELETE_VEHICLE',
      entityType: 'VEHICLE',
      entityId: req.params.vehicleId,
      entityName: `${reg} under ${vendor.vendorName}`,
      details: { vendorId: vendor._id }
    });

    res.json({ success: true, message: 'Vehicle removed successfully' });
  } catch (err) {
    console.error('Error deleting vehicle:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- Vendor Drivers Sub-routes ---

router.post('/vendors/:id/drivers', protect, async (req, res) => {
  try {
    const {
      driverName,
      phone,
      licenseNumber,
      licenseExpiryDate,
      badgeStatus,
      status
    } = req.body;

    if (!driverName || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Driver Name and Phone / WhatsApp Number are required'
      });
    }

    const driverObj = {
      driverName: driverName.trim(),
      phone: phone.trim(),
      licenseNumber: (licenseNumber || '').trim().toUpperCase(),
      licenseExpiryDate: licenseExpiryDate ? new Date(licenseExpiryDate) : null,
      badgeStatus: ['VERIFIED', 'PENDING', 'NOT_PROVIDED'].includes(badgeStatus) ? badgeStatus : 'NOT_PROVIDED',
      status: status !== undefined ? Boolean(status) : true
    };

    if (!isDb()) {
      const vendor = mockVendors.find(v => String(v._id) === String(req.params.id));
      if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

      delete driverObj._id;
      const createdDrv = { ...driverObj, _id: 'mock_drv_' + Date.now() };
      vendor.drivers.push(createdDrv);

      await logAudit({
        req,
        action: 'ADD_DRIVER',
        entityType: 'DRIVER',
        entityId: createdDrv._id,
        entityName: `${driverObj.driverName} (${driverObj.phone})`,
        details: { vendorId: vendor._id, vendorName: vendor.vendorName, phone: driverObj.phone }
      });

      return res.status(201).json({ success: true, message: 'Driver added successfully', data: createdDrv });
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    vendor.drivers.push(driverObj);
    await vendor.save();

    const createdDrv = vendor.drivers[vendor.drivers.length - 1];

    await logAudit({
      req,
      action: 'ADD_DRIVER',
      entityType: 'DRIVER',
      entityId: createdDrv._id,
      entityName: `${driverObj.driverName} (${driverObj.phone})`,
      details: { vendorId: vendor._id, vendorName: vendor.vendorName, phone: driverObj.phone, badgeStatus: driverObj.badgeStatus }
    });

    res.status(201).json({ success: true, message: 'Driver added successfully', data: createdDrv });
  } catch (err) {
    console.error('Error adding driver:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/vendors/:id/drivers/:driverId', protect, async (req, res) => {
  try {
    const {
      driverName,
      phone,
      licenseNumber,
      licenseExpiryDate,
      badgeStatus,
      status
    } = req.body;

    if (!isDb()) {
      const vendor = mockVendors.find(v => String(v._id) === String(req.params.id));
      if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
      const driver = vendor.drivers.find(d => String(d._id) === String(req.params.driverId));
      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      if (driverName) driver.driverName = driverName.trim();
      if (phone) driver.phone = phone.trim();
      if (licenseNumber !== undefined) driver.licenseNumber = licenseNumber.trim().toUpperCase();
      if (licenseExpiryDate !== undefined) driver.licenseExpiryDate = licenseExpiryDate ? new Date(licenseExpiryDate) : null;
      if (badgeStatus) driver.badgeStatus = ['VERIFIED', 'PENDING', 'NOT_PROVIDED'].includes(badgeStatus) ? badgeStatus : driver.badgeStatus;
      if (status !== undefined) driver.status = Boolean(status);

      await logAudit({
        req,
        action: 'UPDATE_DRIVER',
        entityType: 'DRIVER',
        entityId: driver._id,
        entityName: `${driver.driverName} (${driver.phone})`,
        details: { vendorId: vendor._id, badgeStatus: driver.badgeStatus }
      });

      return res.json({ success: true, message: 'Driver updated successfully', data: driver });
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const driver = vendor.drivers.id(req.params.driverId);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    if (driverName) driver.driverName = driverName.trim();
    if (phone) driver.phone = phone.trim();
    if (licenseNumber !== undefined) driver.licenseNumber = licenseNumber.trim().toUpperCase();
    if (licenseExpiryDate !== undefined) driver.licenseExpiryDate = licenseExpiryDate ? new Date(licenseExpiryDate) : null;
    if (badgeStatus) driver.badgeStatus = ['VERIFIED', 'PENDING', 'NOT_PROVIDED'].includes(badgeStatus) ? badgeStatus : driver.badgeStatus;
    if (status !== undefined) driver.status = Boolean(status);

    await vendor.save();

    await logAudit({
      req,
      action: 'UPDATE_DRIVER',
      entityType: 'DRIVER',
      entityId: driver._id,
      entityName: `${driver.driverName} (${driver.phone})`,
      details: { vendorId: vendor._id, vendorName: vendor.vendorName, badgeStatus: driver.badgeStatus }
    });

    res.json({ success: true, message: 'Driver updated successfully', data: driver });
  } catch (err) {
    console.error('Error updating driver:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/vendors/:id/drivers/:driverId', protect, async (req, res) => {
  try {
    if (!isDb()) {
      const vendor = mockVendors.find(v => String(v._id) === String(req.params.id));
      if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
      const idx = vendor.drivers.findIndex(d => String(d._id) === String(req.params.driverId));
      if (idx === -1) return res.status(404).json({ success: false, message: 'Driver not found' });
      const dName = vendor.drivers[idx].driverName;
      vendor.drivers.splice(idx, 1);

      await logAudit({
        req,
        action: 'DELETE_DRIVER',
        entityType: 'DRIVER',
        entityId: req.params.driverId,
        entityName: `${dName} under ${vendor.vendorName}`,
        details: { vendorId: vendor._id }
      });

      return res.json({ success: true, message: 'Driver removed successfully' });
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    const driver = vendor.drivers.id(req.params.driverId);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    const dName = driver.driverName;
    vendor.drivers.pull(req.params.driverId);
    await vendor.save();

    await logAudit({
      req,
      action: 'DELETE_DRIVER',
      entityType: 'DRIVER',
      entityId: req.params.driverId,
      entityName: `${dName} under ${vendor.vendorName}`,
      details: { vendorId: vendor._id }
    });

    res.json({ success: true, message: 'Driver removed successfully' });
  } catch (err) {
    console.error('Error deleting driver:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// 5. BOOKINGS & DISPATCH CHART MODULE
// =========================================================================

// Helper: Get next sequence number from broker profile
async function getNextDutySlipSequence() {
  if (!isDb()) {
    const seq = mockBrokerProfile.dutySlipNextSequence || 73426;
    mockBrokerProfile.dutySlipNextSequence = seq + 1;
    return String(seq);
  }
  let profile = await BrokerProfile.findOne();
  if (!profile) profile = await BrokerProfile.create({});
  const seq = profile.dutySlipNextSequence || 73426;
  profile.dutySlipNextSequence = seq + 1;
  await profile.save();
  return String(seq);
}

// Helper: Check non-blocking warnings (overlaps and document expiry)
async function checkBookingWarnings(booking, currentBookingId = null) {
  const warnings = [];
  const targetDateStr = booking.travelDate ? new Date(booking.travelDate).toISOString().split('T')[0] : null;

  // 1. Overlapping booking check
  if (targetDateStr) {
    let existingBookings = [];
    if (!isDb()) {
      existingBookings = mockBookings.filter(b =>
        String(b._id) !== String(currentBookingId) &&
        b.status !== 'STATUS_CANCEL' &&
        b.travelDate &&
        new Date(b.travelDate).toISOString().split('T')[0] === targetDateStr
      );
    } else {
      const start = new Date(targetDateStr);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      existingBookings = await AggregatorBooking.find({
        _id: { $ne: currentBookingId },
        status: { $ne: 'STATUS_CANCEL' },
        travelDate: { $gte: start, $lt: end }
      });
    }

    if (booking.vehicleNumber) {
      const vMatch = existingBookings.find(b => (b.vehicleNumber || '').toUpperCase() === booking.vehicleNumber.toUpperCase());
      if (vMatch) {
        warnings.push(`Notice: Vehicle ${booking.vehicleNumber} is already plotted on another booking (#${vMatch.bookingNo || vMatch.dutySlipNo}) on this date.`);
      }
    }

    if (booking.driverName) {
      const dMatch = existingBookings.find(b => (b.driverName || '').toLowerCase() === booking.driverName.toLowerCase());
      if (dMatch) {
        warnings.push(`Notice: Driver ${booking.driverName} is already assigned on another booking (#${dMatch.bookingNo || dMatch.dutySlipNo}) on this date.`);
      }
    }
  }

  // 2. Document expiry check
  if (booking.vendorId || booking.vendorName) {
    let vendor = null;
    if (!isDb()) {
      vendor = mockVendors.find(v => String(v._id) === String(booking.vendorId) || v.vendorName === booking.vendorName);
    } else {
      vendor = await findVendorDoc(booking.vendorId, booking.vendorName);
    }

    if (vendor) {
      if (booking.vehicleNumber) {
        const veh = (vendor.vehicles || []).find(v => (v.registrationNumber || '').toUpperCase() === booking.vehicleNumber.toUpperCase());
        if (veh) {
          ['insuranceExpiryDate', 'fitnessExpiryDate', 'permitExpiryDate'].forEach(f => {
            const exp = getExpiryStatus(veh[f]);
            if (exp && exp.level === 'red') {
              warnings.push(`Warning: Vehicle ${veh.registrationNumber} has an EXPIRED ${f.replace('ExpiryDate', '')}!`);
            } else if (exp && exp.level === 'amber') {
              warnings.push(`Alert: Vehicle ${veh.registrationNumber} ${f.replace('ExpiryDate', '')} is expiring in ${exp.days} days.`);
            }
          });
        }
      }

      if (booking.driverName) {
        const drv = (vendor.drivers || []).find(d => (d.driverName || '').toLowerCase() === booking.driverName.toLowerCase());
        if (drv && drv.licenseExpiryDate) {
          const exp = getExpiryStatus(drv.licenseExpiryDate);
          if (exp && exp.level === 'red') {
            warnings.push(`Warning: Driver ${drv.driverName} has an EXPIRED Driving License!`);
          } else if (exp && exp.level === 'amber') {
            warnings.push(`Alert: Driver ${drv.driverName}'s Driving License expires in ${exp.days} days.`);
          }
        }
      }
    }
  }

  return warnings;
}

/**
 * @route   GET /api/aggregator/bookings
 * @desc    Get all corporate bookings with filters (Status, Date range, Client, Location, Search)
 * @access  Protected
 */
router.get('/bookings', protect, async (req, res) => {
  try {
    const { status, fromDate, toDate, clientId, location, search } = req.query;

    if (!isDb()) {
      let list = [...mockBookings];

      if (status && status !== 'ALL') {
        const statuses = status.split(',').map(s => s.trim().toUpperCase());
        list = list.filter(b => statuses.includes((b.status || '').toUpperCase()));
      }

      if (fromDate) {
        const from = new Date(fromDate);
        list = list.filter(b => b.travelDate && new Date(b.travelDate) >= from);
      }
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        list = list.filter(b => b.travelDate && new Date(b.travelDate) <= to);
      }

      if (clientId && clientId !== 'ALL') {
        list = list.filter(b => String(b.clientId) === String(clientId) || b.clientName === clientId);
      }

      if (location && location !== 'ALL') {
        list = list.filter(b => (b.location || '').toLowerCase() === location.toLowerCase());
      }

      if (search) {
        const s = search.toLowerCase();
        list = list.filter(b =>
          (b.bookingNo || '').toLowerCase().includes(s) ||
          (b.dutySlipNo || '').toLowerCase().includes(s) ||
          (b.clientName || '').toLowerCase().includes(s) ||
          (b.guestName || '').toLowerCase().includes(s) ||
          (b.vehicleNumber || '').toLowerCase().includes(s) ||
          (b.driverName || '').toLowerCase().includes(s) ||
          (b.vehicleType || '').toLowerCase().includes(s) ||
          (b.packageType || '').toLowerCase().includes(s)
        );
      }

      // Sort newest travel date first
      list.sort((a, b) => new Date(b.travelDate || 0) - new Date(a.travelDate || 0));
      return res.json({ success: true, count: list.length, data: list });
    }

    const conditions = [];

    if (status && status !== 'ALL') {
      const statuses = status.split(',').map(s => s.trim().toUpperCase());
      conditions.push({ status: { $in: statuses } });
    }

    if (fromDate || toDate) {
      const dateFilter = {};
      if (fromDate) dateFilter.$gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        dateFilter.$lte = to;
      }
      conditions.push({ travelDate: dateFilter });
    }

    if (clientId && clientId !== 'ALL') {
      conditions.push({ $or: [{ clientId }, { clientName: clientId }] });
    }

    if (location && location !== 'ALL') {
      conditions.push({ location: { $regex: location, $options: 'i' } });
    }

    if (search) {
      conditions.push({
        $or: [
          { bookingNo: { $regex: search, $options: 'i' } },
          { dutySlipNo: { $regex: search, $options: 'i' } },
          { clientName: { $regex: search, $options: 'i' } },
          { guestName: { $regex: search, $options: 'i' } },
          { vehicleNumber: { $regex: search, $options: 'i' } },
          { driverName: { $regex: search, $options: 'i' } },
          { vehicleType: { $regex: search, $options: 'i' } },
          { packageType: { $regex: search, $options: 'i' } }
        ]
      });
    }

    const query = conditions.length > 0 ? { $and: conditions } : {};
    const bookings = await AggregatorBooking.find(query).sort({ travelDate: -1, createdAt: -1 });
    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @route   GET /api/aggregator/bookings/:id
 * @desc    Get single corporate booking detail
 * @access  Protected
 */
router.get('/bookings/:id', protect, async (req, res) => {
  try {
    if (!isDb()) {
      const b = mockBookings.find(x => String(x._id) === String(req.params.id) || x.bookingNo === String(req.params.id) || x.dutySlipNo === String(req.params.id));
      if (!b) return res.status(404).json({ success: false, message: 'Booking not found' });
      return res.json({ success: true, data: b });
    }

    const booking = await findBookingDoc(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, data: booking });
  } catch (err) {
    console.error('Error fetching booking:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @route   POST /api/aggregator/bookings
 * @desc    Create new booking (supports partial WhatsApp/phone details, auto status)
 * @access  Protected
 */
router.post('/bookings', protect, async (req, res) => {
  try {
    const payload = req.body;
    delete payload._id;

    // Sequence allocation
    let dutySlipNo = payload.dutySlipNo || payload.bookingNo;
    if (!dutySlipNo || String(dutySlipNo).trim() === '') {
      dutySlipNo = await getNextDutySlipSequence();
    }
    const bookingNo = dutySlipNo;

    // Auto status computation if not manually set
    let computedStatus = payload.status;
    let isManualStatus = Boolean(payload.isManualStatus);

    if (!isManualStatus || !computedStatus) {
      computedStatus = computeBookingStatus({ ...payload, dutySlipNo, bookingNo });
      isManualStatus = false;
    }

    const username = req.admin ? (req.admin.username || 'admin') : 'admin';

    const bookingData = {
      ...payload,
      bookingNo,
      dutySlipNo,
      status: computedStatus,
      isManualStatus,
      createdBy: username,
      updatedBy: username,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    delete bookingData._id;

    // Check non-blocking warnings
    const warnings = await checkBookingWarnings(bookingData);

    if (!isDb()) {
      const newB = { ...bookingData, _id: 'mock_bk_' + bookingNo };
      mockBookings.unshift(newB);

      await logAudit({
        req,
        action: 'CREATE_BOOKING',
        entityType: 'BOOKING',
        entityId: newB._id,
        entityName: `Booking #${bookingNo} (${newB.clientName || 'Partial'})`,
        details: { status: newB.status, guest: newB.guestName, vehicle: newB.vehicleNumber, warnings }
      });

      return res.status(201).json({
        success: true,
        message: `Booking #${bookingNo} created successfully with status ${newB.status}`,
        data: newB,
        warnings
      });
    }

    const newBooking = new AggregatorBooking(bookingData);
    await newBooking.save();

    await logAudit({
      req,
      action: 'CREATE_BOOKING',
      entityType: 'BOOKING',
      entityId: newBooking._id,
      entityName: `Booking #${bookingNo} (${newBooking.clientName || 'Partial'})`,
      details: { status: newBooking.status, guest: newBooking.guestName, vehicle: newBooking.vehicleNumber, warnings }
    });

    res.status(201).json({
      success: true,
      message: `Booking #${bookingNo} created successfully with status ${newBooking.status}`,
      data: newBooking,
      warnings
    });
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @route   PUT /api/aggregator/bookings/:id
 * @desc    Update booking details or plotting
 * @access  Protected
 */
router.put('/bookings/:id', protect, async (req, res) => {
  try {
    const payload = req.body;
    delete payload._id;
    const username = req.admin ? (req.admin.username || 'admin') : 'admin';

    if (!isDb()) {
      const rawId = String(req.params.id).replace('mock_bk_', '');
      const b = mockBookings.find(x => 
        String(x._id) === String(req.params.id) || 
        String(x.bookingNo) === String(req.params.id) ||
        String(x.dutySlipNo) === String(req.params.id) ||
        String(x.bookingNo) === rawId ||
        String(x._id).replace('mock_bk_', '') === rawId
      );
      if (!b) return res.status(404).json({ success: false, message: 'Booking not found' });

      // Apply changes
      Object.assign(b, payload);
      b.updatedBy = username;
      b.updatedAt = new Date();

      // Check if status should be auto-recomputed
      if (payload.resetToAuto === true || !b.isManualStatus) {
        b.status = computeBookingStatus(b);
        b.isManualStatus = false;
      }

      const warnings = await checkBookingWarnings(b, b._id);

      await logAudit({
        req,
        action: 'UPDATE_BOOKING',
        entityType: 'BOOKING',
        entityId: b._id,
        entityName: `Booking #${b.bookingNo} (${b.clientName})`,
        details: { status: b.status, vehicle: b.vehicleNumber, driver: b.driverName, warnings }
      });

      return res.json({
        success: true,
        message: `Booking #${b.bookingNo} updated successfully (Status: ${b.status})`,
        data: b,
        warnings
      });
    }

    const booking = await findBookingDoc(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    Object.assign(booking, payload);
    booking.updatedBy = username;

    if (payload.resetToAuto === true || !booking.isManualStatus) {
      booking.status = computeBookingStatus(booking);
      booking.isManualStatus = false;
    }

    await booking.save();
    const warnings = await checkBookingWarnings(booking, booking._id);

    await logAudit({
      req,
      action: 'UPDATE_BOOKING',
      entityType: 'BOOKING',
      entityId: booking._id,
      entityName: `Booking #${booking.bookingNo} (${booking.clientName})`,
      details: { status: booking.status, vehicle: booking.vehicleNumber, driver: booking.driverName, warnings }
    });

    res.json({
      success: true,
      message: `Booking #${booking.bookingNo} updated successfully (Status: ${booking.status})`,
      data: booking,
      warnings
    });
  } catch (err) {
    console.error('Error updating booking:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @route   POST /api/aggregator/bookings/:id/cancel
 * @desc    Cancel booking (requires non-empty cancellation reason)
 * @access  Protected
 */
router.post('/bookings/:id/cancel', protect, async (req, res) => {
  try {
    const { cancelReason } = req.body;
    if (!cancelReason || cancelReason.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Cancellation reason is required' });
    }

    const username = req.admin ? (req.admin.username || 'admin') : 'admin';

    if (!isDb()) {
      const b = mockBookings.find(x => String(x._id) === String(req.params.id) || x.bookingNo === req.params.id);
      if (!b) return res.status(404).json({ success: false, message: 'Booking not found' });

      b.status = 'STATUS_CANCEL';
      b.isManualStatus = true;
      b.cancelReason = cancelReason.trim();
      b.updatedBy = username;
      b.updatedAt = new Date();

      await logAudit({
        req,
        action: 'CANCEL_BOOKING',
        entityType: 'BOOKING',
        entityId: b._id,
        entityName: `Booking #${b.bookingNo}`,
        details: { reason: b.cancelReason }
      });

      return res.json({ success: true, message: `Booking #${b.bookingNo} cancelled`, data: b });
    }

    const booking = await findBookingDoc(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.status = 'STATUS_CANCEL';
    booking.isManualStatus = true;
    booking.cancelReason = cancelReason.trim();
    booking.updatedBy = username;
    await booking.save();

    await logAudit({
      req,
      action: 'CANCEL_BOOKING',
      entityType: 'BOOKING',
      entityId: booking._id,
      entityName: `Booking #${booking.bookingNo}`,
      details: { reason: booking.cancelReason }
    });

    res.json({ success: true, message: `Booking #${booking.bookingNo} cancelled`, data: booking });
  } catch (err) {
    console.error('Error cancelling booking:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @route   POST /api/aggregator/bookings/:id/copy
 * @desc    Copy / Clone booking for repeat rides
 * @access  Protected
 */
router.post('/bookings/:id/copy', protect, async (req, res) => {
  try {
    const username = req.admin ? (req.admin.username || 'admin') : 'admin';
    const nextSeq = await getNextDutySlipSequence();

    let source = null;
    if (!isDb()) {
      source = mockBookings.find(x => String(x._id) === String(req.params.id) || x.bookingNo === String(req.params.id) || x.dutySlipNo === String(req.params.id));
    } else {
      source = await findBookingDoc(req.params.id);
    }

    if (!source) return res.status(404).json({ success: false, message: 'Source booking not found' });

    const raw = typeof source.toObject === 'function' ? source.toObject() : { ...source };
    delete raw._id;
    delete raw.__v;

    // Reset status and progress on cloned ride
    raw.bookingNo = nextSeq;
    raw.dutySlipNo = nextSeq;
    raw.status = 'STATUS_NO';
    raw.isManualStatus = false;
    raw.cancelReason = '';
    raw.driverAccepted = false;
    raw.dutyStarted = false;
    raw.dutyClosed = false;
    raw.dutyCloseReadings = { totalKms: 0, totalHours: 0 };
    raw.dutySlipUploaded = false;
    raw.dutySlipFile = '';
    raw.dutySlipFileName = '';
    raw.isInvoiced = false;
    raw.invoiceDetails = {};
    raw.createdBy = username;
    raw.updatedBy = username;
    raw.createdAt = new Date();
    raw.updatedAt = new Date();

    // Recompute status for new copy
    raw.status = computeBookingStatus(raw);
    delete raw._id;

    if (!isDb()) {
      const cloned = { ...raw, _id: 'mock_bk_' + nextSeq };
      mockBookings.unshift(cloned);

      await logAudit({
        req,
        action: 'COPY_BOOKING',
        entityType: 'BOOKING',
        entityId: cloned._id,
        entityName: `Cloned #${nextSeq} from #${source.bookingNo}`,
        details: { originalBookingNo: source.bookingNo, newBookingNo: nextSeq }
      });

      return res.status(201).json({ success: true, message: `Booking copied as #${nextSeq}`, data: cloned });
    }

    const clonedBooking = new AggregatorBooking(raw);
    await clonedBooking.save();

    await logAudit({
      req,
      action: 'COPY_BOOKING',
      entityType: 'BOOKING',
      entityId: clonedBooking._id,
      entityName: `Cloned #${nextSeq} from #${source.bookingNo}`,
      details: { originalBookingNo: source.bookingNo, newBookingNo: nextSeq }
    });

    res.status(201).json({ success: true, message: `Booking copied as #${nextSeq}`, data: clonedBooking });
  } catch (err) {
    console.error('Error copying booking:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @route   POST /api/aggregator/bookings/:id/upload-duty-slip
 * @desc    Upload driver's returned paper duty slip (.jpg, .jpeg, .png, .pdf)
 * @access  Protected
 */
router.post('/bookings/:id/upload-duty-slip', protect, upload.single('dutySlip'), async (req, res) => {
  try {
    let fileData = '';
    let fileName = '';

    if (req.file) {
      const mime = req.file.mimetype;
      const base64 = req.file.buffer.toString('base64');
      fileData = `data:${mime};base64,${base64}`;
      fileName = req.file.originalname;
    } else if (req.body.fileData) {
      fileData = req.body.fileData;
      fileName = req.body.fileName || 'scanned_duty_slip.png';
    } else {
      return res.status(400).json({ success: false, message: 'Please select a duty slip image or PDF' });
    }

    const username = req.admin ? (req.admin.username || 'admin') : 'admin';

    if (!isDb()) {
      const b = mockBookings.find(x => String(x._id) === String(req.params.id) || x.bookingNo === req.params.id);
      if (!b) return res.status(404).json({ success: false, message: 'Booking not found' });

      b.dutySlipUploaded = true;
      b.dutySlipFile = fileData;
      b.dutySlipFileName = fileName;
      b.updatedBy = username;
      b.updatedAt = new Date();

      await logAudit({
        req,
        action: 'UPLOAD_DUTY_SLIP',
        entityType: 'BOOKING',
        entityId: b._id,
        entityName: `Duty Slip #${b.dutySlipNo}`,
        details: { fileName }
      });

      return res.json({ success: true, message: 'Duty slip uploaded successfully', data: b });
    }

    const booking = await findBookingDoc(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.dutySlipUploaded = true;
    booking.dutySlipFile = fileData;
    booking.dutySlipFileName = fileName;
    booking.updatedBy = username;
    await booking.save();

    await logAudit({
      req,
      action: 'UPLOAD_DUTY_SLIP',
      entityType: 'BOOKING',
      entityId: booking._id,
      entityName: `Duty Slip #${booking.dutySlipNo}`,
      details: { fileName }
    });

    res.json({ success: true, message: 'Duty slip uploaded successfully', data: booking });
  } catch (err) {
    console.error('Error uploading duty slip:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @route   POST /api/aggregator/bookings/:id/close-duty
 * @desc    Enter returned duty figures, close duty, and AUTO-GENERATE TAX INVOICE WITH EXACT SAME NUMBER
 * @access  Protected
 */
router.post('/bookings/:id/close-duty', protect, async (req, res) => {
  try {
    const {
      garageOutKm,
      garageOutTime,
      reportingKm,
      reportingTime,
      releasingKm,
      releasingTime,
      garageInKm,
      garageInTime,
      totalKms,
      totalHours,
      totalDays,
      totalNights,
      driverAllowance,
      lateNightCharges,
      permitCharges,
      fuelSurcharge,
      tollCharges,
      parkingCharges,
      guestSignatureConfirmed
    } = req.body;

    const username = req.admin ? (req.admin.username || 'admin') : 'admin';

    // Retrieve booking, company, brokerProfile
    let booking = null;
    let company = null;
    let brokerProfile = null;

    if (!isDb()) {
      booking = mockBookings.find(x => String(x._id) === String(req.params.id) || x.bookingNo === String(req.params.id) || x.dutySlipNo === String(req.params.id));
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      company = mockCompanies.find(c => String(c._id) === String(booking.clientId) || c.companyName === booking.clientName) || mockCompanies[0];
      brokerProfile = mockBrokerProfile;
    } else {
      booking = await findBookingDoc(req.params.id);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      company = await findCompanyDoc(booking.clientId, booking.clientName);
      brokerProfile = await BrokerProfile.findOne();
    }

    if (!company) company = {};
    if (!brokerProfile) brokerProfile = {};

    // 1. Save duty close readings
    const readings = {
      garageOutKm: Number(garageOutKm || 0),
      garageOutTime: garageOutTime || '',
      reportingKm: Number(reportingKm || 0),
      reportingTime: reportingTime || '',
      releasingKm: Number(releasingKm || 0),
      releasingTime: releasingTime || '',
      garageInKm: Number(garageInKm || 0),
      garageInTime: garageInTime || '',
      totalKms: Number(totalKms || 0),
      totalHours: Number(totalHours || 0),
      totalDays: Number(totalDays || 1),
      totalNights: Number(totalNights || 0),
      driverAllowance: Number(driverAllowance || 0),
      lateNightCharges: Number(lateNightCharges || 0),
      permitCharges: Number(permitCharges || 0),
      fuelSurcharge: Number(fuelSurcharge || 0),
      tollCharges: Number(tollCharges || 0),
      parkingCharges: Number(parkingCharges || 0),
      guestSignatureConfirmed: Boolean(guestSignatureConfirmed)
    };

    booking.dutyCloseReadings = readings;
    booking.dutyClosed = true;
    booking.status = 'DR_DUTY_CLOSE';
    booking.updatedBy = username;

    // 2. AUTO-GENERATE TAX INVOICE WITH EXACT SAME DUTY SLIP / BOOKING NUMBER
    // e.g. Duty Slip 73425 -> Invoice No 73425
    const invoiceData = calculateInvoiceForBooking(booking, company, brokerProfile);
    booking.isInvoiced = true;
    booking.invoiceDetails = invoiceData;

    if (!isDb()) {
      booking.updatedAt = new Date();

      await logAudit({
        req,
        action: 'CLOSE_DUTY',
        entityType: 'BOOKING',
        entityId: booking._id,
        entityName: `Duty Slip #${booking.dutySlipNo}`,
        details: { totalKms: readings.totalKms, totalHours: readings.totalHours, invoiceNo: invoiceData.invoiceNo, grandTotal: invoiceData.grandTotal }
      });

      await logAudit({
        req,
        action: 'GENERATE_INVOICE',
        entityType: 'INVOICE',
        entityId: invoiceData.invoiceNo,
        entityName: `Invoice #${invoiceData.invoiceNo} for ${company.companyName || booking.clientName}`,
        details: { grandTotal: invoiceData.grandTotal, taxableAmount: invoiceData.taxableAmount }
      });

      return res.json({
        success: true,
        message: `Duty #${booking.dutySlipNo} closed and Invoice #${invoiceData.invoiceNo} generated successfully!`,
        data: booking,
        invoice: invoiceData
      });
    }

    await booking.save();

    await logAudit({
      req,
      action: 'CLOSE_DUTY',
      entityType: 'BOOKING',
      entityId: booking._id,
      entityName: `Duty Slip #${booking.dutySlipNo}`,
      details: { totalKms: readings.totalKms, totalHours: readings.totalHours, invoiceNo: invoiceData.invoiceNo, grandTotal: invoiceData.grandTotal }
    });

    await logAudit({
      req,
      action: 'GENERATE_INVOICE',
      entityType: 'INVOICE',
      entityId: invoiceData.invoiceNo,
      entityName: `Invoice #${invoiceData.invoiceNo} for ${company.companyName || booking.clientName}`,
      details: { grandTotal: invoiceData.grandTotal, taxableAmount: invoiceData.taxableAmount }
    });

    res.json({
      success: true,
      message: `Duty #${booking.dutySlipNo} closed and Invoice #${invoiceData.invoiceNo} generated successfully!`,
      data: booking,
      invoice: invoiceData
    });
  } catch (err) {
    console.error('Error closing duty and generating invoice:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @route   GET /api/aggregator/bookings/:id/invoice
 * @desc    Get full invoice printable bundle for a booking
 * @access  Protected
 */
router.get('/bookings/:id/invoice', protect, async (req, res) => {
  try {
    let booking = null;
    let company = null;
    let brokerProfile = null;

    if (!isDb()) {
      booking = mockBookings.find(x => String(x._id) === String(req.params.id) || x.bookingNo === String(req.params.id) || x.dutySlipNo === String(req.params.id));
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      company = mockCompanies.find(c => String(c._id) === String(booking.clientId) || c.companyName === booking.clientName) || mockCompanies[0];
      brokerProfile = mockBrokerProfile;
    } else {
      booking = await findBookingDoc(req.params.id);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      company = await findCompanyDoc(booking.clientId, booking.clientName);
      brokerProfile = await BrokerProfile.findOne();
    }

    if (!company) company = {};
    if (!brokerProfile) brokerProfile = {};

    let invoice = booking.invoiceDetails;
    if (!invoice || !invoice.invoiceNo || !booking.isInvoiced) {
      invoice = calculateInvoiceForBooking(booking, company, brokerProfile);
    }

    res.json({
      success: true,
      data: {
        invoice,
        booking,
        company,
        brokerProfile
      }
    });
  } catch (err) {
    console.error('Error fetching invoice bundle:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @route   POST /api/aggregator/bookings/:id/email-invoice
 * @desc    Dispatch or simulate invoice email to corporate client
 * @access  Protected
 */
router.post('/bookings/:id/email-invoice', protect, async (req, res) => {
  try {
    const { email } = req.body;
    let booking = null;

    if (!isDb()) {
      booking = mockBookings.find(x => String(x._id) === String(req.params.id) || x.bookingNo === String(req.params.id) || x.dutySlipNo === String(req.params.id));
    } else {
      booking = await findBookingDoc(req.params.id);
    }

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const targetEmail = email || booking.contactPersonEmail || 'billing@client.com';

    await logAudit({
      req,
      action: 'EMAIL_INVOICE',
      entityType: 'INVOICE',
      entityId: booking.dutySlipNo,
      entityName: `Invoice #${booking.dutySlipNo} sent to ${targetEmail}`,
      details: { recipient: targetEmail, bookingNo: booking.bookingNo }
    });

    res.json({
      success: true,
      message: `Invoice #${booking.dutySlipNo} & Duty Slip successfully emailed to ${targetEmail}`
    });
  } catch (err) {
    console.error('Error emailing invoice:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// 6. AUDIT LOGS
// =========================================================================

router.get('/audit-logs', protect, async (req, res) => {
  try {
    const { entityType, limit = 100 } = req.query;
    let filter = {};
    if (entityType) filter.entityType = entityType.toUpperCase();

    const logs = await getAuditLogs(filter, Number(limit));
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

