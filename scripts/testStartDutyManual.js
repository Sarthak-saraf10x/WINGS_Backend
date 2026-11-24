const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Manual Start Duty Options for Dispatcher ---');

// 1. Verify HTML elements in aggregator-admin.html
const htmlPath = path.join(__dirname, '../../WingsUI/aggregator-admin.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

assert(htmlContent.includes('id="sheetHeaderDutyStarted"'), 'Missing #sheetHeaderDutyStarted in booking sheet header');
assert(htmlContent.includes('id="sheetDutyStartedToggle"'), 'Missing #sheetDutyStartedToggle in booking sheet plotting details');
assert(htmlContent.includes('id="sheetBtnStartDuty"'), 'Missing #sheetBtnStartDuty in booking sheet header');
assert(htmlContent.includes('startDutyFromSheet()'), 'Missing onclick="startDutyFromSheet()" on Start Duty button');
console.log('✔ Test 1: HTML elements (header checkbox, form checkbox, start button) verified in aggregator-admin.html.');

// 2. Sandboxed test of aggregator-bookings.js
const jsPath = path.join(__dirname, '../../WingsUI/aggregator-bookings.js');
const jsCode = fs.readFileSync(jsPath, 'utf8');

let lastToast = null;
const mockToast = (msg, type) => {
    lastToast = { msg, type };
};

let confirmed = true;
const mockConfirm = (msg) => confirmed;

let authFetchCalls = [];
const mockFetchAuth = async (url, opts) => {
    authFetchCalls.push({ url, opts });
    return { success: true, message: 'Duty started successfully', data: { dutyStarted: true, status: 'DR_DUTY_START' } };
};

const mockElements = {
    bookingDetailModal: { classList: { contains: () => false } },
    sheetDsNoDisplay: { textContent: '' },
    sheetHiddenId: { value: '' },
    sheetHeaderDrAcpt: { checked: false },
    sheetHeaderDutyStarted: { checked: false },
    sheetDutyStartedToggle: { checked: false },
    sheetDrAcptToggle: { checked: false },
    sheetBtnStartDuty: { style: {}, title: '' },
    sheetBtnStartDutyText: { textContent: '' },
    sheetBtnPrintDutySlip: { style: {}, title: '' },
    sheetHeaderStatusBadge: { innerHTML: '' },
    sheetLiveComputedPill: { innerHTML: '' },
    sheetChecklistFeedback: { className: '', innerHTML: '' },
    sheetTravelDate: { value: '2026-11-25' },
    sheetEndDate: { value: '' },
    sheetRepHours: { value: '09' },
    sheetRepMinutes: { value: '00' },
    sheetOffHours: { value: '' },
    sheetOffMinutes: { value: '' },
    sheetTimingNotes: { value: '' },
    sheetClientSelect: { value: 'c1', selectedIndex: 1, options: [{ text: '' }, { text: 'TCS' }] },
    sheetLocation: { value: 'Pune', options: [{ value: 'Pune', text: 'Pune' }, { value: 'Pan India', text: 'Pan India' }] },
    sheetBookedBy: { value: 'Admin' },
    sheetBookedByPhone: { value: '' },
    sheetVehicleType: { value: 'Sedan' },
    sheetPackageType: { value: 'Local 8hr/80km', options: [{ value: 'Local 8hr/80km', text: 'Local 8hr/80km' }] },
    sheetDestination: { value: 'Local Disposal' },
    sheetDutyRefNo: { value: '' },
    sheetRemarks: { value: '' },
    sheetGuestName: { value: 'Anand Kumar' },
    sheetGuestPhone: { value: '+91 98220 12345' },
    sheetReportingAddr: { value: 'Hinjewadi' },
    sheetDropAddr: { value: 'Airport' },
    sheetPassengerTbody: { innerHTML: '', querySelectorAll: () => [] },
    sheetVendorSelect: { value: 'ADHOC', selectedIndex: 0, options: [{ text: 'Ad-hoc Vendor' }] },
    sheetVendorPackage: { value: 'Local 8hr/80km', options: [{ value: 'Local 8hr/80km', text: 'Local 8hr/80km' }] },
    sheetVendorPenalty: { value: '0' },
    sheetVendorFixRate: { value: '0' },
    sheetVendorKmRate: { value: '0' },
    sheetCashToVendor: { value: '0' },
    sheetDriverName: { value: 'Sanjay Patil' },
    sheetDriverPhone: { value: '+91 98500 12345' },
    sheetVehicleNumber: { value: 'MH12 AB 1234' },
    sheetVehicleSend: { value: 'Dzire' },
    sheetPaymentMode: { value: 'CREDIT' },
    sheetAuditFooter: { textContent: '' },
    bookingsTableBody: { innerHTML: '' }
};

const mockDocument = {
    addEventListener: () => {},
    getElementById: (id) => mockElements[id] || null,
    querySelectorAll: () => []
};

const mockWindow = {
    document: mockDocument
};

const evalFn = new Function('window', 'document', 'showToast', 'confirm', 'fetchAuth', `
    let companiesList = [];
    let vendorsList = [];
    const API_BASE = 'http://localhost:5004/api';
` + jsCode + `
    return {
        startDutyManually,
        startDutyFromSheet,
        collectSheetFormData,
        renderBookingSheetForm,
        updateSheetLiveCompleteness,
        computeBookingStatusClient,
        canCloseDutyBooking,
        canPrintDutySlipBooking,
        renderBookingsTable,
        setBookingsList: (list) => { bookingsList = list; },
        setCurrentActiveBooking: (b) => { currentActiveBooking = b; }
    };
`);

const {
    startDutyManually,
    startDutyFromSheet,
    collectSheetFormData,
    renderBookingSheetForm,
    updateSheetLiveCompleteness,
    computeBookingStatusClient,
    canCloseDutyBooking,
    canPrintDutySlipBooking,
    renderBookingsTable,
    setBookingsList,
    setCurrentActiveBooking
} = evalFn(mockWindow, mockDocument, mockToast, mockConfirm, mockFetchAuth);

// 3. Test collectSheetFormData and renderBookingSheetForm
mockElements.sheetDutyStartedToggle.checked = true;
const formData = collectSheetFormData();
assert.strictEqual(formData.dutyStarted, true, 'collectSheetFormData must capture dutyStarted');
console.log('✔ Test 2: collectSheetFormData correctly extracts dutyStarted boolean.');

const sampleBooking = {
    _id: 'bk_manual_1',
    bookingNo: '8801',
    dutySlipNo: '8801',
    clientName: 'TCS',
    guestName: 'Anand Kumar',
    vehicleNumber: 'MH12 AB 1234',
    driverName: 'Sanjay Patil',
    driverAccepted: true,
    dutyStarted: false,
    dutyClosed: false
};

renderBookingSheetForm(sampleBooking);
assert.strictEqual(mockElements.sheetHeaderDutyStarted.checked, false, 'Header checkbox must match booking dutyStarted');
assert.strictEqual(mockElements.sheetDutyStartedToggle.checked, false, 'Form checkbox must match booking dutyStarted');

sampleBooking.dutyStarted = true;
renderBookingSheetForm(sampleBooking);
assert.strictEqual(mockElements.sheetHeaderDutyStarted.checked, true, 'Header checkbox must be checked when dutyStarted is true');
assert.strictEqual(mockElements.sheetDutyStartedToggle.checked, true, 'Form checkbox must be checked when dutyStarted is true');
console.log('✔ Test 3: renderBookingSheetForm properly populates both dutyStarted toggles.');

// 4. Test startDutyFromSheet
(async () => {
    setCurrentActiveBooking(sampleBooking);
    mockElements.sheetDutyStartedToggle.checked = false;
    mockElements.sheetHeaderDutyStarted.checked = false;
    sampleBooking.dutyStarted = false;
    authFetchCalls = [];

    await startDutyFromSheet();
    assert.strictEqual(mockElements.sheetDutyStartedToggle.checked, true, 'startDutyFromSheet must check sheetDutyStartedToggle');
    assert.strictEqual(mockElements.sheetHeaderDutyStarted.checked, true, 'startDutyFromSheet must check sheetHeaderDutyStarted');
    assert(authFetchCalls.length > 0, 'startDutyFromSheet must invoke API to start duty');
    console.log('✔ Test 4: startDutyFromSheet seamlessly marks duty started and calls API.');

    // 5. Test startDutyManually table action
    const unstartedBooking = {
        _id: 'bk_manual_2',
        bookingNo: '8802',
        dutySlipNo: '8802',
        clientName: 'Infosys',
        guestName: 'Rajesh',
        vehicleNumber: 'MH12 CD 5678',
        driverName: 'Sunil Pawar',
        driverAccepted: true,
        dutyStarted: false,
        dutyClosed: false
    };
    setBookingsList([unstartedBooking]);

    authFetchCalls = [];
    await startDutyManually('bk_manual_2');
    assert(authFetchCalls.length > 0, 'startDutyManually must call API to start duty');
    assert(authFetchCalls[0].url.includes('/start-duty'), 'startDutyManually must target /start-duty endpoint');
    assert.strictEqual(unstartedBooking.dutyStarted, true, 'Booking dutyStarted must be updated to true');
    assert.strictEqual(unstartedBooking.status, 'DR_DUTY_START', 'Status must transition to DR_DUTY_START');
    console.log('✔ Test 5: startDutyManually successfully prompts, starts duty and transitions status to DR_DUTY_START.');

    // 6. Test Bookings Table row action button rendering
    setBookingsList([
        { _id: '1', bookingNo: '1', dutySlipNo: '1', driverAccepted: true, dutyStarted: false, dutyClosed: false },
        { _id: '2', bookingNo: '2', dutySlipNo: '2', driverAccepted: true, dutyStarted: true, dutyClosed: false },
        { _id: '3', bookingNo: '3', dutySlipNo: '3', driverAccepted: false, dutyStarted: false, dutyClosed: false }
    ]);

    renderBookingsTable();
    const tableHtml = mockElements.bookingsTableBody.innerHTML;
    assert(tableHtml.includes('startDutyManually'), 'Table actions must include startDutyManually button');
    assert(tableHtml.includes('Start Duty Manually (Driver Communicated)'), 'Ready booking must have Start Duty Manually tooltip');
    assert(tableHtml.includes('Duty is running (DR Duty Started)'), 'Running booking must display running duty tooltip');
    console.log('✔ Test 6: Bookings table renders Start Duty button with live dynamic statuses and tooltips.');

    // 7. Verify backend router has /bookings/:id/start-duty
    const routesPath = path.join(__dirname, '../routes/aggregatorRoutes.js');
    const routesCode = fs.readFileSync(routesPath, 'utf8');
    assert(routesCode.includes('router.post(\'/bookings/:id/start-duty\''), 'Backend aggregatorRoutes must have POST /bookings/:id/start-duty');
    console.log('✔ Test 7: Backend POST /api/aggregator/bookings/:id/start-duty route verified.');

    console.log('\n========================================================');
    console.log('ALL MANUAL START DUTY TESTS PASSED (100%)!');
    console.log('========================================================');
})();
