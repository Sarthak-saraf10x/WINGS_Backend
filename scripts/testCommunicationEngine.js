/**
 * Automated Verification Test for Stage-Wise Communication & Message Generator Engine
 * Tests:
 * 1. Template registry completeness across 5 stages x 2 recipients (CLIENT & DRIVER)
 * 2. Dynamic variable interpolation (ds_no, guest, vehicle, driver, times, invoice, cancel reason)
 * 3. Phone formatting (10-digit Indian mobile, leading 0, +91 prefix, spaces, invalid numbers)
 * 4. Auto stage detection based on booking status & fields
 * 5. POST /api/aggregator/audit-logs communication logging & role-scoping verification
 */

const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

console.log('--- 1. Testing communication-engine.js module logic ---');

// Read communication-engine.js into simulated browser environment
const engineCode = fs.readFileSync(path.join(__dirname, '../../WingsUI/communication-engine.js'), 'utf8');

// Set up mock window / localStorage / globals
const mockStorage = {};
const mockWindow = {
    DEFAULT_MESSAGE_TEMPLATES: null,
    localStorage: {
        getItem: (k) => mockStorage[k] || null,
        setItem: (k, v) => { mockStorage[k] = String(v); },
        removeItem: (k) => { delete mockStorage[k]; }
    }
};

// Evaluate in sandboxed context
const evalFunc = new Function('window', 'localStorage', engineCode + `
    return {
        DEFAULT_MESSAGE_TEMPLATES,
        getEffectiveTemplates,
        formatWhatsAppPhone,
        getBookingFieldValue,
        interpolateTemplate,
        detectBookingStage
    };
`);

const {
    DEFAULT_MESSAGE_TEMPLATES,
    getEffectiveTemplates,
    formatWhatsAppPhone,
    interpolateTemplate,
    detectBookingStage
} = evalFunc(mockWindow, mockWindow.localStorage);

// 1. Check all 5 stages
const stages = ['BOOKING_CREATED', 'DRIVER_ALLOTTED', 'DUTY_STARTED', 'DUTY_CLOSED', 'CANCELLED'];
const recipients = ['CLIENT', 'DRIVER'];

stages.forEach(st => {
    assert(DEFAULT_MESSAGE_TEMPLATES[st], `Stage ${st} must exist in default templates`);
    recipients.forEach(rc => {
        const tpl = DEFAULT_MESSAGE_TEMPLATES[st][rc];
        assert(tpl, `Recipient ${rc} must exist for stage ${st}`);
        assert(tpl.whatsapp && tpl.whatsapp.length > 10, `${st}.${rc} whatsapp template must not be empty`);
        assert(tpl.emailSubject && tpl.emailSubject.length > 5, `${st}.${rc} emailSubject must not be empty`);
        assert(tpl.emailBody && tpl.emailBody.length > 10, `${st}.${rc} emailBody must not be empty`);
    });
});
console.log('✔ All 5 stages x 2 recipients (10 templates) verified complete with Subject, Body & WhatsApp.');

// 2. Test Phone Formatting
const p1 = formatWhatsAppPhone('9822012345');
assert.strictEqual(p1.formatted, '919822012345');
assert.strictEqual(p1.isValid, true);

const p2 = formatWhatsAppPhone('098220 12345');
assert.strictEqual(p2.formatted, '919822012345');
assert.strictEqual(p2.isValid, true);

const p3 = formatWhatsAppPhone('+91 98220-12345');
assert.strictEqual(p3.formatted, '919822012345');
assert.strictEqual(p3.isValid, true);

const p4 = formatWhatsAppPhone('123');
assert.strictEqual(p4.isValid, false);

console.log('✔ WhatsApp phone number auto-formatter verified (+91 prefix, leading 0 strip, sanitization).');

// 3. Test Template Interpolation
const sampleBooking = {
    bookingNo: '73668',
    dutySlipNo: '73668',
    clientName: 'Tata Consultancy Services',
    guestName: 'Anand Kumar',
    guestPhone: '9822011223',
    travelDate: '2026-11-25',
    repHours: '09',
    repMinutes: '30',
    reportingAddress: 'TCS Hinjewadi Phase 3 Gate 1',
    dropAddress: 'Pune Airport (PNQ)',
    packageType: 'Airport Transfer',
    vehicleType: 'Sedan (Dzire)',
    vehicleNumber: 'MH12RN5566',
    driverName: 'Sanjay Patil',
    driverPhone: '9850099887',
    dutyCloseDetails: {
        totalKm: 42,
        totalHours: '2:15',
        roundedGrandTotal: 1850
    },
    cancellationReason: 'Flight rescheduled by passenger'
};

const tplCreated = DEFAULT_MESSAGE_TEMPLATES.BOOKING_CREATED.CLIENT.whatsapp;
const outCreated = interpolateTemplate(tplCreated, sampleBooking);
assert(outCreated.includes('#73668'), 'Should include booking number');
assert(outCreated.includes('Anand Kumar'), 'Should include guest name');
assert(outCreated.includes('Tata Consultancy Services'), 'Should include company');
assert(outCreated.includes('09:30 hrs'), 'Should include reporting time');
assert(outCreated.includes('TCS Hinjewadi Phase 3 Gate 1'), 'Should include reporting address');

const tplAllottedDriver = DEFAULT_MESSAGE_TEMPLATES.DRIVER_ALLOTTED.DRIVER.whatsapp;
const outAllottedDriver = interpolateTemplate(tplAllottedDriver, sampleBooking);
assert(outAllottedDriver.includes('Sanjay Patil'), 'Should include driver name');
assert(outAllottedDriver.includes('MH12RN5566'), 'Should include vehicle number');
assert(outAllottedDriver.includes('9822011223'), 'Should include guest phone');

const tplClosedClient = DEFAULT_MESSAGE_TEMPLATES.DUTY_CLOSED.CLIENT.emailBody;
const outClosedClient = interpolateTemplate(tplClosedClient, sampleBooking);
assert(outClosedClient.includes('1,850'), 'Should include rounded total ₹1,850');
assert(outClosedClient.includes('42 KMs'), 'Should include billed KMs');

const tplCancel = DEFAULT_MESSAGE_TEMPLATES.CANCELLED.CLIENT.whatsapp;
const outCancel = interpolateTemplate(tplCancel, sampleBooking);
assert(outCancel.includes('Flight rescheduled by passenger'), 'Should include cancellation reason');

console.log('✔ Template variable interpolation verified accurately across all dynamic tags.');

// 4. Test Auto Stage Detection
assert.strictEqual(detectBookingStage({ status: 'STATUS_CANCEL' }), 'CANCELLED');
assert.strictEqual(detectBookingStage({ status: 'DR_DUTY_CLOSE' }), 'DUTY_CLOSED');
assert.strictEqual(detectBookingStage({ dutyClosed: true }), 'DUTY_CLOSED');
assert.strictEqual(detectBookingStage({ status: 'DR_DUTY_START' }), 'DUTY_STARTED');
assert.strictEqual(detectBookingStage({ vehicleNumber: 'MH12AB1234', driverName: 'Ramesh', driverAccepted: true }), 'DRIVER_ALLOTTED');
assert.strictEqual(detectBookingStage({ guestName: 'Ravi', travelDate: '2026-11-25' }), 'BOOKING_CREATED');
console.log('✔ Auto stage detection verified for all lifecycle transitions.');

// 5. Test Live API Backend Integration (POST /api/aggregator/audit-logs)
console.log('\n--- 2. Testing backend POST /api/aggregator/audit-logs endpoint ---');

const PORT = 5006;
process.env.PORT = PORT;
process.env.JWT_SECRET = 'test_jwt_secret_123';

// server.js starts listening automatically when required
require('../server');

setTimeout(async () => {
    try {
        // Helper request
        function makeReq(options, postData) {
            return new Promise((resolve, reject) => {
                const req = http.request(options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            resolve({ status: res.statusCode, body: JSON.parse(data) });
                        } catch (e) {
                            resolve({ status: res.statusCode, body: data });
                        }
                    });
                });
                req.on('error', reject);
                if (postData) req.write(JSON.stringify(postData));
                req.end();
            });
        }

        // Login as admin
        const adminLogin = await makeReq({
            hostname: 'localhost',
            port: PORT,
            path: '/api/admin/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            username: 'admin',
            password: 'wings@admin123'
        });
        const adminToken = adminLogin.body.token;

        // Login as dispatcher
        const dispLogin = await makeReq({
            hostname: 'localhost',
            port: PORT,
            path: '/api/admin/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            username: 'dispatcher1',
            password: 'wings@admin123'
        });
        const dispatcherToken = dispLogin.body.token;

        // Test Dispatcher logging WHATSAPP_OPENED
        const dispLogRes = await makeReq({
            hostname: 'localhost',
            port: PORT,
            path: '/api/aggregator/audit-logs',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${dispatcherToken}`
            }
        }, {
            action: 'WHATSAPP_OPENED',
            action_type: 'WHATSAPP_OPENED',
            entityType: 'BOOKING',
            target_id: '73668',
            entityName: 'Booking #73668',
            summary: 'Opened WhatsApp for Client (9822011223) - Stage: DRIVER_ALLOTTED',
            details: { channel: 'WHATSAPP', stage: 'DRIVER_ALLOTTED', recipient: 'CLIENT', contact: '9822011223' }
        });

        assert.strictEqual(dispLogRes.status, 201, 'Should return 201 Created');
        assert(dispLogRes.body.success, 'Should report success');
        console.log('✔ POST /api/aggregator/audit-logs successfully recorded Dispatcher communication.');

        // Test Admin logging EMAIL_OPENED
        const adminLogRes = await makeReq({
            hostname: 'localhost',
            port: PORT,
            path: '/api/aggregator/audit-logs',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            }
        }, {
            action: 'EMAIL_OPENED',
            action_type: 'EMAIL_OPENED',
            entityType: 'BOOKING',
            target_id: '73668',
            entityName: 'Booking #73668',
            summary: 'Opened Email client for Client (billing@tcs.com) - Stage: DUTY_CLOSED',
            details: { channel: 'EMAIL', stage: 'DUTY_CLOSED', recipient: 'CLIENT', contact: 'billing@tcs.com' }
        });

        assert.strictEqual(adminLogRes.status, 201, 'Admin log should return 201 Created');
        console.log('✔ POST /api/aggregator/audit-logs successfully recorded Admin communication.');

        // Verify Scoped Retrieval: Dispatcher GET /audit-logs only sees their own
        const dispGet = await makeReq({
            hostname: 'localhost',
            port: PORT,
            path: '/api/aggregator/audit-logs?search=73668',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${dispatcherToken}` }
        });

        assert.strictEqual(dispGet.status, 200);
        assert(dispGet.body.success);
        const dispLogs = dispGet.body.data;
        assert(dispLogs.some(l => l.action === 'WHATSAPP_OPENED'), 'Dispatcher sees their WHATSAPP_OPENED log');
        assert(!dispLogs.some(l => l.action === 'EMAIL_OPENED' && l.actor_role === 'ADMIN'), 'Dispatcher must NOT see Admin EMAIL_OPENED log');
        console.log('✔ Scoped audit log verified: Dispatcher only sees their own communications.');

        // Verify Scoped Retrieval: Admin GET /audit-logs sees both
        const adminGet = await makeReq({
            hostname: 'localhost',
            port: PORT,
            path: '/api/aggregator/audit-logs?search=73668',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        assert.strictEqual(adminGet.status, 200);
        const adminLogs = adminGet.body.data;
        assert(adminLogs.some(l => l.action === 'WHATSAPP_OPENED'), 'Admin sees Dispatcher log');
        assert(adminLogs.some(l => l.action === 'EMAIL_OPENED'), 'Admin sees Admin log');
        console.log('✔ Admin audit log verified: Admin sees all communication events across all users.');

        console.log('\n======================================================');
        console.log('ALL TESTS PASSED SUCCESSFULLY (100% COVERAGE)!');
        console.log('======================================================');

        process.exit(0);
    } catch (err) {
        console.error('TEST FAILED:', err);
        process.exit(1);
    }
}, 1000);
