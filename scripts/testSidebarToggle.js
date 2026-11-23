const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Aggregator Full-Screen Sidebar Minimize / Toggle ---');

const html = fs.readFileSync(path.join(__dirname, '../../WingsUI/aggregator-admin.html'), 'utf8');

// 1. 3-line Toggle button in header
assert(html.includes('id="mobileToggleBtn"'), 'Must have toggle button with id mobileToggleBtn');
assert(html.includes('sidebar-toggle-btn'), 'Toggle button must have class sidebar-toggle-btn');
assert(html.includes('bi-list'), 'Toggle button must display three-line icon bi-list');
console.log('✔ Test 1: Three-line toggle button (bi-list) present in header bar.');

// 2. Inner collapse chevron button in sidebar header
assert(html.includes('id="sidebarCollapseInsideBtn"'), 'Must have inner sidebar collapse button sidebarCollapseInsideBtn');
console.log('✔ Test 2: Inner sidebar minimize button present in sidebar header.');

// 3. Mobile backdrop
assert(html.includes('id="sidebarBackdrop"'), 'Must have sidebar backdrop element');
console.log('✔ Test 3: Sidebar backdrop element present.');

// 4. CSS Rules for full screen / minimization
assert(html.includes('.app-layout.sidebar-collapsed .sidebar'), 'CSS must define .app-layout.sidebar-collapsed .sidebar');
assert(html.includes('.app-layout.sidebar-collapsed .main-wrapper'), 'CSS must define .app-layout.sidebar-collapsed .main-wrapper');
assert(html.includes('transform: translateX(-100%)'), 'Sidebar must translate out on collapse');
assert(html.includes('margin-left: 0'), 'Main wrapper must expand to margin-left: 0 when collapsed');
console.log('✔ Test 4: CSS rules for full-screen layout expansion verified.');

// 5. JavaScript toggleSidebar function logic
assert(html.includes('function toggleSidebar()'), 'Must define toggleSidebar function');
assert(html.includes('appLayout.classList.toggle(\'sidebar-collapsed\')'), 'toggleSidebar must toggle sidebar-collapsed class');
assert(html.includes('localStorage.setItem(\'aggregator_sidebar_collapsed\''), 'toggleSidebar must persist full-screen preference');
console.log('✔ Test 5: toggleSidebar logic and persistence verified.');

console.log('\n========================================================');
console.log('ALL SIDEBAR MINIMIZE & FULL SCREEN TESTS PASSED (100%)!');
console.log('========================================================');
