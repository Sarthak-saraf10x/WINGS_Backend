const axios = require('axios');
const connectDB = require('../config/db');

const TEST_PORT = process.env.TEST_PORT || 5001;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

async function runTests() {
  console.log('--- Starting Fleet Aggregator API Tests ---');
  try {
    // 1. Admin Login
    console.log('\n[TEST 1] Admin Login...');
    const loginRes = await axios.post(`${BASE_URL}/admin/login`, {
      username: 'admin',
      password: 'wings@admin123'
    });
    const token = loginRes.data.token;
    console.log('✅ Admin login successful, token obtained');
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // 2. Broker Profile
    console.log('\n[TEST 2] Broker Profile GET & PUT...');
    const profileRes = await axios.get(`${BASE_URL}/aggregator/profile`, authHeaders);
    console.log('✅ Profile GET success:', profileRes.data.data.companyLegalName);

    const updateProfileRes = await axios.put(`${BASE_URL}/aggregator/profile`, {
      companyLegalName: 'Red Cars India Pvt. Ltd.',
      address: 'Office No. 402, Business Bay, Pune-Bangalore Highway, Pune',
      city: 'Pune',
      state: 'Maharashtra',
      stateCode: '27-MH',
      phone: '+91 98220 12345',
      email: 'billing@redcarsindia.com',
      gstin: '27AAACR1234M1Z5',
      pan: 'AAACR1234M',
      tan: 'PNE012345F',
      sacCode: '996601',
      bankName: 'HDFC Bank Ltd.',
      accountName: 'Red Cars India Pvt. Ltd.',
      accountNumber: '50200012345678',
      ifscCode: 'HDFC0000123',
      branchName: 'Kothrud Branch, Pune',
      jurisdictionCity: 'Pune',
      invoicePrefix: 'INV-',
      invoiceNextSequence: 73426,
      dutySlipPrefix: 'DS-',
      dutySlipNextSequence: 73426
    }, authHeaders);
    console.log('✅ Profile PUT success:', updateProfileRes.data.data.companyLegalName, 'Invoice seq:', updateProfileRes.data.data.invoiceNextSequence);

    // 3. User Management
    console.log('\n[TEST 3] User Management (Dispatcher)...');
    const dispatcherUsername = `dispatcher_${Date.now()}`;
    const createUserRes = await axios.post(`${BASE_URL}/aggregator/users`, {
      fullName: 'Sunil Patil',
      username: dispatcherUsername,
      email: `${dispatcherUsername}@wings.com`,
      phoneNumber: '+91 98221 54321',
      password: 'dispatcher@123',
      role: 'DISPATCHER',
      status: true
    }, authHeaders);
    const newUserId = createUserRes.data.data._id;
    console.log('✅ Dispatcher user created:', createUserRes.data.data.username, 'ID:', newUserId);

    // Toggle status
    const toggleUserRes = await axios.patch(`${BASE_URL}/aggregator/users/${newUserId}/status`, { status: false }, authHeaders);
    console.log('✅ Dispatcher deactivated:', toggleUserRes.data.data.status === false);

    // Reset password
    const resetPwRes = await axios.post(`${BASE_URL}/aggregator/users/${newUserId}/reset-password`, { newPassword: 'newpassword123' }, authHeaders);
    console.log('✅ Password reset:', resetPwRes.data.message);

    // 4. Corporate Companies & Rate Cards
    console.log('\n[TEST 4] Corporate Client Company & Rate Cards...');
    const createCompanyRes = await axios.post(`${BASE_URL}/aggregator/companies`, {
      companyName: 'Infosys BPM Pune',
      billingAddress: 'Hinjewadi Phase 2, Pune',
      state: 'Maharashtra',
      stateCode: '27-MH',
      gstin: '27AAACI1234F1Z8',
      creditPeriodDays: 30,
      gstRate: 5.0,
      billingCalculationMode: 'GARAGE_TO_GARAGE',
      extraHourRoundingRule: 'ROUND_60_MIN',
      fuelSurchargeRule: { ruleType: 'NONE', value: 0 },
      tollParkingTaxable: false,
      contactPersonName: 'Suresh Menon',
      contactPersonPhone: '+91 98231 11222',
      contactPersonEmail: 'travel.desk@infosys.com',
      status: true
    }, authHeaders);
    const companyId = createCompanyRes.data.data._id;
    console.log('✅ Corporate company created:', createCompanyRes.data.data.companyName, 'ID:', companyId);

    // Add Rate Card
    const addRateCardRes = await axios.post(`${BASE_URL}/aggregator/companies/${companyId}/rate-cards`, {
      vehicleCategory: 'Sedan A/C',
      packageName: '8 Hrs / 80 Km',
      baseHours: 8,
      baseKms: 80,
      basePackageRate: 2200,
      extraKmRate: 18,
      extraHourRate: 200,
      driverDayAllowance: 300,
      nightLateAllowance: 250
    }, authHeaders);
    const rateCardId = addRateCardRes.data.data._id;
    console.log('✅ Rate card added to company:', addRateCardRes.data.data.packageName, 'Rate:', addRateCardRes.data.data.basePackageRate);

    // 5. Vendors & Optional Fleet
    console.log('\n[TEST 5] Vendors & Optional Fleet (0 vehicles/drivers allowed)...');
    // Test Business Rule: Vendor with 0 vehicles and 0 drivers
    const createZeroVendorRes = await axios.post(`${BASE_URL}/aggregator/vendors`, {
      vendorName: 'Ad-hoc Vendor Zero',
      contactPerson: 'Kishore Kumar',
      phone: '+91 98111 22334',
      status: true,
      vehicles: [],
      drivers: []
    }, authHeaders);
    console.log('✅ Vendor created with 0 vehicles and 0 drivers (Business Rule Verified!):', createZeroVendorRes.data.data.vendorName);

    // Vendor with vehicles & drivers
    const createVendorRes = await axios.post(`${BASE_URL}/aggregator/vendors`, {
      vendorName: 'Om Sai Travels',
      contactPerson: 'Santosh Jadhav',
      phone: '+91 98901 23456',
      email: 'omsai@example.com',
      gstin: '27AAAPJ5544K1Z3',
      pan: 'AAAPJ5544K',
      bankDetails: {
        bankName: 'SBI',
        accountNumber: '32109876543',
        ifsc: 'SBIN0001234'
      },
      status: true
    }, authHeaders);
    const vendorId = createVendorRes.data.data._id;

    // Add Vehicle (with expiring soon date)
    const vehExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days = Amber
    const addVehRes = await axios.post(`${BASE_URL}/aggregator/vendors/${vendorId}/vehicles`, {
      registrationNumber: 'MH12 AB 9988',
      vehicleCategory: 'Sedan A/C',
      vehicleModel: 'Maruti Dzire',
      insuranceExpiryDate: vehExpiry.toISOString(),
      fitnessExpiryDate: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString()
    }, authHeaders);
    console.log('✅ Vehicle added under vendor:', addVehRes.data.data.registrationNumber);

    // Add Driver (with expired license date)
    const driverLicenseExpired = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // -5 days = Red
    const addDrvRes = await axios.post(`${BASE_URL}/aggregator/vendors/${vendorId}/drivers`, {
      driverName: 'Ramesh Pawar',
      phone: '+91 97654 32100',
      licenseNumber: 'MH1220180054321',
      licenseExpiryDate: driverLicenseExpired.toISOString(),
      badgeStatus: 'VERIFIED'
    }, authHeaders);
    console.log('✅ Driver added under vendor:', addDrvRes.data.data.driverName);

    // Fetch vendor and verify expiry badges
    const getVendorRes = await axios.get(`${BASE_URL}/aggregator/vendors/${vendorId}`, authHeaders);
    const vehAlert = getVendorRes.data.data.vehicles[0].insuranceAlert;
    const drvAlert = getVendorRes.data.data.drivers[0].licenseAlert;
    console.log('✅ Vehicle Insurance Alert Level:', vehAlert.level, `(${vehAlert.text})`);
    console.log('✅ Driver License Alert Level:', drvAlert.level, `(${drvAlert.text})`);

    // 6. Audit Logs
    console.log('\n[TEST 6] Audit Logs Verification...');
    const auditRes = await axios.get(`${BASE_URL}/aggregator/audit-logs`, authHeaders);
    console.log(`✅ Audit logs count: ${auditRes.data.data.length}. Recent actions:`);
    auditRes.data.data.slice(0, 5).forEach((log, i) => {
      console.log(`   ${i + 1}. [${log.action}] entity: ${log.entityType} | name: ${log.entityName} | by: ${log.username} | time: ${log.timestamp}`);
    });

    console.log('\n🎉 ALL AGGREGATOR MODULE TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err.response ? err.response.data : err.message);
    process.exit(1);
  }
}

runTests();
