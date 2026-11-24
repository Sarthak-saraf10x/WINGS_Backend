const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Split Duty Closure From Billing & Start/Close Switch Control ---');

// =========================================================================
// 1. Verify HTML Structure in aggregator-admin.html
// =========================================================================
const htmlPath = path.join(__dirname, '../../WingsUI/aggregator-admin.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// 1.1 Dedicated Sidebar Item for Billing with Counter Badge
assert(htmlContent.includes('id="sidebarItemBilling"'), 'Missing #sidebarItemBilling in sidebar menu');
assert(htmlContent.includes('data-tab="billing"'), 'Missing data-tab="billing" on billing sidebar button');
assert(htmlContent.includes('id="countBadgeBilling"'), 'Missing #countBadgeBilling live counter badge in sidebar');
console.log('✔ Test 1.1: Billing sidebar item and live counter badge verified.');

// 1.2 Dedicated Billing Section / Tab
assert(htmlContent.includes('id="tab-billing"'), 'Missing <section id="tab-billing"> section');
assert(htmlContent.includes('data-stage="ALL"'), 'Missing stage filter ALL');
assert(htmlContent.includes('data-stage="PENDING"'), 'Missing stage filter PENDING (Ready to Bill)');
assert(htmlContent.includes('data-stage="INVOICED"'), 'Missing stage filter INVOICED');
assert(htmlContent.includes('data-stage="PAID"'), 'Missing stage filter PAID');
assert(htmlContent.includes('id="billingTable"'), 'Missing #billingTable');
assert(htmlContent.includes('id="billingTableBody"'), 'Missing #billingTableBody');
assert(htmlContent.includes('id="billingStatPending"'), 'Missing #billingStatPending card');
assert(htmlContent.includes('id="billingStatInvoiced"'), 'Missing #billingStatInvoiced card');
assert(htmlContent.includes('id="billingStatPaid"'), 'Missing #billingStatPaid card');
assert(htmlContent.includes('id="billingStatOutstanding"'), 'Missing #billingStatOutstanding card');
console.log('✔ Test 1.2: Dedicated Billing section, stage filters, stats cards, and table verified.');

// 1.3 Dedicated Billing Sheet Modal with 3-Step Workflow
assert(htmlContent.includes('id="billingSheetModal"'), 'Missing #billingSheetModal for dedicated billing workflow');
assert(htmlContent.includes('id="bsStepPanel1"'), 'Missing #bsStepPanel1 (Step 1: Duty Slip & Readings)');
assert(htmlContent.includes('id="bsStepPanel2"'), 'Missing #bsStepPanel2 (Step 2: Same-Number Tax Invoice)');
assert(htmlContent.includes('id="bsStepPanel3"'), 'Missing #bsStepPanel3 (Step 3: Payment & Summary)');
assert(htmlContent.includes('id="bsDutySlipFileInput"'), 'Missing duty slip file upload input in billing sheet');
assert(htmlContent.includes('id="bsInvoiceCalculationBox"'), 'Missing #bsInvoiceCalculationBox container');
assert(htmlContent.includes('id="btnSubmitBillingPayment"'), 'Missing #btnSubmitBillingPayment button');
console.log('✔ Test 1.3: 3-Step Billing Sheet Modal (Readings, Invoice, Payment) verified.');

// 1.4 Role-Based Access for DISPATCHER & ADMIN
assert(htmlContent.includes("if (role === 'DISPATCHER' && ['companies', 'vendors', 'users', 'profile'].includes(tabKey))"), 'Master Data restricted to ADMIN, while bookings and billing are open to DISPATCHER');
console.log('✔ Test 1.4: Role permissions verified (ADMIN & DISPATCHER have access to billing and bookings; master data restricted to ADMIN).');

// =========================================================================
// 2. Sandboxed Verification of aggregator-bookings.js
// =========================================================================
const jsPath = path.join(__dirname, '../../WingsUI/aggregator-bookings.js');
const jsCode = fs.readFileSync(jsPath, 'utf8');

// Mock DOM elements
const mockElements = {
    bookingsTableBody: { innerHTML: '' },
    billingTableBody: { innerHTML: '' },
    countBadgeBilling: { textContent: '', style: {} },
    billingStatPendingCount: { textContent: '' },
    billingStatInvoicedCount: { textContent: '' },
    billingStatPaidCount: { textContent: '' },
    billingStatInvoicedAmount: { textContent: '' },
    billingStatPaidAmount: { textContent: '' },
    billingFilterStage: { value: 'ALL' },
    billingFilterCompany: { value: '', options: [{ value: '', text: 'All Companies' }] },
    billingFilterDateFrom: { value: '' },
    billingFilterDateTo: { value: '' },
    billingSearchInput: { value: '' },
    dutyCloseModal: { classList: { add: () => {}, remove: () => {} } },
    billingSheetModal: { classList: { add: () => {}, remove: () => {} } },
    bsDsNoDisplay: { textContent: '' },
    bsClientNameDisplay: { textContent: '' },
    bsGuestDisplay: { textContent: '' },
    bsVehicleDisplay: { textContent: '' },
    bsStatusBadgeDisplay: { innerHTML: '' },
    bsSlipFilePreviewWrap: { innerHTML: '' },
    bsDutySlipFileInput: { value: '', files: [] },
    bsTotalKms: { value: '100' },
    bsTotalHours: { value: '8' },
    bsTotalDays: { value: '1' },
    bsTotalNights: { value: '0' },
    bsDriverAllowance: { value: '250' },
    bsLateNightCharges: { value: '0' },
    bsPermitCharges: { value: '0' },
    bsFuelSurcharge: { value: '0' },
    bsTollCharges: { value: '100' },
    bsParkingCharges: { value: '50' },
    bsGuestSignatureConfirmed: { checked: true },
    bsInvoiceContainer: { innerHTML: '' },
    bsInvoiceNoDisplay: { textContent: '' },
    bsInvoiceStatusBadge: { innerHTML: '' },
    btnGenerateBillingInvoice: { textContent: '', style: {} },
    bsPaymentStatusBadge: { innerHTML: '' },
    bsPaymentInvoiceAmount: { textContent: '' },
    bsPaymentRecordedWrap: { style: {}, innerHTML: '' },
    bsPaymentFormWrap: { style: {} },
    bsPayMode: { value: 'NEFT' },
    bsPayAmount: { value: '3500' },
    bsPayUtr: { value: 'UTR-TEST-123' },
    bsPayDate: { value: '2026-11-24' },
    bsPayNotes: { value: 'Corporate payment' },
    bsPaymentMode: { value: 'NEFT' },
    bsPaymentAmount: { value: '3500' },
    bsPaymentUtr: { value: 'UTR-TEST-123' },
    bsPaymentDate: { value: '2026-11-24' },
    bsPaymentNotes: { value: 'Corporate payment' },
    bsTabBtn1: { classList: { add: () => {}, remove: () => {} } },
    bsTabBtn2: { classList: { add: () => {}, remove: () => {} } },
    bsTabBtn3: { classList: { add: () => {}, remove: () => {} } },
    bsPanel1: { style: {} },
    bsPanel2: { style: {} },
    bsPanel3: { style: {} },
    closeDutyBookingId: { value: '' },
    closeDutySlipNo: { textContent: '' },
    closeDutyClient: { textContent: '' },
    closeDutyVehicle: { textContent: '' },
    closeDutyDriver: { textContent: '' }
};

const mockDocument = {
    addEventListener: () => {},
    getElementById: (id) => mockElements[id] || { style: {}, classList: { add: () => {}, remove: () => {}, contains: () => false }, innerHTML: '', value: '' },
    querySelectorAll: () => [],
    querySelector: () => null
};

let lastToast = null;
const mockToast = (msg, type) => { lastToast = { msg, type }; };
let mockConfirmAnswer = true;
const mockConfirm = (msg) => mockConfirmAnswer;

const mockWindow = {
    document: mockDocument,
    currentUser: { id: 'usr_disp', name: 'Dispatcher Dave', role: 'DISPATCHER' },
    switchTab: () => {}
};

const evalFn = new Function('window', 'document', 'showToast', 'confirm', 'fetchAuth', `
    let companiesList = [
        {
            _id: 'mock_comp2',
            companyName: 'Tata Consultancy Services (TCS)',
            state: 'Maharashtra',
            gstNumber: '27AABCT2345M1Z2',
            tollParkingTaxable: true,
            extraHourRoundingRule: 'ROUND_60_MIN',
            rateCards: [
                {
                    vehicleCategory: 'Sedan A/C',
                    packageName: '8 Hrs / 80 Km',
                    baseHours: 8,
                    baseKms: 80,
                    basePackageRate: 2150,
                    extraKmRate: 17,
                    extraHourRate: 190,
                    driverDayAllowance: 250,
                    nightLateAllowance: 200
                }
            ]
        },
        {
            _id: 'mock_comp4',
            companyName: 'Wipro Technologies (Karnataka Corporate)',
            state: 'Karnataka',
            stateCode: '29-KA',
            gstNumber: '29AABCE1234N1Z8',
            extraHourRoundingRule: 'EXACT',
            rateCards: [
                {
                    vehicleCategory: 'SUV / Innova',
                    packageName: '8 Hrs / 80 Km',
                    baseHours: 8,
                    baseKms: 80,
                    basePackageRate: 2800,
                    extraKmRate: 21,
                    extraHourRate: 250,
                    driverDayAllowance: 300,
                    nightLateAllowance: 250
                }
            ]
        }
    ];
    let vendorsList = [];
    const API_BASE = 'http://localhost:5004/api';
` + jsCode + `
    return {
        getBillingStage,
        updateBillingSidebarBadge,
        renderBookingsTable,
        renderBillingTable,
        handleBookingSwitchToggle,
        calculateInvoiceForBookingClient,
        saveBillingReadings,
        generateInvoiceFromBilling,
        recordBillingPayment,
        setBookingsList: (l) => { bookingsList = l; },
        getBookingsList: () => bookingsList,
        setCurrentActiveBooking: (b) => { currentActiveBooking = b; },
        getCurrentActiveBooking: () => currentActiveBooking,
        setCurrentBillingBooking: (b) => { currentBillingBooking = b; },
        getCurrentBillingBooking: () => currentBillingBooking,
        setBillingFilterStage: (s) => { billingFilterStage = s; },
        getBillingFilterStage: () => billingFilterStage
    };
`);

const sandbox = evalFn(mockWindow, mockDocument, mockToast, mockConfirm, async () => ({ success: true }));

// 2.1 Test Start / Close Booking Switch Rendering in Bookings Table
const testBookings = [
    {
        _id: 'bk_unstarted_1',
        bookingNo: '8001',
        dutySlipNo: '8001',
        status: 'DR_DUTY_ACCPT',
        dutyStarted: false,
        dutyClosed: false,
        clientName: 'Infosys BPM Pune',
        guestName: 'John Doe',
        travelDate: '2026-11-24',
        reqTime: '10:00',
        repHours: '10',
        repMinutes: '00',
        vehicleType: 'Sedan A/C',
        driverName: 'Ramesh',
        vehicleNumber: 'MH12 AB1234'
    },
    {
        _id: 'bk_started_2',
        bookingNo: '8002',
        dutySlipNo: '8002',
        status: 'DR_DUTY_START',
        dutyStarted: true,
        dutyClosed: false,
        clientName: 'Infosys BPM Pune',
        guestName: 'Jane Smith',
        travelDate: '2026-11-24',
        reqTime: '09:00',
        repHours: '09',
        repMinutes: '00',
        vehicleType: 'Sedan A/C',
        driverName: 'Suresh',
        vehicleNumber: 'MH12 CD5678'
    },
    {
        _id: 'bk_closed_3',
        bookingNo: '8003',
        dutySlipNo: '8003',
        status: 'DR_DUTY_CLOSE',
        dutyStarted: true,
        dutyClosed: true,
        isInvoiced: false,
        isPaid: false,
        paymentStatus: 'PENDING',
        clientName: 'Infosys BPM Pune',
        guestName: 'Alex Wong',
        travelDate: '2026-11-24',
        reqTime: '08:00',
        repHours: '08',
        repMinutes: '00',
        vehicleType: 'Sedan A/C',
        driverName: 'Mahesh',
        vehicleNumber: 'MH12 EF9012'
    }
];

sandbox.setBookingsList(testBookings);
sandbox.renderBookingsTable(testBookings);
const tableHtml = mockElements.bookingsTableBody.innerHTML;

// Verify unstarted switch
assert(tableHtml.includes('bk-switch-control'), 'Table row must include .bk-switch-control for duty toggling');
assert(tableHtml.includes('handleBookingSwitchToggle'), 'Switch input must trigger handleBookingSwitchToggle');
assert(tableHtml.includes('Start Booking'), 'Unstarted duty must display "Start Booking" switch label');
console.log('✔ Test 2.1: Unstarted booking renders Start Booking switch control.');

// Verify active duty switch
assert(tableHtml.includes('bk-switch-control active'), 'Started duty must have .bk-switch-control.active');
assert(tableHtml.includes('Close Booking'), 'Started duty must display "Close Booking" switch label');
console.log('✔ Test 2.2: Active trip renders Close Booking switch control in ON position.');

// Verify closed duty row has NO direct invoice generator button but has "Ended → In Billing"
assert(tableHtml.includes('btn-ended-in-billing'), 'Closed duty row must render Ended → In Billing badge/button');
assert(tableHtml.includes('jumpToBilling'), 'Ended → In Billing button must call jumpToBilling()');
assert(!tableHtml.includes('generateInvoice('), 'Booking chart row must NOT have direct generateInvoice() call');
console.log('✔ Test 2.3: Closed duty row cleanly hands off with "Ended → In Billing" badge instead of direct invoice button.');

// 2.4 Billing Stage Identification
const stagePending = sandbox.getBillingStage({ dutyClosed: true, isInvoiced: false, isPaid: false });
assert.strictEqual(stagePending, 'PENDING', 'Closed duty awaiting invoice must be PENDING (Ready to Bill)');

const stageInvoiced = sandbox.getBillingStage({ dutyClosed: true, isInvoiced: true, isPaid: false, paymentStatus: 'INVOICED' });
assert.strictEqual(stageInvoiced, 'INVOICED', 'Invoiced duty awaiting payment must be INVOICED');

const stagePaid = sandbox.getBillingStage({ dutyClosed: true, isInvoiced: true, isPaid: true, paymentStatus: 'PAID' });
assert.strictEqual(stagePaid, 'PAID', 'Settled booking must be PAID');
console.log('✔ Test 2.4: Billing stages (PENDING, INVOICED, PAID) correctly identified.');

// 2.5 Live Counter Badge on Billing Tab
sandbox.updateBillingSidebarBadge();
// With testBookings: bk_closed_3 is closed and unpaid, so badge should be 1
assert(mockElements.countBadgeBilling.textContent === '1' || mockElements.countBadgeBilling.textContent === 1, 'Billing badge counter should reflect unpaid closed bookings');
console.log('✔ Test 2.5: Live counter badge on Billing tab accurately calculates pending items.');

// =========================================================================
// 3. Billing Workflow: Same-Number Tax Invoice & Calculation Parity
// =========================================================================

// Test Same-State CGST+SGST Calculation (TCS / Infosys in Maharashtra)
const bookingSameState = {
    _id: 'bk_calc_1',
    bookingNo: '73420',
    dutySlipNo: '73420',
    clientName: 'Tata Consultancy Services (TCS)',
    location: 'Pune',
    vehicleType: 'Sedan A/C',
    packageType: '8 Hrs / 80 Km',
    dutyCloseReadings: {
        totalKms: 125, // 80 base + 45 extra @ 17 = 765
        totalHours: 10.5, // 8 base + 2.5 extra -> rounded to 3 hrs @ 190 = 570
        driverAllowance: 250,
        lateNightCharges: 0,
        permitCharges: 0,
        fuelSurcharge: 75.25,
        tollCharges: 140,
        parkingCharges: 100,
        guestSignatureConfirmed: true
    }
};

const invSame = sandbox.calculateInvoiceForBookingClient(bookingSameState);
// Invoice Number Parity: EXACT SAME as Duty Slip / Booking No
assert.strictEqual(invSame.invoiceNo, '73420', 'Invoice number MUST match duty slip / booking number exactly');
assert.strictEqual(invSame.isSameState, true, 'Intra-state booking must be marked isSameState: true');
assert.strictEqual(invSame.cgstRate, 2.5, 'Intra-state must charge 2.5% CGST');
assert.strictEqual(invSame.sgstRate, 2.5, 'Intra-state must charge 2.5% SGST');
assert.strictEqual(invSame.igstRate, 0, 'Intra-state must charge 0% IGST');
// Base: 2150, Extra Km: 765, Extra Hr: 570, DA: 250, Fuel: 75.25, Toll/Park: 240
// Taxable: 2150 + 765 + 570 + 250 + 75.25 + 240 = 4050.25
assert.strictEqual(invSame.taxableAmount, 4050.25, 'Taxable amount calculation matches rate card');
// CGST 2.5% of 4050.25 = 101.26, SGST = 101.26, Grand Total = 4050.25 + 202.52 = 4252.77 -> rounded 4253
assert.strictEqual(invSame.grandTotal, 4253, 'Grand total rounded to nearest rupee must be 4253');
assert(invSame.amountInWords.includes('Four Thousand Two Hundred Fifty Three'), 'Amount in words must correctly state Rs 4,253');
console.log('✔ Test 3.1: Intra-state same-number invoice generated (same number: 73420, CGST+SGST, rounded to ₹4,253).');

// Test Inter-State IGST Calculation (Wipro Karnataka Corporate in Pune)
const bookingInterState = {
    _id: 'bk_calc_2',
    bookingNo: '73429',
    dutySlipNo: '73429',
    clientName: 'Wipro Technologies (Karnataka Corporate)',
    location: 'Pune',
    vehicleType: 'SUV / Innova',
    packageType: '8 Hrs / 80 Km',
    dutyCloseReadings: {
        totalKms: 80,
        totalHours: 8,
        driverAllowance: 300,
        lateNightCharges: 0,
        permitCharges: 0,
        fuelSurcharge: 0,
        tollCharges: 0,
        parkingCharges: 0,
        guestSignatureConfirmed: true
    }
};

const invInter = sandbox.calculateInvoiceForBookingClient(bookingInterState);
assert.strictEqual(invInter.invoiceNo, '73429', 'Invoice number MUST match duty slip / booking number');
assert.strictEqual(invInter.isSameState, false, 'Inter-state booking must be marked isSameState: false');
assert.strictEqual(invInter.cgstRate, 0, 'Inter-state must have 0% CGST');
assert.strictEqual(invInter.sgstRate, 0, 'Inter-state must have 0% SGST');
assert.strictEqual(invInter.igstRate, 5.0, 'Inter-state must charge 5.0% IGST');
// Base: 2800, DA: 300 = Taxable: 3100. IGST 5% of 3100 = 155. Grand Total = 3255
assert.strictEqual(invInter.taxableAmount, 3100, 'Inter-state taxable amount matches rate card');
assert.strictEqual(invInter.grandTotal, 3255, 'Inter-state grand total rounded to nearest rupee must be 3255');
console.log('✔ Test 3.2: Inter-state same-number invoice generated (same number: 73429, IGST 5%, ₹3,255).');

// =========================================================================
// 4. Test Payment Recording Workflow
// =========================================================================
const bookingToPay = {
    _id: 'bk_pay_1',
    bookingNo: '73428',
    dutySlipNo: '73428',
    status: 'DR_DUTY_CLOSE',
    dutyClosed: true,
    isInvoiced: true,
    isPaid: false,
    paymentStatus: 'INVOICED',
    clientName: 'Infosys BPM Pune',
    invoiceDetails: { invoiceNo: '73428', grandTotal: 3500 }
};

(async () => {
    sandbox.setCurrentBillingBooking(bookingToPay);
    mockElements.bsPayMode.value = 'NEFT';
    mockElements.bsPayAmount.value = '3500';
    mockElements.bsPayUtr.value = 'UTR-INFOSYS-998811';
    mockElements.bsPayDate.value = '2026-11-24';
    mockElements.bsPayNotes.value = 'Settled via NEFT bank transfer';

    await sandbox.recordBillingPayment();
    assert.strictEqual(bookingToPay.isPaid, true, 'Booking must be marked isPaid: true');
    assert.strictEqual(bookingToPay.paymentStatus, 'PAID', 'Booking paymentStatus must transition to PAID');
    assert.strictEqual(bookingToPay.paymentDetails.utr, 'UTR-INFOSYS-998811', 'Payment UTR must be stored');
    assert.strictEqual(bookingToPay.paymentDetails.mode, 'NEFT', 'Payment mode must be recorded');
    console.log('✔ Test 4: Payment recorded successfully, updating stage to PAID with audit details.');

    // =========================================================================
    // 5. Verify Backend Route Endpoints in aggregatorRoutes.js
    // =========================================================================
    const routesPath = path.join(__dirname, '../routes/aggregatorRoutes.js');
    const routesCode = fs.readFileSync(routesPath, 'utf8');

    assert(routesCode.includes("router.post('/bookings/:id/start-duty'"), 'Missing POST /bookings/:id/start-duty endpoint');
    assert(routesCode.includes("action: 'DUTY_STARTED'"), 'start-duty endpoint must log DUTY_STARTED');
    assert(routesCode.includes("router.post('/bookings/:id/close-duty'"), 'Missing POST /bookings/:id/close-duty endpoint');
    assert(routesCode.includes("action: 'DUTY_CLOSED'"), 'close-duty endpoint must log DUTY_CLOSED');
    assert(routesCode.includes("router.post('/bookings/:id/generate-invoice'"), 'Missing POST /bookings/:id/generate-invoice endpoint');
    assert(routesCode.includes("action: 'GENERATE_INVOICE'"), 'generate-invoice endpoint must log GENERATE_INVOICE');
    assert(routesCode.includes("router.post('/bookings/:id/record-payment'"), 'Missing POST /bookings/:id/record-payment endpoint');
    assert(routesCode.includes("action: 'PAYMENT_RECORDED'"), 'record-payment endpoint must log PAYMENT_RECORDED');
    console.log('✔ Test 5: Backend API endpoints and audit logging actions verified in aggregatorRoutes.js.');

    console.log('\n=========================================================================');
    console.log('ALL SPLIT DUTY CLOSURE FROM BILLING & SWITCH TESTS PASSED (100%)!');
    console.log('=========================================================================\n');
})();
