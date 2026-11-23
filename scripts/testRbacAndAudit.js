const axios = require('axios');

const TEST_PORT = process.env.TEST_PORT || 5004;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

async function runRbacTests() {
  console.log('--- Starting RBAC, Dispatcher & Scoped Audit Log Tests ---\n');

  try {
    // 1. Admin Login
    console.log('[TEST 1] Admin Login Verification...');
    const adminLoginRes = await axios.post(`${BASE_URL}/admin/login`, {
      username: 'admin',
      password: 'wings@admin123'
    });
    const adminToken = adminLoginRes.data.token;
    const adminHeaders = { headers: { Authorization: `Bearer ${adminToken}` } };
    console.log(`✅ Admin logged in. Role: ${adminLoginRes.data.admin.role}`);
    if (adminLoginRes.data.admin.role !== 'ADMIN') throw new Error('Expected role ADMIN');

    // 2. Dispatcher Login
    console.log('\n[TEST 2] Dispatcher Login Verification...');
    const dispLoginRes = await axios.post(`${BASE_URL}/admin/login`, {
      username: 'dispatcher1',
      password: 'wings@admin123'
    });
    const dispToken = dispLoginRes.data.token;
    const dispHeaders = { headers: { Authorization: `Bearer ${dispToken}` } };
    console.log(`✅ Dispatcher logged in. Role: ${dispLoginRes.data.admin.role}`);
    if (dispLoginRes.data.admin.role !== 'DISPATCHER') throw new Error('Expected role DISPATCHER');

    // 3. Dispatcher Forbidden on Master Data Endpoints
    console.log('\n[TEST 3] Dispatcher Access Restrictions (Master Data Protection)...');

    // 3a. GET /aggregator/users
    try {
      await axios.get(`${BASE_URL}/aggregator/users`, dispHeaders);
      throw new Error('Dispatcher was NOT blocked from GET /users');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('✅ Dispatcher blocked from GET /aggregator/users (403 Forbidden)');
      } else throw err;
    }

    // 3b. POST /aggregator/companies
    try {
      await axios.post(`${BASE_URL}/aggregator/companies`, { companyName: 'Illegal Corp' }, dispHeaders);
      throw new Error('Dispatcher was NOT blocked from POST /companies');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('✅ Dispatcher blocked from POST /aggregator/companies (403 Forbidden)');
      } else throw err;
    }

    // 3c. POST /aggregator/vendors
    try {
      await axios.post(`${BASE_URL}/aggregator/vendors`, { vendorName: 'Illegal Vendor' }, dispHeaders);
      throw new Error('Dispatcher was NOT blocked from POST /vendors');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('✅ Dispatcher blocked from POST /aggregator/vendors (403 Forbidden)');
      } else throw err;
    }

    // 3d. PUT /aggregator/profile
    try {
      await axios.put(`${BASE_URL}/aggregator/profile`, { companyLegalName: 'Hacked Name' }, dispHeaders);
      throw new Error('Dispatcher was NOT blocked from PUT /profile');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('✅ Dispatcher blocked from PUT /aggregator/profile (403 Forbidden)');
      } else throw err;
    }

    // 4. Dispatcher Allowed Operations: Creating & Updating Bookings
    console.log('\n[TEST 4] Dispatcher Allowed Operations (Booking & Dispatch)...');
    const createBkRes = await axios.post(`${BASE_URL}/aggregator/bookings`, {
      travelDate: new Date().toISOString(),
      guestName: 'Corporate VIP Passenger',
      guestPhone: '+91 99887 76655',
      location: 'Pune',
      destination: 'Mumbai Airport'
    }, dispHeaders);
    const newBk = createBkRes.data.data;
    console.log(`✅ Dispatcher successfully created Booking #${newBk.bookingNo} (Status: ${newBk.status})`);

    // 5. Scoped Audit Logs: Dispatcher vs. Admin Visibility
    console.log('\n[TEST 5] Scoped Audit Logs Verification (Dispatcher vs Admin)...');
    
    // 5a. Dispatcher view: MUST ONLY contain actions by dispatcher1
    const dispAuditRes = await axios.get(`${BASE_URL}/aggregator/audit-logs`, dispHeaders);
    const dispLogs = dispAuditRes.data.data;
    console.log(`✅ Dispatcher audit logs count: ${dispLogs.length}`);
    const hasAdminLogs = dispLogs.some(l => (l.actor_name === 'admin' || l.username === 'admin') && l.actor_role === 'ADMIN');
    if (hasAdminLogs) {
      throw new Error('SECURITY VIOLATION: Dispatcher can see Admin audit logs!');
    }
    const allDispLogsMatch = dispLogs.every(l => 
      (l.actor_name === 'dispatcher1' || l.username === 'dispatcher1') ||
      (l.userId === 'mock_u2' || l.actor_id === 'mock_u2')
    );
    if (!allDispLogsMatch) {
      throw new Error('SECURITY VIOLATION: Dispatcher saw logs not belonging to them!');
    }
    console.log('✅ Scoped audit logs confirmed: Dispatcher sees ONLY their own activity logs');

    // 5b. Admin view: MUST contain all logs (Admin + Dispatcher)
    const adminAuditRes = await axios.get(`${BASE_URL}/aggregator/audit-logs`, adminHeaders);
    const adminLogs = adminAuditRes.data.data;
    console.log(`✅ Admin audit logs count: ${adminLogs.length}`);
    const adminHasDispLogs = adminLogs.some(l => l.actor_name === 'dispatcher1' || l.username === 'dispatcher1');
    const adminHasAdminLogs = adminLogs.some(l => l.actor_name === 'admin' || l.username === 'admin');
    if (!adminHasDispLogs || !adminHasAdminLogs) {
      throw new Error('Admin view is missing logs from either admin or dispatcher');
    }
    console.log('✅ Admin audit view confirmed: Admin sees all logs created across all users');

    // 5c. Admin filtering by User
    const filteredByUser = await axios.get(`${BASE_URL}/aggregator/audit-logs?user=dispatcher1`, adminHeaders);
    const onlyDispLogs = filteredByUser.data.data.every(l => l.username === 'dispatcher1' || l.actor_name === 'dispatcher1');
    if (!onlyDispLogs) throw new Error('Filter by user failed: returned other users logs');
    console.log(`✅ Admin filter by user=dispatcher1 passed (${filteredByUser.data.data.length} logs)`);

    // 5d. Admin filtering by Role
    const filteredByRole = await axios.get(`${BASE_URL}/aggregator/audit-logs?role=DISPATCHER`, adminHeaders);
    const onlyDispRole = filteredByRole.data.data.every(l => (l.userRole || l.actor_role).toUpperCase() === 'DISPATCHER');
    if (!onlyDispRole) throw new Error('Filter by role failed: returned non-dispatcher logs');
    console.log(`✅ Admin filter by role=DISPATCHER passed (${filteredByRole.data.data.length} logs)`);

    // 6. User Management: Creation, Update, Password Reset & Deactivation
    console.log('\n[TEST 6] Admin User Management Lifecycle & Immediate Deactivation Guard...');
    
    // Create new test dispatcher
    const newUsername = 'test_disp_' + Date.now();
    const newUserRes = await axios.post(`${BASE_URL}/aggregator/users`, {
      fullName: 'Test Dispatcher Staff',
      username: newUsername,
      email: `${newUsername}@wings.com`,
      phoneNumber: '+91 91234 56789',
      password: 'password123',
      role: 'DISPATCHER',
      status: true
    }, adminHeaders);
    const testUser = newUserRes.data.data;
    console.log(`✅ Admin created new Dispatcher: ${testUser.fullName} (@${testUser.username})`);

    // Test new user login
    const testLoginRes = await axios.post(`${BASE_URL}/admin/login`, {
      username: newUsername,
      password: 'password123'
    });
    const testToken = testLoginRes.data.token;
    console.log('✅ New Dispatcher login successful');

    // Deactivate user
    await axios.patch(`${BASE_URL}/aggregator/users/${testUser._id}/status`, { status: false }, adminHeaders);
    console.log('✅ Admin deactivated Dispatcher account');

    // Verify deactivated user cannot log in
    try {
      await axios.post(`${BASE_URL}/admin/login`, {
        username: newUsername,
        password: 'password123'
      });
      throw new Error('Deactivated user was able to log in!');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('✅ Deactivated user blocked from logging in (403 Account deactivated)');
      } else throw err;
    }

    // Verify existing token of deactivated user is blocked
    try {
      await axios.post(`${BASE_URL}/aggregator/bookings`, {
        guestName: 'Unauthorized Passenger'
      }, { headers: { Authorization: `Bearer ${testToken}` } });
      throw new Error('Deactivated user token was NOT blocked!');
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.log('✅ Existing token of deactivated user immediately blocked on API request');
      } else throw err;
    }

    // Reactivate user
    await axios.patch(`${BASE_URL}/aggregator/users/${testUser._id}/status`, { status: true }, adminHeaders);
    console.log('✅ Admin reactivated Dispatcher account');

    // Verify reactivated user can now log in
    const reactivatedLogin = await axios.post(`${BASE_URL}/admin/login`, {
      username: newUsername,
      password: 'password123'
    });
    if (!reactivatedLogin.data.success) throw new Error('Reactivated user login failed');
    console.log('✅ Reactivated user successfully logged in');

    console.log('\n🎉 ALL RBAC, DISPATCHER & SCOPED AUDIT LOG TESTS PASSED 100%!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err.response ? err.response.data : err.message);
    process.exit(1);
  }
}

runRbacTests();
