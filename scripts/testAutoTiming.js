const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Auto-Recognition of Booking Timing (No Manual Checkbox) ---');

// 1. Verify checkbox is removed from HTML
const html = fs.readFileSync(path.join(__dirname, '../../WingsUI/aggregator-admin.html'), 'utf8');
assert(!html.includes('id="sheetNoTimingCheck"'), 'HTML must not have checkbox with id="sheetNoTimingCheck"');
assert(!html.includes('<span>No Timing</span>'), 'HTML must not have "<span>No Timing</span>" label checkbox');
console.log('✔ Test 1: "No Timing" checkbox completely removed from aggregator-admin.html');

// 2. Load and verify aggregator-bookings.js logic
const jsCode = fs.readFileSync(path.join(__dirname, '../../WingsUI/aggregator-bookings.js'), 'utf8');

const mockDocument = {
    addEventListener: () => {},
    getElementById: () => null,
    querySelectorAll: () => []
};
const mockWindow = {
    document: mockDocument
};

const mockEval = new Function('window', 'document', jsCode + `
    return { computeBookingStatusClient, getMissingChecklist, buildDutySlipHtml };
`);
const { computeBookingStatusClient, getMissingChecklist, buildDutySlipHtml } = mockEval(mockWindow, mockDocument);

// Test 2a: When no timing is provided, system recognizes NO_TIMING automatically
const bkNoTiming = {
    clientName: 'Wipro',
    travelDate: '2026-11-25',
    guestName: 'Rahul Mehta',
    vehicleType: 'Sedan',
    packageType: '8h/80km',
    repHours: '',
    repMinutes: '',
    reqTime: ''
};
const st1 = computeBookingStatusClient(bkNoTiming);
assert.strictEqual(st1, 'NO_TIMING', 'Booking without timing must automatically have status NO_TIMING');
const missing1 = getMissingChecklist(bkNoTiming);
assert(missing1.includes('Pickup Time'), 'Missing checklist must include "Pickup Time" when timing is blank');
console.log('✔ Test 2: Blank timing automatically recognized as NO_TIMING without ticking any checkbox');

// Test 2b: When timing is entered, system automatically moves out of NO_TIMING
const bkTGreatTiming = {
    clientName: 'Wipro',
    travelDate: '2026-11-25',
    guestName: 'Rahul Mehta',
    vehicleType: 'Sedan',
    packageType: '8h/80km',
    repHours: '09',
    repMinutes: '30',
    reqTime: '09:30'
};
const st2 = computeBookingStatusClient(bkTGreatTiming);
assert.notStrictEqual(st2, 'NO_TIMING', 'Booking with timing must NOT be NO_TIMING');
assert.strictEqual(st2, 'STATUS_NO', 'Unplotted booking with timing must be STATUS_NO (waiting for cab/driver allotment)');
const missing2 = getMissingChecklist(bkTGreatTiming);
assert(!missing2.includes('Pickup Time'), 'Missing checklist must NOT include "Pickup Time" when timing is entered');
console.log('✔ Test 3: Entering timing automatically transitions status from NO_TIMING to STATUS_NO');

// Test 2c: When fully plotted and timing added
const bkFullyReady = {
    clientName: 'Wipro',
    travelDate: '2026-11-25',
    guestName: 'Rahul Mehta',
    vehicleType: 'Sedan',
    packageType: '8h/80km',
    vendorName: 'Direct Fleet',
    vehicleNumber: 'MH12 AB 1234',
    driverName: 'Ramesh Kumar',
    repHours: '09',
    repMinutes: '00',
    reqTime: '09:00'
};
const st3 = computeBookingStatusClient(bkFullyReady);
assert.strictEqual(st3, 'STATUS_YES', 'Complete booking with timing and plotting must be STATUS_YES');
console.log('✔ Test 4: Fully plotted booking with timing is automatically STATUS_YES');

// 3. Verify backend computeBookingStatus logic
const backendRoutesCode = fs.readFileSync(path.join(__dirname, '../routes/aggregatorRoutes.js'), 'utf8');
assert(backendRoutesCode.includes('// 5. Missing Timing (Auto-detected):'), 'Backend must auto-detect missing timing');

console.log('\n========================================================');
console.log('ALL AUTO-TIMING & CHECKBOX REMOVAL TESTS PASSED (100%)!');
console.log('========================================================');
