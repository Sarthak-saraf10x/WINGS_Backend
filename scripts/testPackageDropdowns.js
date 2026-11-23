const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Package Type Dropdowns in Booking Sheet ---');

const html = fs.readFileSync(path.join(__dirname, '../../WingsUI/aggregator-admin.html'), 'utf8');

const requiredPackages = [
    'Local 4hr/40Km',
    'Local 8hr/80km',
    'Transfer - S',
    'Transfer - L',
    'AIRPORT P/D - S',
    'AIRPORT P/D - L',
    'OUTSTATION'
];

// 1. Verify sheetPackageType (Corporate Client & Booking Info) is a select with all 7 options
assert(html.includes('<select id="sheetPackageType"'), 'sheetPackageType must be a <select> element');
const packageTypeMatch = html.match(/<select id="sheetPackageType"[\s\S]*?<\/select>/);
assert(packageTypeMatch, 'sheetPackageType select block must be found');
const packageTypeHtml = packageTypeMatch[0];

requiredPackages.forEach(pkg => {
    assert(packageTypeHtml.includes(`value="${pkg}"`), `sheetPackageType must contain option "${pkg}"`);
});
console.log('✔ Test 1: Corporate Client Package Type (sheetPackageType) has all 7 requested dropdown options.');

// 2. Verify sheetVendorPackage (Driver & Fleet Info) is a select with all 7 options
assert(html.includes('<select id="sheetVendorPackage"'), 'sheetVendorPackage must be a <select> element');
const vendorPackageMatch = html.match(/<select id="sheetVendorPackage"[\s\S]*?<\/select>/);
assert(vendorPackageMatch, 'sheetVendorPackage select block must be found');
const vendorPackageHtml = vendorPackageMatch[0];

requiredPackages.forEach(pkg => {
    assert(vendorPackageHtml.includes(`value="${pkg}"`), `sheetVendorPackage must contain option "${pkg}"`);
});
console.log('✔ Test 2: Driver / Vendor Package Type (sheetVendorPackage) has all 7 requested dropdown options.');

// 3. Test setPackageSelectValue behavior
const jsCode = fs.readFileSync(path.join(__dirname, '../../WingsUI/aggregator-bookings.js'), 'utf8');

// Mock DOM Select element
class MockOption {
    constructor(value, text) {
        this.value = value;
        this.text = text || value;
    }
}
class MockSelect {
    constructor(options = []) {
        this.options = options.map(o => new MockOption(o));
        this._selectedIndex = 0;
        this.value = this.options[0] ? this.options[0].value : '';
    }
    get selectedIndex() { return this._selectedIndex; }
    set selectedIndex(idx) {
        this._selectedIndex = idx;
        if (this.options[idx]) this.value = this.options[idx].value;
    }
    appendChild(opt) {
        this.options.push(opt);
    }
}

const mockSelectEl = new MockSelect(['', ...requiredPackages]);
const mockDocument = {
    addEventListener: () => {},
    getElementById: (id) => (id === 'sheetPackageType' ? mockSelectEl : null),
    createElement: (tag) => new MockOption(''),
    querySelectorAll: () => []
};
const mockWindow = { document: mockDocument };

const mockEval = new Function('window', 'document', jsCode + `
    return { setPackageSelectValue };
`);
const { setPackageSelectValue } = mockEval(mockWindow, mockDocument);

// Test matching option
setPackageSelectValue('sheetPackageType', 'Local 8hr/80km');
assert.strictEqual(mockSelectEl.value, 'Local 8hr/80km', 'Must select existing option');

// Test matching option case-insensitively
setPackageSelectValue('sheetPackageType', 'airport p/d - s');
assert.strictEqual(mockSelectEl.options[mockSelectEl.selectedIndex].value, 'AIRPORT P/D - S', 'Must match option case-insensitively');

// Test custom legacy option
setPackageSelectValue('sheetPackageType', 'Special Custom 12h/120km');
assert.strictEqual(mockSelectEl.value, 'Special Custom 12h/120km', 'Must create and select legacy option without data loss');
console.log('✔ Test 3: setPackageSelectValue selects standard options and preserves legacy values dynamically.');

console.log('\n========================================================');
console.log('ALL PACKAGE DROPDOWN TESTS PASSED PERFECTLY (100%)!');
console.log('========================================================');
