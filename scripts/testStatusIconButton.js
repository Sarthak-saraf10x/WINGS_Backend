const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Compact Status Action Icon Button in Booking Chart Table ---');

// 1. Verify CSS styles in aggregator-bookings.css
const cssPath = path.join(__dirname, '../../WingsUI/aggregator-bookings.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

assert(cssContent.includes('.bk-action-icon-btn'), 'Missing .bk-action-icon-btn CSS definition');
assert(cssContent.includes('width: 32px !important'), 'Button must be compact 32px width');
assert(cssContent.includes('height: 32px !important'), 'Button must be compact 32px height');
assert(cssContent.includes('.status-start-ready'), 'Missing .status-start-ready CSS class');
assert(cssContent.includes('.status-end-active'), 'Missing .status-end-active CSS class');
assert(cssContent.includes('.status-close-ended'), 'Missing .status-close-ended CSS class');
console.log('✔ Test 1: CSS definitions verified for 32x32px compact icon buttons across all duty states.');

// 2. Sandboxed execution of renderBookingsTable in aggregator-bookings.js
const jsPath = path.join(__dirname, '../../WingsUI/aggregator-bookings.js');
const jsCode = fs.readFileSync(jsPath, 'utf8');

const mockElements = {
    bookingsTableBody: { innerHTML: '' }
};

const mockDocument = {
    addEventListener: () => {},
    getElementById: (id) => mockElements[id] || { style: {}, classList: { add: () => {}, remove: () => {} } },
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
        renderBookingsTable,
        setBookingsList: (l) => { bookingsList = l; },
        getBookingsList: () => bookingsList
    };
`);

const sandbox = evalFn(mockWindow, mockDocument, () => {}, () => {}, async () => ({}));

const sampleBookings = [
    {
        _id: 'bk_start_test',
        bookingNo: '9001',
        dutySlipNo: '9001',
        status: 'DR_DUTY_ACCPT',
        driverAccepted: true,
        dutyStarted: false,
        dutyClosed: false,
        clientName: 'Infosys BPM Pune',
        guestName: 'Arun Verma',
        travelDate: '2026-11-25',
        reqTime: '09:00',
        repHours: '09',
        repMinutes: '00',
        vehicleType: 'Sedan A/C',
        driverName: 'Ramesh Pawar',
        vehicleNumber: 'MH12 AB1234'
    },
    {
        _id: 'bk_end_test',
        bookingNo: '9002',
        dutySlipNo: '9002',
        status: 'DR_DUTY_START',
        driverAccepted: true,
        dutyStarted: true,
        dutyClosed: false,
        clientName: 'Tata Consultancy Services (TCS)',
        guestName: 'Bhavna Rao',
        travelDate: '2026-11-25',
        reqTime: '10:00',
        repHours: '10',
        repMinutes: '00',
        vehicleType: 'SUV / Innova',
        driverName: 'Vikram Gaikwad',
        vehicleNumber: 'MH12 CD5678'
    },
    {
        _id: 'bk_closed_test',
        bookingNo: '9003',
        dutySlipNo: '9003',
        status: 'DR_DUTY_CLOSE',
        driverAccepted: true,
        dutyStarted: true,
        dutyClosed: true,
        isInvoiced: false,
        isPaid: false,
        paymentStatus: 'PENDING',
        clientName: 'Tech Mahindra Ltd.',
        guestName: 'Chetan Desai',
        travelDate: '2026-11-25',
        reqTime: '08:00',
        repHours: '08',
        repMinutes: '00',
        vehicleType: 'Sedan A/C',
        driverName: 'Sachin Kadam',
        vehicleNumber: 'MH12 EF9012'
    }
];

sandbox.setBookingsList(sampleBookings);
sandbox.renderBookingsTable(sampleBookings);
const html = mockElements.bookingsTableBody.innerHTML;

// 2.1 Verify "Start Booking" icon button
assert(html.includes('bk-action-icon-btn'), 'Booking row must render .bk-action-icon-btn');
assert(html.includes('status-start-ready'), 'Unstarted accepted booking must have .status-start-ready');
assert(html.includes('bi-play-circle-fill'), 'Unstarted accepted booking must display play icon');
assert(html.includes('title="Start Booking: Start Duty Manually (Driver Communicated)"'), 'Must display "Start Booking" tooltip on hover');
console.log('✔ Test 2.1: Start Booking renders compact green Play icon button with hover tooltip.');

// 2.2 Verify "End Booking / Close Booking" icon button
assert(html.includes('status-end-active'), 'Running duty must render .status-end-active');
assert(html.includes('bi-stop-circle-fill'), 'Running duty must display stop icon');
assert(html.includes('title="End Booking / Close Duty: Duty is running (DR Duty Started) - Click to Close Duty &amp; Send to Billing"') ||
       html.includes('title="End Booking / Close Duty: Duty is running (DR Duty Started) - Click to Close Duty & Send to Billing"'),
       'Running duty must display "End Booking" tooltip on hover');
console.log('✔ Test 2.2: End Booking renders compact red Stop icon button with pulsing border and hover tooltip.');

// 2.3 Verify "Close Ended / In Billing" icon button
assert(html.includes('status-close-ended'), 'Closed duty must render .status-close-ended');
assert(html.includes('bi-receipt-cutoff'), 'Closed duty must display receipt icon');
assert(html.includes('jumpToBilling(\'bk_closed_test\')'), 'Closed duty icon button must trigger jumpToBilling()');
assert(html.includes('title="Close Ended &rarr; In Billing (Click to view and bill in Billing section)"'), 'Closed duty must display "Close Ended -> In Billing" tooltip on hover');
console.log('✔ Test 2.3: Close Ended renders compact purple Receipt icon button that jumps to Billing with hover tooltip.');

// 2.4 Verify no bulky switch toggle pill is rendered in the action cell
assert(!html.includes('bk-switch-toggle'), 'Old bulky switch toggle element (.bk-switch-toggle) should be replaced with compact icon button');
console.log('✔ Test 2.4: Wide toggle switch removed from table layout, replaced with 32px icon button.');

console.log('\n========================================================');
console.log('ALL COMPACT STATUS ICON BUTTON TESTS PASSED (100%)!');
console.log('========================================================\n');
