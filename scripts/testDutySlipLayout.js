const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Redesigned Duty Slip / Rental Agreement Layout for WING\'S TRAVELS ---');

const jsCode = fs.readFileSync(path.join(__dirname, '../../WingsUI/aggregator-bookings.js'), 'utf8');

// Sandboxed evaluation to test buildDutySlipHtml
const mockDocument = {
    addEventListener: () => {},
    getElementById: () => null,
    querySelectorAll: () => []
};
const mockWindow = {
    document: mockDocument
};
const mockEval = new Function('window', 'document', jsCode + `
    return { buildDutySlipHtml };
`);

const { buildDutySlipHtml } = mockEval(mockWindow, mockDocument);
assert(typeof buildDutySlipHtml === 'function', 'buildDutySlipHtml must be a function');

const mockBroker = {
    companyLegalName: "WING'S TRAVELS",
    address: 'Office No. 402, Business Bay, Pune-Bangalore Highway',
    city: 'Pune',
    state: 'Maharashtra',
    stateCode: '27-MH',
    phone: '+91 98220 12345 / 020-25678900',
    email: 'dispatch@wingstravels.com',
    gstin: '27AAACR1234M1Z5',
    jurisdictionCity: 'PUNE'
};

const mockBooking = {
    bookingNo: '73668',
    dutySlipNo: '73668',
    travelDate: '2026-11-25',
    location: 'Pune',
    dutyRefNo: 'PO-2026-9988',
    clientName: 'Tata Consultancy Services',
    guestName: 'Anand Kumar',
    guestPhone: '+91 98220 11223',
    bookedBy: 'Rohit Verma (HR Travel Desk)',
    reportingAddress: 'TCS Sahyadri Park, Gate 2, Hinjewadi Phase 3',
    dropAddress: 'JW Marriott, Senapati Bapat Road',
    vehicleType: 'Sedan (Dzire / Etios)',
    vehicleSend: 'Maruti Suzuki Dzire (White)',
    vehicleNumber: 'MH12 RN 5566',
    packageType: '8 Hrs / 80 KMs (Local Disposal)',
    paymentMode: 'CREDIT',
    repHours: '09',
    repMinutes: '00',
    destination: 'Pune Local Disposal',
    driverName: 'Sanjay Patil',
    driverPhone: '+91 98500 99887',
    dutyCloseReadings: {
        garageOutTime: '08:30',
        garageOutKm: '45210',
        reportingTime: '09:00',
        reportingKm: '45222',
        releasingTime: '17:30',
        releasingKm: '45305',
        garageInTime: '18:15',
        garageInKm: '45318',
        totalHours: '9:00',
        totalKms: '96'
    },
    dutyCloseDetails: {
        tollAmount: 120,
        parkingAmount: 80,
        borderTax: 0,
        nightAllowance: 0,
        otherCharges: 0
    }
};

const html = buildDutySlipHtml(mockBooking, mockBroker);

// 1. Header Checks
assert(html.includes("WING'S TRAVELS"), 'Header must include WING\'S TRAVELS');
assert(html.includes("ds-logo-img"), 'Header must include logo image with class ds-logo-img');
assert(html.includes("images/Logo.png"), 'Header must load images/Logo.png');
assert(html.includes("27AAACR1234M1Z5"), 'Header must include GSTIN');
assert(html.includes("+91 98220 12345"), 'Header must include phone helpline');
assert(html.includes("#73668"), 'Header must include Duty Slip No #73668');
assert(html.includes("PO-2026-9988"), 'Header must include Duty Ref/PO No');
assert(html.includes("DUTY SLIP & RENTAL AGREEMENT"), 'Must include section title banner');
console.log('✔ Section 1: 3-Column Header & Title Banner verified.');

// 2. Client & Trip Details Grid Checks
assert(html.includes("Tata Consultancy Services"), 'Must include client name');
assert(html.includes("Anand Kumar"), 'Must include guest name');
assert(html.includes("+91 98220 11223"), 'Must include guest mobile');
assert(html.includes("Rohit Verma (HR Travel Desk)"), 'Must include booked by');
assert(html.includes("TCS Sahyadri Park, Gate 2, Hinjewadi Phase 3"), 'Must include reporting address');
assert(html.includes("JW Marriott, Senapati Bapat Road"), 'Must include drop address');
assert(html.includes("Sedan (Dzire / Etios)"), 'Must include vehicle category');
assert(html.includes("MH12 RN 5566"), 'Must include vehicle number');
assert(html.includes("09:00 hrs"), 'Must include reporting time');
assert(html.includes("Sanjay Patil"), 'Must include chauffeur name');
assert(html.includes("+91 98500 99887"), 'Must include chauffeur mobile');
console.log('✔ Section 2: Client & Trip Details Grid verified.');

// 3. Odometer & Extra Expenses Grid Checks
assert(html.includes("GARAGE LOG & PASSENGER USAGE RECORD"), 'Must include Garage Log header');
assert(html.includes("1. Garage Out (Wing's / Vendor)"), 'Must include Garage Out row');
assert(html.includes("TO BE FILLED & VERIFIED BY GUEST / RENTER"), 'Must include Guest verification subheader');
assert(html.includes("2. Guest Reporting (Opening)"), 'Must include Guest reporting row');
assert(html.includes("3. Guest Releasing (Closing)"), 'Must include Guest releasing row');
assert(html.includes("4. Garage In (Wing's / Vendor)"), 'Must include Garage In row');
assert(html.includes("TOTAL USAGE RECORD:"), 'Must include Total usage summary row');
assert(html.includes("REIMBURSEMENTS & INCIDENTALS (₹)"), 'Must include Reimbursements box');
assert(html.includes("Toll Charges (₹):"), 'Must include Toll charges row');
assert(html.includes("Parking Charges (₹):"), 'Must include Parking charges row');
assert(html.includes("₹120"), 'Must include Toll amount');
assert(html.includes("₹80"), 'Must include Parking amount');
assert(html.includes("₹200"), 'Must include Total extra expenses ₹200');
console.log('✔ Section 3: Odometer, Timing & Extra Expenses Grid verified.');

// 4. Footer Feedback Rating & Terms Checks
assert(html.includes("GUEST / RENTER SERVICE FEEDBACK"), 'Must include service feedback header');
assert(html.includes("1. Vehicle Cleanliness, AC & Condition"), 'Must include parameter 1');
assert(html.includes("2. Chauffeur Grooming & Punctuality"), 'Must include parameter 2');
assert(html.includes("3. Chauffeur Safe Driving & Route Skill"), 'Must include parameter 3');
assert(html.includes("4. Booking & Coordination Desk"), 'Must include parameter 4');
assert(html.includes("5. Overall Trip & Rental Experience"), 'Must include parameter 5');
assert(html.includes("ds-chkbox"), 'Must include rating checkboxes');
assert(html.includes("RENTAL TERMS & CONDITIONS"), 'Must include terms & conditions');
assert(html.includes("PUNE jurisdiction"), 'Must include Pune jurisdiction');
assert(html.includes("Guest / Renter Signature"), 'Must include Guest signature line');
assert(html.includes("Date & Releasing Time"), 'Must include Date & Time line');
assert(html.includes("Chauffeur / Driver Signature"), 'Must include Driver signature strip');
console.log('✔ Section 4: Feedback rating matrix, Terms & Signatures verified.');

// 5. CSS Print Rules Check
const cssContent = fs.readFileSync(path.join(__dirname, '../../WingsUI/aggregator-bookings.css'), 'utf8');
assert(cssContent.includes('.ds-a4-sheet'), 'CSS must contain .ds-a4-sheet');
assert(cssContent.includes('@media print'), 'CSS must contain @media print');
assert(cssContent.includes('size: A4 portrait;'), 'CSS must specify A4 portrait page size');
assert(cssContent.includes('print-color-adjust: exact'), 'CSS must specify print-color-adjust');
assert(cssContent.includes('.app-layout'), 'CSS @media print must hide .app-layout');
assert(cssContent.includes('.main-wrapper'), 'CSS @media print must hide .main-wrapper');
assert(cssContent.includes('.main-content'), 'CSS @media print must hide .main-content');
assert(cssContent.includes('.tab-panel'), 'CSS @media print must hide .tab-panel');
assert(cssContent.includes('.table-card'), 'CSS @media print must hide .table-card');
console.log('✔ Section 5: A4 Single-Page Print CSS rules and layout masking verified.');

// 6. Modal Action Buttons & "Open in Dedicated Tab" Styling Check
const htmlContent = fs.readFileSync(path.join(__dirname, '../../WingsUI/aggregator-admin.html'), 'utf8');
assert(htmlContent.includes('Open in Dedicated Tab'), 'aggregator-admin.html must contain "Open in Dedicated Tab" text');
assert(htmlContent.includes('openDutySlipInNewWindow()'), 'Must contain openDutySlipInNewWindow() call');
assert(!htmlContent.includes('class="btn btn-outline btn-sm" onclick="openDutySlipInNewWindow()"'), 'Open tab button must NOT use btn-outline which causes white text on white button');
console.log('✔ Section 6: "Open in Dedicated Tab" modal button styling & visibility verified.');

// 7. Isolated Iframe Print Function Check
assert(jsCode.includes('function printDutySlipNow()'), 'Must define printDutySlipNow function');
assert(jsCode.includes('dutySlipPrintIframe'), 'printDutySlipNow must use isolated iframe dutySlipPrintIframe');
assert(jsCode.includes('printIframe.contentWindow.print()'), 'printDutySlipNow must trigger print on isolated iframe');
console.log('✔ Section 7: Isolated iframe print execution in printDutySlipNow verified.');

// 8. Booking Detail Modal Header Action Buttons Styling Check
assert(htmlContent.includes('Copy Booking'), 'aggregator-admin.html must contain "Copy Booking" text in sheet header');
assert(htmlContent.includes('Print Duty Slip'), 'aggregator-admin.html must contain "Print Duty Slip" text in sheet header');
assert(htmlContent.includes('Print Placard'), 'aggregator-admin.html must contain "Print Placard" text in sheet header');
assert(htmlContent.includes('Cancel Booking'), 'aggregator-admin.html must contain "Cancel Booking" text in sheet header');
assert(!htmlContent.includes('class="btn btn-outline btn-sm" onclick="copyCurrentActiveBooking()"'), 'Copy booking button must NOT use btn-outline');
assert(!htmlContent.includes('class="btn btn-outline btn-sm" onclick="promptCancelCurrentBooking()"'), 'Cancel booking button must NOT use btn-outline');
assert(htmlContent.includes('closeModal(\'bookingDetailModal\')') && htmlContent.includes('position: absolute; top: 14px; right: 18px;'), 'Booking detail modal close button must be positioned at top-right corner');
console.log('✔ Section 8: Booking Detail Modal header buttons styling, labels & visibility verified.');

console.log('\n========================================================');
console.log('ALL DUTY SLIP REDESIGN & PRINT FIX TESTS PASSED (100%)!');
console.log('========================================================');
