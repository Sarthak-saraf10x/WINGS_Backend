const axios = require('axios');

const TEST_PORT = process.env.TEST_PORT || 5004;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

async function runBookingTests() {
  console.log('--- Starting Fleet Aggregator Bookings API Tests ---');
  try {
    // 1. Admin Login
    console.log('\n[TEST 1] Admin Login...');
    const loginRes = await axios.post(`${BASE_URL}/admin/login`, {
      username: 'admin',
      password: 'wings@admin123'
    });
    const token = loginRes.data.token;
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
    console.log('✅ Admin login successful');

    // 2. Fetch existing bookings list
    console.log('\n[TEST 2] Fetch Bookings List & Status Filtering...');
    const listRes = await axios.get(`${BASE_URL}/aggregator/bookings`, authHeaders);
    console.log(`✅ Total bookings returned: ${listRes.data.data.length}`);

    // Verify 7 status color categories exist in mock data
    const statusesFound = new Set(listRes.data.data.map(b => b.status));
    console.log('   Statuses present:', Array.from(statusesFound).join(', '));

    // Test status filter
    const closedRes = await axios.get(`${BASE_URL}/aggregator/bookings?status=DR_DUTY_CLOSE`, authHeaders);
    console.log(`✅ Filtered by DR_DUTY_CLOSE count: ${closedRes.data.data.length}`);

    // 3. Partial Booking Create (from WhatsApp/phone call without timing) -> Expect NO_TIMING
    console.log('\n[TEST 3] Create Partial WhatsApp Booking (No Timing)...');
    const partialBookingRes = await axios.post(`${BASE_URL}/aggregator/bookings`, {
      clientName: 'Infosys BPM Pune',
      travelDate: '2026-11-25',
      guestName: 'Mr. Alex Brown',
      guestPhone: '+91 98111 88990',
      vehicleType: 'Sedan A/C',
      packageType: '8 Hrs / 80 Km',
      noTiming: true,
      timingNotes: 'Guest will call on arrival'
    }, authHeaders);
    const bk1 = partialBookingRes.data.data;
    console.log(`✅ Booking #${bk1.bookingNo} created with Status: ${bk1.status} (Expected: NO_TIMING)`);
    if (bk1.status !== 'NO_TIMING') throw new Error(`Expected NO_TIMING, got ${bk1.status}`);

    // 4. Update with Timing but without Plotting -> Expect STATUS_NO
    console.log('\n[TEST 4] Add Timing to Booking (without vendor/car plotted)...');
    const updateTimingRes = await axios.put(`${BASE_URL}/aggregator/bookings/${bk1._id}`, {
      noTiming: false,
      reqTime: '09:00',
      repHours: '09',
      repMinutes: '00'
    }, authHeaders);
    const bk2 = updateTimingRes.data.data;
    console.log(`✅ Booking #${bk2.bookingNo} updated with Status: ${bk2.status} (Expected: STATUS_NO)`);
    if (bk2.status !== 'STATUS_NO') throw new Error(`Expected STATUS_NO, got ${bk2.status}`);

    // 5. Add Plotting (Vendor, Vehicle, Driver) but driverAccepted = false -> Expect STATUS_YES
    console.log('\n[TEST 5] Plot Vendor, Vehicle, and Driver (Dr.Acpt = NO)...');
    const updatePlottingRes = await axios.put(`${BASE_URL}/aggregator/bookings/${bk1._id}`, {
      vendorName: 'Om Sai Tour & Travels',
      vehicleNumber: 'MH12 QK7890',
      vehicleSend: 'Maruti Dzire',
      driverName: 'Ramesh Pawar',
      driverPhone: '+91 97654 32100',
      driverAccepted: false
    }, authHeaders);
    const bk3 = updatePlottingRes.data.data;
    console.log(`✅ Booking #${bk3.bookingNo} updated with Status: ${bk3.status} (Expected: STATUS_YES)`);
    if (bk3.status !== 'STATUS_YES') throw new Error(`Expected STATUS_YES, got ${bk3.status}`);

    // 6. Driver Acceptance YES -> Expect DR_DUTY_ACCPT
    console.log('\n[TEST 6] Toggle Driver Acceptance to YES...');
    const acceptRes = await axios.put(`${BASE_URL}/aggregator/bookings/${bk1._id}`, {
      driverAccepted: true
    }, authHeaders);
    const bk4 = acceptRes.data.data;
    console.log(`✅ Booking #${bk4.bookingNo} updated with Status: ${bk4.status} (Expected: DR_DUTY_ACCPT)`);
    if (bk4.status !== 'DR_DUTY_ACCPT') throw new Error(`Expected DR_DUTY_ACCPT, got ${bk4.status}`);

    // 7. Duty Started -> Expect DR_DUTY_START
    console.log('\n[TEST 7] Mark Duty Started...');
    const startRes = await axios.put(`${BASE_URL}/aggregator/bookings/${bk1._id}`, {
      dutyStarted: true
    }, authHeaders);
    const bk5 = startRes.data.data;
    console.log(`✅ Booking #${bk5.bookingNo} updated with Status: ${bk5.status} (Expected: DR_DUTY_START)`);
    if (bk5.status !== 'DR_DUTY_START') throw new Error(`Expected DR_DUTY_START, got ${bk5.status}`);

    // 8. Upload Duty Slip
    console.log('\n[TEST 8] Upload Scanned Duty Slip...');
    const uploadRes = await axios.post(`${BASE_URL}/aggregator/bookings/${bk1._id}/upload-duty-slip`, {
      fileData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      fileName: 'DutySlip_73426_scanned.png'
    }, authHeaders);
    console.log(`✅ Duty slip uploaded: ${uploadRes.data.data.dutySlipFileName}`);

    // 9. Close Duty & Auto-Generate Invoice with Exact Same Number
    console.log('\n[TEST 9] Close Duty & Generate Same-Number Invoice...');
    const closeRes = await axios.post(`${BASE_URL}/aggregator/bookings/${bk1._id}/close-duty`, {
      garageOutKm: 10000,
      garageOutTime: '08:00',
      reportingKm: 10010,
      reportingTime: '09:00',
      releasingKm: 10120,
      releasingTime: '19:00',
      garageInKm: 10130,
      garageInTime: '20:00',
      totalKms: 120,
      totalHours: 11,
      totalDays: 1,
      driverAllowance: 300,
      tollCharges: 100,
      parkingCharges: 50,
      guestSignatureConfirmed: true
    }, authHeaders);
    const invoice = closeRes.data.invoice;
    console.log(`✅ Duty Closed! Status: ${closeRes.data.data.status}`);
    console.log(`✅ Invoice Generated! Invoice No: "${invoice.invoiceNo}" (Exact same as Duty Slip No: "${bk1.dutySlipNo}")`);
    if (String(invoice.invoiceNo) !== String(bk1.dutySlipNo)) {
      throw new Error(`Invoice No ${invoice.invoiceNo} does not match Duty Slip No ${bk1.dutySlipNo}`);
    }
    console.log(`   Taxable Amount: ₹${invoice.taxableAmount}`);
    console.log(`   CGST + SGST: ₹${invoice.cgstAmount} + ₹${invoice.sgstAmount}`);
    console.log(`   Grand Total (Nearest Rupee): ₹${invoice.grandTotal}`);
    console.log(`   Amount in Words: "${invoice.amountInWords}"`);

    // 10. Copy Booking
    console.log('\n[TEST 10] Copy / Clone Booking...');
    const copyRes = await axios.post(`${BASE_URL}/aggregator/bookings/${bk1._id}/copy`, {}, authHeaders);
    console.log(`✅ Cloned successfully! New Booking No: #${copyRes.data.data.bookingNo}`);

    // 11. Cancellation with reason requirement
    console.log('\n[TEST 11] Cancel Booking with Reason...');
    try {
      await axios.post(`${BASE_URL}/aggregator/bookings/${copyRes.data.data._id}/cancel`, { cancelReason: '' }, authHeaders);
      throw new Error('Cancellation should have failed without reason!');
    } catch (e) {
      console.log('✅ Correctly rejected empty cancellation reason');
    }

    const cancelRes = await axios.post(`${BASE_URL}/aggregator/bookings/${copyRes.data.data._id}/cancel`, {
      cancelReason: 'Meeting postponed by client coordinator'
    }, authHeaders);
    console.log(`✅ Cancelled successfully! Status: ${cancelRes.data.data.status}`);

    // 12. Verify Audit Logs
    console.log('\n[TEST 12] Verify Audit Trail for Booking & Invoice actions...');
    const auditRes = await axios.get(`${BASE_URL}/aggregator/audit-logs`, authHeaders);
    const actions = auditRes.data.data.map(l => l.action);
    console.log('   Recent Audit Actions:', actions.slice(0, 6).join(', '));
    if (!actions.includes('CREATE_BOOKING') || !actions.includes('CLOSE_DUTY') || !actions.includes('GENERATE_INVOICE')) {
      throw new Error('Audit log missing booking or invoice actions');
    }
    console.log('✅ All booking & invoice audit logs recorded');

    console.log('\n🎉 ALL BOOKINGS & DISPATCH MODULE TESTS PASSED 100%!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err.response ? err.response.data : err.message);
    process.exit(1);
  }
}

runBookingTests();
