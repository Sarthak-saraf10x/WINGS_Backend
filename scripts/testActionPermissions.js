const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Stage-Gated Permissions for Close Duty & Print Duty Slip ---');

// 1. Load aggregator-bookings.js in sandboxed context
const jsCode = fs.readFileSync(path.join(__dirname, '../../WingsUI/aggregator-bookings.js'), 'utf8');

let lastToast = null;
const mockToast = (msg, type) => {
    lastToast = { msg, type };
};

let openedModal = null;
const mockOpenModal = (modalId) => {
    openedModal = modalId;
};

const mockElements = {
    bookingDetailModal: { classList: { contains: () => false } },
    dcModalTitle: { innerHTML: '' },
    dcBookingNoDisplay: { textContent: '' },
    dcTargetInvoiceNoDisplay: { textContent: '' },
    dcClientDisplay: { textContent: '' },
    dcGuestDisplay: { textContent: '' },
    dcVehicleDisplay: { textContent: '' },
    dcDriverDisplay: { textContent: '' },
    dcGarageOutKm: { value: '' },
    dcGarageOutTime: { value: '' },
    dcReportingKm: { value: '' },
    dcReportingTime: { value: '' },
    dcReleasingKm: { value: '' },
    dcReleasingTime: { value: '' },
    dcGarageInKm: { value: '' },
    dcGarageInTime: { value: '' },
    dcTotalKms: { value: '' },
    dcTotalHours: { value: '' },
    dcTotalDays: { value: '' },
    dcTotalNights: { value: '' },
    dcDriverAllowance: { value: '' },
    dcLateNight: { value: '' },
    dcPermit: { value: '' },
    dcFuelSurcharge: { value: '' },
    dcToll: { value: '' },
    dcParking: { value: '' },
    dcGuestSignConfirmed: { checked: false },
    dcUploadedFileStatus: { innerHTML: '' },
    generatedInvoiceContainer: { style: { display: '' } },
    btnSubmitCloseDuty: { style: { display: '' }, disabled: false },
    dutySlipPrintArea: { innerHTML: '' },
    dsPreviewNoBadge: { textContent: '' },
    sheetBtnPrintDutySlip: { style: {}, title: '' }
};

const mockDocument = {
    addEventListener: () => {},
    getElementById: (id) => mockElements[id] || null,
    querySelectorAll: () => []
};

const mockWindow = {
    document: mockDocument
};

const evalFn = new Function('window', 'document', 'showToast', 'openModal', jsCode + `
    return {
        canPrintDutySlipBooking,
        canCloseDutyBooking,
        computeBookingStatusClient,
        openDutyCloseModal,
        openPrintDutySlipModal,
        submitCloseDutyAndGenerateInvoice,
        setBookingsList: (list) => { bookingsList = list; },
        setCurrentDutyCloseBooking: (b) => { currentDutyCloseBooking = b; }
    };
`);

const {
    canPrintDutySlipBooking,
    canCloseDutyBooking,
    computeBookingStatusClient,
    openDutyCloseModal,
    openPrintDutySlipModal,
    submitCloseDutyAndGenerateInvoice,
    setBookingsList,
    setCurrentDutyCloseBooking
} = evalFn(mockWindow, mockDocument, mockToast, mockOpenModal);

// Sample Bookings for Each Stage
const bkNoTiming = {
    _id: 'bk_1',
    bookingNo: '101',
    dutySlipNo: '101',
    clientName: 'TCS',
    travelDate: '2026-11-25',
    repHours: '',
    reqTime: '',
    guestName: 'Anand',
    vehicleType: 'Sedan',
    packageType: 'Local 8hr/80km'
};

const bkStatusNo = {
    _id: 'bk_2',
    bookingNo: '102',
    dutySlipNo: '102',
    clientName: 'Infosys',
    travelDate: '2026-11-25',
    repHours: '09',
    repMinutes: '00',
    reqTime: '09:00',
    guestName: 'Rahul',
    vehicleType: 'Sedan',
    packageType: 'Local 8hr/80km',
    vendorName: '', // Unplotted
    vehicleNumber: '',
    driverName: ''
};

const bkStatusYes = {
    _id: 'bk_3',
    bookingNo: '103',
    dutySlipNo: '103',
    clientName: 'Wipro',
    travelDate: '2026-11-25',
    repHours: '09',
    repMinutes: '00',
    reqTime: '09:00',
    guestName: 'Priya',
    vehicleType: 'Sedan',
    packageType: 'Local 8hr/80km',
    vendorName: 'Wings Fleet',
    vehicleNumber: 'MH12 AB 1234',
    driverName: 'Ramesh',
    driverAccepted: false // Waiting for acceptance
};

const bkDriverAccepted = {
    _id: 'bk_4',
    bookingNo: '104',
    dutySlipNo: '104',
    clientName: 'Wipro',
    travelDate: '2026-11-25',
    repHours: '09',
    repMinutes: '00',
    reqTime: '09:00',
    guestName: 'Priya',
    vehicleType: 'Sedan',
    packageType: 'Local 8hr/80km',
    vendorName: 'Wings Fleet',
    vehicleNumber: 'MH12 AB 1234',
    driverName: 'Ramesh',
    driverAccepted: true,
    dutyStarted: false
};

const bkDutyStarted = {
    _id: 'bk_5',
    bookingNo: '105',
    dutySlipNo: '105',
    clientName: 'Wipro',
    travelDate: '2026-11-25',
    repHours: '09',
    repMinutes: '00',
    reqTime: '09:00',
    guestName: 'Priya',
    vehicleType: 'Sedan',
    packageType: 'Local 8hr/80km',
    vendorName: 'Wings Fleet',
    vehicleNumber: 'MH12 AB 1234',
    driverName: 'Ramesh',
    driverAccepted: true,
    dutyStarted: true
};

const bkDutyClosed = {
    _id: 'bk_6',
    bookingNo: '106',
    dutySlipNo: '106',
    clientName: 'Wipro',
    travelDate: '2026-11-25',
    repHours: '09',
    guestName: 'Priya',
    dutyStarted: true,
    dutyClosed: true,
    isInvoiced: true
};

setBookingsList([bkNoTiming, bkStatusNo, bkStatusYes, bkDriverAccepted, bkDutyStarted, bkDutyClosed]);

// --- TEST 1: Status verification ---
assert.strictEqual(computeBookingStatusClient(bkNoTiming), 'NO_TIMING');
assert.strictEqual(computeBookingStatusClient(bkStatusNo), 'STATUS_NO');
assert.strictEqual(computeBookingStatusClient(bkStatusYes), 'STATUS_YES');
assert.strictEqual(computeBookingStatusClient(bkDriverAccepted), 'DR_DUTY_ACCPT');
assert.strictEqual(computeBookingStatusClient(bkDutyStarted), 'DR_DUTY_START');
assert.strictEqual(computeBookingStatusClient(bkDutyClosed), 'DR_DUTY_CLOSE');
console.log('✔ Test 1: Booking statuses auto-derived correctly across all stages.');

// --- TEST 2: Close Duty & Generate Invoice Permission Rule ---
// Rule: Applicable ONLY when booking status is DR Duty Started (or already closed/invoiced)
assert.strictEqual(canCloseDutyBooking(bkNoTiming), false, 'NO_TIMING cannot close duty');
assert.strictEqual(canCloseDutyBooking(bkStatusNo), false, 'STATUS_NO cannot close duty');
assert.strictEqual(canCloseDutyBooking(bkStatusYes), false, 'STATUS_YES cannot close duty');
assert.strictEqual(canCloseDutyBooking(bkDriverAccepted), false, 'DR_DUTY_ACCPT cannot close duty before duty starts');
assert.strictEqual(canCloseDutyBooking(bkDutyStarted), true, 'DR_DUTY_START CAN close duty & generate invoice');
assert.strictEqual(canCloseDutyBooking(bkDutyClosed), true, 'DR_DUTY_CLOSE can view closed duty & invoice');
console.log('✔ Test 2: canCloseDutyBooking allows action ONLY on DR_DUTY_START (and closed records).');

// --- TEST 3: openDutyCloseModal blocks when not DR Duty Started ---
openedModal = null;
lastToast = null;
openDutyCloseModal('bk_1'); // Try closing bkNoTiming
assert.strictEqual(openedModal, null, 'Modal must NOT open for NO_TIMING booking');
assert(lastToast && lastToast.type === 'warning', 'Warning toast must be shown');
assert(lastToast.msg.includes('DR Duty Started'), 'Toast must explain DR Duty Started is required');
console.log('✔ Test 3: openDutyCloseModal successfully blocks NO_TIMING and informs dispatcher via toast.');

// --- TEST 4: openDutyCloseModal succeeds when DR Duty Started ---
openedModal = null;
lastToast = null;
openDutyCloseModal('bk_5'); // bkDutyStarted
assert.strictEqual(openedModal, 'dutyCloseModal', 'Modal must open for DR_DUTY_START booking');
console.log('✔ Test 4: openDutyCloseModal opens cleanly when booking is DR_DUTY_START.');

// --- TEST 5: submitCloseDutyAndGenerateInvoice blocks when duty not started ---
setCurrentDutyCloseBooking(bkNoTiming);
lastToast = null;
submitCloseDutyAndGenerateInvoice();
assert(lastToast && lastToast.type === 'error', 'Must display error toast preventing close');
assert(lastToast.msg.includes('DR Duty Started'), 'Error toast must mention DR Duty Started requirement');
console.log('✔ Test 5: submitCloseDutyAndGenerateInvoice blocks submission if duty not started.');

// --- TEST 6: Print Duty Slip Permission Rule ---
// Rule: Applicable ONLY after Driver Accepted Duty (DR_DUTY_ACCPT, DR_DUTY_START, DR_DUTY_CLOSE)
assert.strictEqual(canPrintDutySlipBooking(bkNoTiming), false, 'NO_TIMING cannot print duty slip');
assert.strictEqual(canPrintDutySlipBooking(bkStatusNo), false, 'STATUS_NO cannot print duty slip');
assert.strictEqual(canPrintDutySlipBooking(bkStatusYes), false, 'STATUS_YES cannot print duty slip before driver accepts');
assert.strictEqual(canPrintDutySlipBooking(bkDriverAccepted), true, 'DR_DUTY_ACCPT CAN print duty slip');
assert.strictEqual(canPrintDutySlipBooking(bkDutyStarted), true, 'DR_DUTY_START CAN print duty slip');
assert.strictEqual(canPrintDutySlipBooking(bkDutyClosed), true, 'DR_DUTY_CLOSE CAN print duty slip');
console.log('✔ Test 6: canPrintDutySlipBooking allows printing ONLY when status is Driver Accepted Duty or later.');

// --- TEST 7: openPrintDutySlipModal blocks when driver has not accepted duty ---
openedModal = null;
lastToast = null;
openPrintDutySlipModal('bk_3'); // bkStatusYes (Driver not accepted)
assert.strictEqual(openedModal, null, 'Print modal must NOT open before driver acceptance');
assert(lastToast && lastToast.type === 'warning', 'Warning toast must be shown');
assert(lastToast.msg.includes('Driver Accepted Duty'), 'Toast must state Driver Accepted Duty is required');
console.log('✔ Test 7: openPrintDutySlipModal blocks unaccepted bookings and informs dispatcher via toast.');

// --- TEST 8: openPrintDutySlipModal succeeds after driver accepts duty ---
openedModal = null;
lastToast = null;
openPrintDutySlipModal('bk_4'); // bkDriverAccepted
assert.strictEqual(openedModal, 'dutySlipPreviewModal', 'Print modal must open once driver accepts duty');
console.log('✔ Test 8: openPrintDutySlipModal opens cleanly for Driver Accepted Duty.');

// --- TEST 9: Backend close-duty status protection in aggregatorRoutes.js ---
const backendRoutesCode = fs.readFileSync(path.join(__dirname, '../routes/aggregatorRoutes.js'), 'utf8');
assert(backendRoutesCode.includes('currentStatus !== \'DR_DUTY_START\''), 'Backend must check for DR_DUTY_START status');
assert(backendRoutesCode.includes('Close Duty & Generate Invoice is only applicable when booking status is "DR Duty Started"'), 'Backend must return standard error message');
console.log('✔ Test 9: Backend /close-duty route guard verified in aggregatorRoutes.js.');

console.log('\n========================================================');
console.log('ALL ACTION PERMISSIONS & STAGE-GATING TESTS PASSED (100%)!');
console.log('========================================================');
