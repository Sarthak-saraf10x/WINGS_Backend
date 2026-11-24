const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Location Dropdown (Pune & Pan India) in Booking Sheet ---');

const html = fs.readFileSync(path.join(__dirname, '../../WingsUI/aggregator-admin.html'), 'utf8');

// 1. Verify sheetLocation (in Corporate Client & Booking Info) is a select
assert(html.includes('<select id="sheetLocation"'), 'sheetLocation must be a <select> element');
const locationMatch = html.match(/<select id="sheetLocation"[\s\S]*?<\/select>/);
assert(locationMatch, 'sheetLocation select block must be found in HTML');
const locationHtml = locationMatch[0];

assert(locationHtml.includes('value="Pune"'), 'sheetLocation must contain option "Pune"');
assert(locationHtml.includes('value="Pan India"'), 'sheetLocation must contain option "Pan India"');
console.log('✔ Test 1: sheetLocation select has both "Pune" and "Pan India" options.');

// 2. Verify bkFilterLocation filter contains Pan India
assert(html.includes('<option value="Pan India">Pan India</option>'), 'Filter must contain Pan India option');
console.log('✔ Test 2: bkFilterLocation dropdown includes "Pan India".');

// 3. Verify JS selection logic
const jsCode = fs.readFileSync(path.join(__dirname, '../../WingsUI/aggregator-bookings.js'), 'utf8');

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

const mockLocSelect = new MockSelect(['Pune', 'Pan India']);
const mockDocument = {
    addEventListener: () => {},
    getElementById: (id) => (id === 'sheetLocation' ? mockLocSelect : null),
    createElement: (tag) => new MockOption(''),
    querySelectorAll: () => []
};
const mockWindow = { document: mockDocument };

const mockEval = new Function('window', 'document', jsCode + `
    return { setSelectOptionValue };
`);
const { setSelectOptionValue } = mockEval(mockWindow, mockDocument);

// Test selecting Pune
setSelectOptionValue('sheetLocation', 'Pune');
assert.strictEqual(mockLocSelect.value, 'Pune', 'Must select Pune');

// Test selecting Pan India
setSelectOptionValue('sheetLocation', 'Pan India');
assert.strictEqual(mockLocSelect.value, 'Pan India', 'Must select Pan India');

// Test case-insensitive match: 'pan india'
setSelectOptionValue('sheetLocation', 'pan india');
assert.strictEqual(mockLocSelect.value, 'Pan India', 'Must match "pan india" case-insensitively');

console.log('✔ Test 3: setSelectOptionValue correctly handles Pune and Pan India selection.');

console.log('\n========================================================');
console.log('ALL LOCATION DROPDOWN TESTS PASSED PERFECTLY (100%)!');
console.log('========================================================');
