import * as api from './api.js';
import './permissions.js';
import './crud.js';
import './auto_deduct.js';
import './result_entry.js';
import './result_report.js';
import './audit.js';
import './patients.js';
import './ops.js';

console.log('[app] src/app.js loaded');
const APP_VERSION_MARKER = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : `dev-${new Date().toISOString()}`;
console.log('[APP VERSION]', APP_VERSION_MARKER);

let selectedTests = [];
let recentOrders = [];
let editingOrderId = null;
let editingOrderStatus = 'Pending';
let dashboardState = { orders: [], testRows: [], summary: [], timeSlotMode: 'all' };
const dashboardCharts = {};
const Pages = { active: 'dashboard', setupTab: 'tests' };
const appCache = window.__lisCache || (window.__lisCache = {});
if (!Array.isArray(appCache.settings)) appCache.settings = [];

window.invalidateDropdownCache = function() {
    appCache.settings = [];
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatPrice(value) {
    const amount = Math.abs(Math.round(Number(value) || 0));
    return amount.toLocaleString();
}

function formatFileSize(bytes) {
    const size = Number(bytes) || 0;
    if (size >= 1024 * 1024 * 1024) return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${size} B`;
}

function toDateTimeLocal(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function setSelectValue(id, value) {
    const select = document.getElementById(id);
    if (!select || value == null || value === '') return;
    const text = String(value);
    const exists = Array.from(select.options).some(option => option.value === text);
    if (!exists) select.add(new Option(text, text));
    select.value = text;
}

const ORDER_FILE_CACHE = {};

async function getOrderFilesFromServer(orderId) {
    if (ORDER_FILE_CACHE[orderId]) return ORDER_FILE_CACHE[orderId];
    const res = await api.getOrderFiles(orderId);
    const files = res.success ? (res.data || []) : [];
    ORDER_FILE_CACHE[orderId] = files;
    return files;
}

function invalidateFileCache(orderId) {
    delete ORDER_FILE_CACHE[orderId];
}

function numericKip(value) {
    return Math.abs(Math.round(Number(value) || 0));
}

function formatKip(value) {
    const amount = Math.abs(Math.round(Number(value) || 0));
    return `₭ ${amount.toLocaleString()}`;
}

function formatDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? escapeHtml(value) : d.toLocaleString();
}

function statusBadge(status) {
    const normalized = String(status || 'Pending');
    const color = normalized.toLowerCase() === 'completed' ? 'success'
        : normalized.toLowerCase() === 'cancelled' ? 'danger'
        : normalized.toLowerCase() === 'processing' ? 'primary'
        : 'secondary';
    return `<span class="badge bg-${color}">${escapeHtml(normalized)}</span>`;
}

function orderDateValue(order) {
    return Date.parse(order?.order_datetime || order?.created_at || '') || 0;
}

function showAuthenticatedApp(user) {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    const sidebar = document.getElementById('sidebar');
    const content = document.querySelector('#mainApp .content');
    const dashboard = document.getElementById('dashboard');
    const displayRole = document.getElementById('displayRole');

    if (loginScreen) {
        loginScreen.classList.add('auth-hidden');
        loginScreen.setAttribute('aria-hidden', 'true');
        loginScreen.style.setProperty('display', 'none', 'important');
        loginScreen.style.setProperty('visibility', 'hidden', 'important');
        loginScreen.style.setProperty('pointer-events', 'none', 'important');
        loginScreen.style.setProperty('opacity', '0', 'important');
        loginScreen.style.setProperty('z-index', '-1', 'important');
    }

    document.body.classList.add('lis-authenticated');

    if (mainApp) {
        mainApp.classList.add('auth-visible');
        mainApp.classList.remove('d-none', 'hidden');
        mainApp.removeAttribute('hidden');
        mainApp.removeAttribute('aria-hidden');
        mainApp.style.setProperty('display', 'flex', 'important');
        mainApp.style.setProperty('visibility', 'visible', 'important');
        mainApp.style.setProperty('opacity', '1', 'important');
        mainApp.style.setProperty('pointer-events', 'auto', 'important');
        mainApp.style.setProperty('z-index', '10000', 'important');
    }

    if (sidebar) {
        sidebar.classList.remove('d-none', 'hidden');
        sidebar.removeAttribute('hidden');
        sidebar.style.removeProperty('display');
        sidebar.style.removeProperty('visibility');
        sidebar.style.removeProperty('opacity');
    }
    if (content) {
        content.classList.remove('d-none', 'hidden');
        content.removeAttribute('hidden');
        content.style.removeProperty('display');
        content.style.removeProperty('visibility');
        content.style.removeProperty('opacity');
    }
    if (dashboard) {
        dashboard.classList.remove('d-none', 'hidden');
        dashboard.removeAttribute('hidden');
        dashboard.classList.add('active');
    }
    if (displayRole) displayRole.innerText = (user.username || 'User') + ' (' + (user.role || 'Admin') + ')';

    document.querySelectorAll('#loginForm, .login-box, .login-card, .auth-card').forEach((el) => {
        el.classList.add('auth-hidden');
        el.setAttribute('aria-hidden', 'true');
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('z-index', '-1', 'important');
    });
}

async function bootApp(user) {
    showAuthenticatedApp(user);
    setTimeout(() => {
        if (typeof window.applyRolePermissions === 'function') window.applyRolePermissions();
        loadInitialDataLazy();
    }, 10);
    
    // AUTO SCREENSHOT FOR VERIFICATION
    setTimeout(takeAutoVerificationScreenshot, 3000);
}

window.handleAuthExpired = function(message = 'Session ໝົດອາຍຸ. ກະລຸນາ login ໃໝ່.') {
    sessionStorage.removeItem('lis_user');
    if (typeof window.performLogout === 'function') window.performLogout();
    const errDiv = document.getElementById('loginError');
    if (errDiv) {
        errDiv.textContent = message;
        errDiv.style.display = 'block';
    }
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'warning',
            title: 'Authentication required',
            text: message,
            confirmButtonText: 'OK'
        });
    }
};

async function takeAutoVerificationScreenshot() {
    if (typeof html2canvas === 'undefined') {
        console.warn('[test] html2canvas not loaded, skipping screenshot');
        return;
    }
    console.log('[test] Taking verification screenshot...');
    try {
        const canvas = await html2canvas(document.body, {
            scale: 1,
            useCORS: true,
            logging: false
        });
        const image = canvas.toDataURL('image/png');
        await fetch('/api/report-screenshot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image })
        });
        console.log('[test] Screenshot reported to server');
    } catch (e) {
        console.error('[test] Screenshot failed', e);
    }
}

async function loadInitialDataLazy() {
    console.log('[bootApp] lazy loading data...');
    loadDashboard().catch(e => console.warn('[bootApp] loadDashboard failed', e));
}

async function populateDropdowns(force = false) {
    if (!force && appCache.settings && appCache.settings.length > 0) {
        renderDropdownsFromCache(appCache.settings);
        return;
    }
    try {
        const settings = await api.getSettings();
        appCache.settings = settings;
        renderDropdownsFromCache(settings);
    } catch (e) {
        console.warn('[dropdowns] Dropdown loading failed', e);
    }
}

function renderDropdownsFromCache(settings) {
    const dropdownMap = {
        'visitType': 'VisitType',
        'insite': 'Insite',
        'doctor': 'Doctor',
        'department': 'Department',
        'sender': 'Sender',
        'labDest': 'LabDest'
    };

    Object.entries(dropdownMap).forEach(([id, type]) => {
        const select = document.getElementById(id);
        if (select) {
            const options = settings.filter(s => s.type === type);
            const firstOpt = select.options[0];
            select.innerHTML = '';
            if (firstOpt) select.appendChild(firstOpt);
            else select.innerHTML = '<option value="" selected disabled>-- ເລືອກ --</option>';
            
            options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt.value;
                o.textContent = opt.value;
                select.appendChild(o);
            });
        }
    });
}

window.onerror = (m,s,l,c,e) => console.error('[GLOBAL ERROR]', {m,s,l,c,e});
window.onunhandledrejection = (e) => console.error('[PROMISE REJECTION]', e);

async function handleLoginSubmit(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const u = document.getElementById('loginUser')?.value?.trim();
    const p = document.getElementById('loginPass')?.value;
    const btn = document.getElementById('btnLogin');
    const errDiv = document.getElementById('loginError');

    if (!u || !p) {
        if (errDiv) { errDiv.textContent = 'ກະລຸນາປ້ອນ Username ແລະ Password'; errDiv.style.display = 'block'; }
        return;
    }

    if (errDiv) errDiv.style.display = 'none';
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Logging in...'; }

    try {
        const res = await api.loginUser(u, p);

        if (res && res.success) {
            // Store user session
            sessionStorage.setItem('lis_user', JSON.stringify({
                id: res.id,
                username: res.username || u,
                role: res.role || 'admin',
                token: res.token
            }));

            // Show real app
            bootApp({
                id: res.id,
                username: res.username || u,
                role: res.role || 'admin',
                token: res.token
            });
        } else {
            console.warn('Login Rejected');
            if (errDiv) { errDiv.textContent = res?.message || 'Login failed'; errDiv.style.display = 'block'; }
        }
    } catch (e) {
        console.error('Login Crash', e);
        if (errDiv) { errDiv.textContent = 'Error: ' + e.message; errDiv.style.display = 'block'; }
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i> ເຂົ້າສູ່ລະບົບ (Login)'; }
    }
}

window.performLogin = handleLoginSubmit;

function bindLoginEvents() {
    const form = document.getElementById('loginForm');
    const btnLogin = document.getElementById('btnLogin');
    const loginBtn = document.getElementById('loginBtn');
    const passInput = document.getElementById('loginPass');

    if (form && !form.dataset.loginBound) {
        form.addEventListener('submit', handleLoginSubmit);
        form.dataset.loginBound = 'true';
        console.log('[login] form submit listener bound');
    }

    [btnLogin, loginBtn].filter(Boolean).forEach((btn) => {
        if (!btn.dataset.loginBound) {
            btn.type = 'button';
            btn.addEventListener('click', handleLoginSubmit);
            btn.dataset.loginBound = 'true';
            console.log('[login] button click listener bound:', btn.id);
        }
    });

    if (passInput && !passInput.dataset.loginEnterBound) {
        passInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') handleLoginSubmit(event);
        });
        passInput.dataset.loginEnterBound = 'true';
        console.log('[login] password enter listener bound');
    }
}

window.showPage = (e, id) => {
    if (e) e.preventDefault();
    const requestedId = id;
    const pageId = id === 'setupPage' ? 'testSetup' : id;
    const target = document.getElementById(pageId);
    if (!target) {
        console.warn('[showPage] target page not found:', requestedId);
        return;
    }
    Pages.active = pageId;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    target.classList.add('active');
    
    document.querySelectorAll('.nav-link').forEach(l => {
       const onClick = l.getAttribute('onclick') || '';
       if(onClick.includes(pageId) || onClick.includes(requestedId)) l.classList.add('active');
    });

    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar')?.classList.remove('mobile-open');
        document.querySelector('.sidebar-overlay')?.classList.remove('active');
    }

    // Lazy load specific page data - only when navigating to that page
    if(pageId === 'dashboard') loadDashboard().catch(e => console.warn('[showPage] dashboard load failed', e));
    if(pageId === 'testSetup') {
        window.loadSettings?.();
        window.loadTestMasterTable?.();
    }
    if(pageId === 'orderPage' || pageId === 'orderForm') {
        if (typeof window.loadTestCheckboxes === 'function') window.loadTestCheckboxes();
        populateDropdowns().catch(e => console.warn('[showPage] dropdown load failed', e));
        loadPackageSelector().catch(e => console.warn('[showPage] package load failed', e));
    }
    if(pageId === 'historyPage') loadRecentOrders().catch(e => console.warn('[showPage] history load failed', e));
    if(pageId === 'trackResult') loadRecentOrders().catch(e => console.warn('[showPage] outlab recent orders load failed', e));
    if(pageId === 'inventoryPage') {
        // Start inventory alert badge timer only when user visits inventory page
        if (typeof window.refreshInventoryAlertBadge === 'function' && !window.__lisInventoryAlertTimer) {
            window.refreshInventoryAlertBadge();
            window.__lisInventoryAlertTimer = setInterval(() => window.refreshInventoryAlertBadge(), 5 * 60 * 1000);
        }
        window.loadInventoryTable?.().then(() => {
            const active = document.querySelector('.inventory-tab-btn.active')?.dataset.inventoryTab || 'report';
            window.setInventoryTab?.(active);
        }).catch(e => console.warn('[showPage] inventory load failed', e));
    }
};

let testMasterCache = null;
let testCategoryOrder = [];
const TEST_CATEGORY_DISPLAY_ORDER = ['Hematology', 'Chemistry', 'Immunology', 'Urine and stool', 'Pathology', 'Outlab'];

function testCategoryRank(category) {
    const key = String(category || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const aliases = {
        biochemistry: 'chemistry',
        immunoserology: 'immunology',
        stoolurine: 'urineandstool',
        urinestool: 'urineandstool',
        urineandstool: 'urineandstool'
    };
    const normalized = aliases[key] || key;
    const order = TEST_CATEGORY_DISPLAY_ORDER.map(cat => cat.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const rank = order.indexOf(normalized);
    return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

function sortTestCategories(categories) {
    return [...categories].sort((a, b) => {
        const rankDiff = testCategoryRank(a) - testCategoryRank(b);
        return rankDiff || categories.indexOf(a) - categories.indexOf(b);
    });
}

window.loadTestCheckboxes = async function() {
    const container = document.getElementById('dynamicTestContainer');
    if(!container) return;
    container.innerHTML = '<div class="col-12 text-center py-4"><div class="spinner-border text-primary"></div><div class="mt-2 text-muted small">ກຳລັງໂຫຼດລາຍການກວດ...</div></div>';
    
    try {
        const t0 = performance.now();
        if (!testMasterCache) {
            testMasterCache = await api.getTestMaster();
        }
        const tests = testMasterCache;
        const loadTime = performance.now() - t0;
        if (loadTime > 2000) console.warn(`[PERF] loadTestCheckboxes fetch: ${loadTime.toFixed(0)}ms`);
        
        container.innerHTML = '';
        if(!tests || tests.length === 0) {
            container.innerHTML = '<div class="col-12 text-center text-muted">ຍັງບໍ່ມີລາຍການກວດ</div>';
            return;
        }
        
        const grouped = {};
        testCategoryOrder = [];
        tests.forEach(t => {
            const cat = t.category || 'Other';
            if(!grouped[cat]) {
                grouped[cat] = [];
                testCategoryOrder.push(cat);
            }
            grouped[cat].push(t);
        });
        
        renderTestCategory(container, grouped, sortTestCategories(testCategoryOrder));

        document.querySelectorAll('.test-checkbox').forEach(chk => {
            chk.onchange = (e) => {
                const card = e.target.closest('.test-item-card');
                if (e.target.checked) card.classList.add('bg-primary-subtle', 'border-primary');
                else card.classList.remove('bg-primary-subtle', 'border-primary');
                handleTestSelection();
            };
        });
    } catch (e) {
        console.error('Loader Error:', e);
        container.innerHTML = '<div class="alert alert-danger">Failed to load tests</div>';
    }
};

function renderTestCategory(container, grouped, categories) {
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');
    
    categories.forEach(cat => {
        const tests = grouped[cat];
        if (!tests || !tests.length) return;
        
        const col = document.createElement('div');
        col.className = 'col-12 mt-3';
        col.dataset.category = cat;
        
        const headerId = `cat-header-${cat.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const bodyId = `cat-body-${cat.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        let h = `<h6 class="fw-bold border-bottom pb-1 text-primary d-flex justify-content-between align-items-center" style="cursor:pointer" onclick="toggleTestCategory('${bodyId}', '${headerId}')">
            <span id="${headerId}"><i class="bi bi-tag-fill me-2"></i>${escapeHtml(cat)} <span class="badge bg-light text-primary ms-1">${tests.length}</span></span>
            <i class="bi bi-chevron-down ms-2 transition-icon" id="${headerId}-icon"></i>
        </h6>
        <div class="row g-2" id="${bodyId}">`;
        
        tests.forEach(t => {
            const isSelected = selectedTests.some(s => s.id == t.id);
            h += `
            <div class="col-6 col-md-4 col-xl-2">
                <div class="test-item-card border p-2 rounded ${isSelected ? 'bg-primary-subtle border-primary' : 'bg-white'}" 
                     style="cursor:pointer; transition:all 0.2s;" 
                     onclick="window.toggleTestAndRender('${t.id}', '${t.name.replace(/'/g, "\\'")}', '${t.price}', '${escapeHtml(t.category)}')">
                    <div class="d-flex align-items-center mb-0">
                        <input class="form-check-input test-checkbox me-2" type="checkbox" id="chk_${t.id}" 
                               data-id="${t.id}" data-name="${t.name.replace(/'/g, "\\'")}" data-price="${t.price}" data-cat="${escapeHtml(t.category)}"
                               ${isSelected ? 'checked' : ''} onclick="event.stopPropagation()">
                        <div class="w-100 overflow-hidden">
                            <div class="fw-bold text-truncate" style="font-size:0.75rem;">${escapeHtml(t.name)}</div>
                            <div class="text-danger fw-bold" style="font-size:0.7rem;">${Number(t.price).toLocaleString()} ₭</div>
                        </div>
                    </div>
                </div>
            </div>`;
        });
        
        h += '</div>';
        col.innerHTML = h;
        fragment.appendChild(col);
    });
    
    tempDiv.appendChild(fragment);
    while (tempDiv.firstChild) {
        container.appendChild(tempDiv.firstChild);
    }
}

window.toggleTestCategory = function(bodyId, headerId) {
    const body = document.getElementById(bodyId);
    const icon = document.getElementById(headerId + '-icon');
    if (!body) return;
    const isCollapsed = body.style.display === 'none';
    body.style.display = isCollapsed ? '' : 'none';
    if (icon) icon.className = isCollapsed ? 'bi bi-chevron-up ms-2 transition-icon' : 'bi bi-chevron-down ms-2 transition-icon';
};

window.toggleTestAndRender = (id, name, price, cat) => {
    const chk = document.getElementById('chk_' + id);
    if (chk) {
        chk.checked = !chk.checked;
        const card = chk.closest('.test-item-card');
        if (chk.checked) card.classList.add('bg-primary-subtle', 'border-primary');
        else card.classList.remove('bg-primary-subtle', 'border-primary');
        handleTestSelection();
    }
};

function handleTestSelection() {
    selectedTests = [];
    document.querySelectorAll('.test-checkbox:checked').forEach(chk => {
        selectedTests.push({
            id: chk.dataset.id,
            name: chk.dataset.name,
            price: Number(chk.dataset.price),
            category: chk.dataset.cat
        });
    });
    renderOrderSummary();
}

function renderOrderSummary() {
    const summaryList = document.getElementById('cartList');
    const totalDisplay = document.getElementById('totalPriceDisplay');
    if(!summaryList) return;

    summaryList.innerHTML = '';
    let total = 0;
    const normalItems = selectedTests.filter(t => t.source !== 'package');

    if (currentPackageMeta) {
        total += currentPackageMeta.price;
        const uid = 'pkg-card';
        const li = document.createElement('li');
        li.className = 'list-group-item bg-white mb-2 border shadow-sm rounded-3 p-0 overflow-hidden';
        li.innerHTML = `
            <div class="d-flex justify-content-between align-items-center py-2 px-3" style="cursor:pointer" onclick="document.getElementById('${uid}').classList.toggle('d-none')">
                <div class="small w-75">
                    <div class="fw-bold text-success text-truncate"><i class="bi bi-box-seam me-1"></i>${escapeHtml(currentPackageMeta.name)}</div>
                    <div class="text-muted" style="font-size:0.65rem;">${currentPackageMeta.itemCount} ລາຍການ</div>
                </div>
                <div class="d-flex align-items-center text-nowrap">
                    <div class="fw-bold text-danger me-2" style="font-size:0.8rem;">${currentPackageMeta.price.toLocaleString()}</div>
                    <i class="bi bi-chevron-down text-muted"></i>
                </div>
            </div>
            <div id="${uid}" class="d-none border-top bg-light">
                ${selectedTests.filter(t => t.source === 'package').map(it => `
                    <div class="d-flex justify-content-between align-items-center py-1 px-3 small">
                        <span class="text-truncate" style="max-width:70%">${escapeHtml(it.name)}</span>
                        <span class="text-muted">${Number(it.price || 0).toLocaleString()}</span>
                    </div>`).join('')}
            </div>`;
        summaryList.appendChild(li);
    }

    normalItems.forEach((t) => {
        total += t.price;
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center py-2 px-3 bg-white mb-2 border shadow-sm rounded-3';
        li.innerHTML = `
            <div class="small w-75">
                <div class="fw-bold text-primary text-truncate">${t.name}</div>
                <div class="text-muted" style="font-size:0.65rem;">${t.category}</div>
            </div>
            <div class="d-flex align-items-center text-nowrap">
                <div class="fw-bold text-danger me-2" style="font-size:0.8rem;">${t.price.toLocaleString()}</div>
                <button class="btn btn-sm text-danger p-0" onclick="window.removeTest('${t.id}')">
                    <i class="bi bi-x-circle-fill"></i>
                </button>
            </div>`;
        summaryList.appendChild(li);
    });

    const hasContent = normalItems.length > 0 || currentPackageMeta;
    if (!hasContent) {
        summaryList.innerHTML = `
            <li class="list-group-item text-center text-muted py-5 border-0 bg-transparent">
                <i class="bi bi-cart-x fs-1 opacity-25"></i>
                <div class="mt-2">ຍັງບໍ່ມີລາຍການເລອກ</div>
            </li>`;
    }

    if(totalDisplay) totalDisplay.innerText = formatKip(total);
}

window.removeTest = (id) => {
    const chk = document.getElementById('chk_' + id);
    if(chk) {
        chk.checked = false;
        const card = chk.closest('.test-item-card');
        if (card) card.classList.remove('bg-primary-subtle', 'border-primary');
        handleTestSelection();
    }
};

window.toggleOutlab = () => {
    const isOutlab = document.getElementById('isOutlab')?.checked;
    const labDestDiv = document.getElementById('labDestDiv');
    const labDest = document.getElementById('labDest');

    if (labDestDiv) labDestDiv.style.display = isOutlab ? 'block' : 'none';
    if (!labDest) return;

    if (isOutlab) {
        if (labDest.options.length > 1 && (!labDest.value || labDest.selectedIndex <= 0)) labDest.selectedIndex = 1;
    } else {
        labDest.value = '';
    }
};

window.calculateCart = () => {
    const testType = document.getElementById('testType')?.value || 'Normal';
    const pkgDiv = document.getElementById('packageInputDiv');
    if (pkgDiv) pkgDiv.style.display = testType === 'Package' ? 'block' : 'none';
    if (testType !== 'Package') removePackageItems();
    renderOrderSummary();
};

let loadedPackages = [];
let currentPackageId = null;
let currentPackageMeta = null;

function removePackageItems() {
    selectedTests = selectedTests.filter(t => t.source !== 'package');
    currentPackageId = null;
    currentPackageMeta = null;
    const sel = document.getElementById('packageSelector');
    if (sel) sel.value = '';
    const listEl = document.getElementById('packageItemsList');
    if (listEl) listEl.innerHTML = '';
    const priceEl = document.getElementById('packagePrice');
    if (priceEl) priceEl.value = 0;
}

window.removePackage = function() {
    removePackageItems();
    renderOrderSummary();
};

async function loadPackageSelector() {
    const sel = document.getElementById('packageSelector');
    if (!sel) return;
    if (loadedPackages.length > 0) {
        renderPackageOptions(sel);
        return;
    }
    try {
        const pkgs = await api.getAllTestPackages();
        loadedPackages = (pkgs || []).filter(p => p.is_active !== false);
        renderPackageOptions(sel);
    } catch (e) {
        console.error('[packages] Failed to load packages:', e);
    }
}

function renderPackageOptions(sel) {
    sel.innerHTML = '<option value="">-- ລືອກ Package --</option>';
    loadedPackages.forEach(p => {
        const opt = document.createElement('option');
        opt.value = String(p.id);
        opt.textContent = `${p.name} (${Number(p.price || 0).toLocaleString()} )`;
        sel.appendChild(opt);
    });
}

window.onPackageSelect = async function() {
    const sel = document.getElementById('packageSelector');
    const listEl = document.getElementById('packageItemsList');
    const priceEl = document.getElementById('packagePrice');
    const pkgId = sel?.value;
    if (!pkgId) {
        removePackageItems();
        renderOrderSummary();
        return;
    }
    if (pkgId === currentPackageId) return;
    listEl.innerHTML = '<li class="list-group-item text-center text-muted small">Loading...</li>';
    try {
        const items = await api.genericFetch('lis_one_test_package_items', { filter: `package_id=eq.${pkgId}` });
        const pkg = loadedPackages.find(p => String(p.id) === pkgId);
        const pkgPrice = pkg ? Number(pkg.price || 0) : 0;
        if (priceEl) priceEl.value = pkgPrice;
        if (!items || !items.length) {
            listEl.innerHTML = '<li class="list-group-item text-center text-muted small">ບໍ່ມີລາຍການໃນ Package</li>';
            return;
        }
        listEl.innerHTML = items.map(it => `
            <li class="list-group-item d-flex justify-content-between align-items-center py-1 px-2 small">
                <span>${escapeHtml(it.test_name)}</span>
                <span class="text-muted">${Number(it.price || 0).toLocaleString()} </span>
            </li>`).join('');
        selectedTests = selectedTests.filter(t => t.source !== 'package');
        selectedTests.push(...items.map(it => ({
            id: String(it.test_id),
            name: it.test_name,
            price: Number(it.price) || 0,
            category: 'Package',
            source: 'package',
            package_id: String(pkgId)
        })));
        currentPackageId = pkgId;
        currentPackageMeta = {
            id: String(pkgId),
            name: pkg ? pkg.name : 'Package',
            price: pkgPrice,
            itemCount: items.length
        };
        renderOrderSummary();
    } catch (e) {
        console.error('[packages] Failed to load package items:', e);
        listEl.innerHTML = '<li class="list-group-item text-center text-danger small">Failed to load</li>';
    }
};

window.submitData = async () => {
    const pid = document.getElementById('patientId').value.trim();
    const pname = document.getElementById('patientName').value.trim();
    const age = document.getElementById('age').value || '';
    const gender = document.getElementById('gender').value || 'Male';
    const doctor = document.getElementById('doctor').value || '';
    const dept = document.getElementById('department').value || '';
    const visitType = document.getElementById('visitType').value || '';
    const insite = document.getElementById('insite').value || '';
    const timeSlot = document.getElementById('timeSlot').value || '';
    const sender = document.getElementById('sender').value || '';
    const testType = document.getElementById('testType')?.value || 'Normal';
    const isOutlab = document.getElementById('isOutlab')?.checked || false;
    const labDest = isOutlab ? (document.getElementById('labDest')?.value || 'Outlab') : 'In-house';
    const orderDateTimeRaw = document.getElementById('orderDateTime')?.value || '';
    const orderDateTime = orderDateTimeRaw ? new Date(orderDateTimeRaw).toISOString() : null;
    
    if(!pid || !pname) {
        Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາປ້ອນ Patient ID ແລະ ຊື່ຄົນເຈັບ', 'warning');
        return;
    }
    if(selectedTests.length === 0) {
        Swal.fire('ແຈ້ງເຕືອນ', 'ກະລຸນາເລືອກລາຍການກວດຢ່າງໜ້ອຍ 1 ລາຍການ', 'warning');
        return;
    }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> ກຳລັງບັນທຶກ...';

    const orderId = editingOrderId || ('ORD-' + Date.now().toString().slice(-8));
    const totalPrice = selectedTests.reduce((s, t) => s + t.price, 0);

    const orderData = {
        order_id: orderId,
        patient_id: pid,
        patient_name: pname,
        age, gender, doctor, department: dept,
        visit_type: visitType,
        insite: insite,
        time_slot: timeSlot,
        test_type: testType,
        lab_dest: labDest,
        sender: sender,
        total_price: totalPrice,
        price: totalPrice,
        order_datetime: orderDateTime,
        test_items: selectedTests.map(t => ({
            name: t.name,
            category: t.category || 'Other',
            price: Number(t.price) || 0,
            test_type: testType
        })),
        status: editingOrderId ? editingOrderStatus : 'Pending'
    };

    try {
        // Pre-check reagent stock (only for in-house orders)
        const testNames = selectedTests.map(t => t.name);
        if (!isOutlab && typeof window.checkReagentAvailability === 'function') {
            const check = await window.checkReagentAvailability(testNames);
            if (!check.ok) {
                const list = check.shortages.map(s =>
                    `<li><b>${s.reagent_name}</b>: ຕ້ອງການ ${s.need}, ມີ ${s.have}, ຂາດ <span class="text-danger">${s.short}</span></li>`).join('');
                const decision = await Swal.fire({
                    title: '⚠ ນ້ຳຢາບໍ່ພໍ',
                    html: `<div class="text-start small">ບາງລາຍການນ້ຳຢາບໍ່ພຽງພໍ:<ul>${list}</ul>
                           ທ່ານຕ້ອງການບັນທຶກໂດຍ <b>ບໍ່ຫັກ</b> ນ້ຳຢາບໍ?</div>`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'ບັນທຶກໂດຍບໍ່ຫັກ',
                    cancelButtonText: 'ຍົກເລີກ',
                    confirmButtonColor: '#d97706'
                });
                if (!decision.isConfirmed) {
                    btn.disabled = false; btn.innerHTML = oldHtml; return;
                }
                orderData._skipDeduct = true;
            }
        }

        if (editingOrderId) {
            const deleteExisting = await api.deleteOrder(editingOrderId);
            if (!deleteExisting.success) {
                Swal.fire('ຜິດພາດ', deleteExisting.error || 'ລຶບຂໍ້ມູນເກົ່າກ່ອນແກ້ໄຂບໍ່ສຳເລັດ', 'error');
                return;
            }
        }

        const res = await api.saveOrder(orderData, selectedTests);
        if(res.success) {
            // Auto-deduct reagent (only in-house, only if pre-check passed)
            let deductMsg = '';
            if (!isOutlab && !orderData._skipDeduct && typeof window.deductReagentsForOrder === 'function') {
                const dres = await window.deductReagentsForOrder(testNames, orderId);
                if (dres.success && dres.deducted.length) {
                    deductMsg = `<br><small class="text-success">ຫັກນ້ຳຢາ ${dres.deducted.length} ລາຍການແລ້ວ</small>`;
                } else if (dres.errors?.length) {
                    deductMsg = `<br><small class="text-danger">ຫັກນ້ຳຢາລົ້ມເຫຼວ: ${dres.errors[0]}</small>`;
                }
            }
            api.writeAudit(JSON.parse(sessionStorage.getItem('lis_user')||'{}').username || 'admin',
                'INSERT', 'test_orders', { order_id: orderId, tests: testNames.length, total: totalPrice });
            await Swal.fire({
                title: 'ສຳເລັດ',
                html: 'ບັນທຶກສັ່ງກວດສຳເລັດ! <br> ລະຫັດບິນ: <b>' + orderId + '</b>' + deductMsg,
                icon: 'success',
                confirmButtonText: 'ໄປໜ້າປະຫວັດສັ່ງກວດ',
                confirmButtonColor: '#7c3aed'
            });
            editingOrderId = null;
            editingOrderStatus = 'Pending';
            const editAlert = document.getElementById('editAlert');
            if (editAlert) editAlert.classList.add('d-none');
            window.resetForm();
            await loadRecentOrders(true);
            window.showPage?.(null, 'historyPage');
        } else {
            Swal.fire('ຜິດພາດ', res.error || 'ບັນທຶກບໍ່ສຳເລັດ', 'error');
        }
    } catch(e) {
        console.error(e);
        Swal.fire('Error', 'Internal Server Error', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
    }
};

window.applyPickedPatient = (p) => {
    if (!p) return;
    if (document.getElementById('patientId'))   document.getElementById('patientId').value   = p.hn || '';
    if (document.getElementById('patientName')) document.getElementById('patientName').value = p.name || '';
    if (document.getElementById('age'))         document.getElementById('age').value         = p.age ?? '';
    if (document.getElementById('gender') && p.gender) document.getElementById('gender').value = p.gender;
};

window.resetForm = () => {
    document.getElementById('patientId').value = '';
    document.getElementById('patientName').value = '';
    document.getElementById('age').value = '';
    document.getElementById('doctor').selectedIndex = 0;
    document.getElementById('department').selectedIndex = 0;
    document.getElementById('sender').selectedIndex = 0;
    document.getElementById('visitType').selectedIndex = 0;
    document.getElementById('insite').selectedIndex = 0;
    document.getElementById('timeSlot').selectedIndex = 0;
    
    document.querySelectorAll('.test-checkbox').forEach(c => {
        c.checked = false;
        const card = c.closest('.test-item-card');
        if (card) card.classList.remove('bg-primary-subtle', 'border-primary');
    });
    selectedTests = [];
    renderOrderSummary();
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.innerHTML = '<i class="bi bi-save me-2"></i> ບັນທຶກການສັ່ງກວດ';
};

function renderOrderHistoryTable(orders) {
    const body = document.getElementById('orderTableBody');
    if(!body) return;

    const t0 = performance.now();
    const fragment = document.createDocumentFragment();
    
    (orders || []).forEach(o => {
        const tr = document.createElement('tr');
        tr.dataset.orderId = o.order_id;
        tr.innerHTML = `
            <td><small>${formatDateTime(o.order_datetime)}</small></td>
            <td><b class="text-primary">${escapeHtml(o.patient_id)}</b></td>
            <td><b>${escapeHtml(o.patient_name)}</b></td>
            <td class="text-center">${escapeHtml(o.age)}</td>
            <td class="text-center">${escapeHtml(o.gender)}</td>
            <td><span class="badge ${String(o.lab_dest || 'In-house').toLowerCase().includes('out') ? 'bg-warning text-dark' : 'bg-success'}">${escapeHtml(o.lab_dest || 'In-house')}</span></td>
            <td><small class="text-muted fw-semibold">${escapeHtml(o.order_id)}</small></td>
            <td class="text-end text-danger fw-bold">${formatKip(o.total_price)}</td>
            <td class="text-center">
                <div class="order-action-group" role="group" aria-label="Order actions">
                    <button class="btn btn-sm order-action-btn action-upload" onclick="uploadOrderResult('${escapeHtml(o.order_id)}')" title="Manage result files">
                        <i class="bi bi-cloud-arrow-up-fill"></i><span class="upload-count-badge" data-upload-count="${escapeHtml(o.order_id)}"></span>
                    </button>
                    <button class="btn btn-sm order-action-btn action-view" onclick="viewOrderDetail('${escapeHtml(o.order_id)}')" title="View order"><i class="bi bi-eye-fill"></i></button>
                    <button class="btn btn-sm order-action-btn action-edit" onclick="editOrder('${escapeHtml(o.order_id)}')" title="Edit order"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm order-action-btn action-delete" onclick="deleteOrder('${escapeHtml(o.order_id)}')" title="Delete order"><i class="bi bi-trash3"></i></button>
                </div>
            </td>
        `;
        fragment.appendChild(tr);
    });
    
    body.innerHTML = '';
    body.appendChild(fragment);
    
    const renderTime = performance.now() - t0;
    if (renderTime > 500) console.warn(`[PERF] renderOrderHistoryTable: ${renderTime.toFixed(0)}ms (${orders?.length || 0} rows)`);
    
    hydrateOrderUploadBadges(orders || []).catch(e => console.warn('[history] upload badge failed', e));
}

function groupOrdersById(rows = []) {
    const map = new Map();
    for (const row of rows || []) {
        const key = row.order_id || `${row.patient_id || ''}-${row.order_datetime || ''}`;
        if (!key) continue;
        const existing = map.get(key);
        if (!existing) {
            map.set(key, {
                ...row,
                _item_rows: [row],
                _test_names: row.test_name ? [row.test_name] : [],
                _categories: row.category ? [row.category] : [],
                _test_types: row.test_type ? [row.test_type] : [],
                _price_sum: Number(row.price) || 0,
                _total_candidates: row.total_price != null ? [Number(row.total_price) || 0] : []
            });
            continue;
        }
        existing._item_rows.push(row);
        if (row.test_name && !existing._test_names.includes(row.test_name)) existing._test_names.push(row.test_name);
        if (row.category && !existing._categories.includes(row.category)) existing._categories.push(row.category);
        if (row.test_type && !existing._test_types.includes(row.test_type)) existing._test_types.push(row.test_type);
        existing._price_sum += Number(row.price) || 0;
        if (row.total_price != null) existing._total_candidates.push(Number(row.total_price) || 0);
        if ((row.order_datetime || '') > (existing.order_datetime || '')) existing.order_datetime = row.order_datetime;
        if (!existing.patient_name && row.patient_name) existing.patient_name = row.patient_name;
        if (!existing.patient_id && row.patient_id) existing.patient_id = row.patient_id;
        if (!existing.age && row.age) existing.age = row.age;
        if (!existing.gender && row.gender) existing.gender = row.gender;
        if (!existing.lab_dest && row.lab_dest) existing.lab_dest = row.lab_dest;
        if (row.status === 'Completed' && existing.status !== 'Cancelled') existing.status = 'Completed';
    }

    return [...map.values()]
        .map(order => {
            const total = Math.max(...(order._total_candidates || [0]));
            return {
                ...order,
                test_name: order._test_names.join(', '),
                category: order._categories.join(', '),
                test_type: order._test_types.length === 1 ? order._test_types[0] : order._test_types.join(', '),
                total_price: total || order._price_sum || order.total_price || 0,
                item_count: order._item_rows.length
            };
        })
        .sort((a, b) => orderDateValue(b) - orderDateValue(a));
}

function findRecentOrder(orderId) {
    return recentOrders.find(order => String(order.order_id) === String(orderId));
}

async function hydrateOrderUploadBadges(orders) {
    await Promise.all((orders || []).map(async (order) => {
        const badge = document.querySelector(`[data-upload-count="${CSS.escape(String(order.order_id))}"]`);
        if (!badge) return;
        const res = await api.getOrderFiles(order.order_id);
        const files = res.success ? (res.data || []) : [];
        badge.textContent = files.length ? String(files.length) : '';
        badge.classList.toggle('has-files', files.length > 0);
    }));
}

function orderItemsHtml(order) {
    const rows = order?._item_rows?.length ? order._item_rows : [order];
    return rows.map(row => `
        <div class="order-detail-item">
            <span>${escapeHtml(row.test_name || row.name || '-')}</span>
            <b>${formatKip(row.price || row.total_price || 0)}</b>
        </div>
    `).join('');
}

async function uploadedFilesHtml(orderId) {
    const res = await api.getOrderFiles(orderId);
    const files = res.success ? (res.data || []) : [];
    if (!files.length) return '<div class="text-muted small py-2">ຍັງບໍ່ມີໄຟລ໌ຜົນກວດ</div>';
    return files.map(file => `
        <div class="order-upload-item">
            <div>
                <b>${escapeHtml(file.file_name)}</b>
                <small>${escapeHtml(file.file_type || 'file')} · ${formatFileSize(file.file_size)}</small>
            </div>
            <div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-primary" onclick="window.open('${escapeHtml(file.public_url)}', '_blank')"><i class="bi bi-eye"></i> View</button>
                <button class="btn btn-sm btn-outline-success" onclick="window.open('${escapeHtml(file.public_url)}', '_blank')"><i class="bi bi-download"></i> Download</button>
                <button class="btn btn-sm btn-outline-danger" onclick="removeOrderFile('${escapeHtml(file.id)}', '${escapeHtml(file.storage_path)}', '${escapeHtml(orderId)}', '${escapeHtml(file.public_url)}')"><i class="bi bi-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function fileKindIcon(file = {}) {
    const type = String(file.type || '').toLowerCase();
    if (type.includes('pdf')) return 'bi-file-earmark-pdf-fill text-danger';
    if (type.includes('image')) return 'bi-file-earmark-image-fill text-info';
    return 'bi-file-earmark-medical-fill text-primary';
}

async function renderOrderUploadModal(orderId, prefetchedFiles = null) {
    orderId = String(orderId || '').trim();
    const title = document.getElementById('orderUploadOrderId');
    const list = document.getElementById('orderUploadFilesList');
    if (title) title.textContent = orderId;
    if (!list) return;
    list.innerHTML = '<div class="text-center text-muted py-3 small">Loading...</div>';
    const res = prefetchedFiles ? { success: true, data: prefetchedFiles } : await api.getOrderFiles(orderId);
    const files = res.success ? (res.data || []) : [];
    console.log('[FILES] modal render rows', { orderId, rows: files, container: list.id });
    invalidateFileCache(orderId);
    ORDER_FILE_CACHE[orderId] = files;
    if (!files.length) {
        list.innerHTML = `
            <div class="upload-empty-state">
                <i class="bi bi-cloud-arrow-up"></i>
                <b>ຍັງບໍ່ມີໄຟລ໌ຜົນກວດ</b>
                <span>ກົດ "ເພີ່ມໄຟລ໌" ເພື່ອອັບໂຫຼດຮູບ ຫຼື PDF</span>
            </div>`;
        return;
    }
    list.innerHTML = files.map(file => `
        <div class="upload-manager-item">
            <div class="upload-file-main">
                <i class="bi ${fileKindIcon({ type: file.file_type })}"></i>
                <div>
                    <b>${escapeHtml(file.file_name)}</b>
                    <small>${escapeHtml(file.file_type || 'file')} · ${formatFileSize(file.file_size)} · ${formatDateTime(file.uploaded_at)}</small>
                </div>
            </div>
            <div class="upload-file-actions">
                <button class="btn btn-sm btn-outline-primary" onclick="window.open('${escapeHtml(file.public_url)}', '_blank')"><i class="bi bi-eye-fill"></i> ເບິ່ງ</button>
                <button class="btn btn-sm btn-outline-success" onclick="window.open('${escapeHtml(file.public_url)}', '_blank')"><i class="bi bi-download"></i> ໂຫຼດ</button>
                <button class="btn btn-sm btn-outline-danger" onclick="removeOrderFile('${escapeHtml(file.id)}', '${escapeHtml(file.storage_path)}', '${escapeHtml(orderId)}', '${escapeHtml(file.public_url)}')"><i class="bi bi-trash"></i></button>
            </div>
        </div>
    `).join('');
}

window.viewOrderDetail = async function(orderId) {
    const order = findRecentOrder(orderId) || groupOrdersById(await api.getRecentOrders()).find(o => String(o.order_id) === String(orderId));
    if (!order) return Swal.fire('ບໍ່ພົບຂໍ້ມູນ', orderId, 'warning');
    const body = document.getElementById('orderDetailBody');
    if (!body) return;
    body.innerHTML = `
        <table class="table table-bordered align-middle order-detail-table">
            <tbody>
                <tr><th>ລະຫັດບິນ (ID):</th><td><b>${escapeHtml(order.order_id)}</b></td></tr>
                <tr><th>ເວລາ:</th><td>${formatDateTime(order.order_datetime)}</td></tr>
                <tr><th>ຄົນເຈັບ:</th><td><b class="text-primary">${escapeHtml(order.patient_id)}</b> - ${escapeHtml(order.patient_name)} (${escapeHtml(order.gender || '-')}, ${escapeHtml(order.age || '-')} ປີ)</td></tr>
                <tr><th>ແພດ / ພະແນກ:</th><td>${escapeHtml(order.doctor || '-')} / ${escapeHtml(order.department || '-')}</td></tr>
                <tr><th>ສະຖານະ:</th><td><span class="badge ${String(order.lab_dest || 'In-house').toLowerCase().includes('out') ? 'bg-warning text-dark' : 'bg-success'}">${escapeHtml(order.lab_dest || 'In-house')}</span> ${statusBadge(order.status)}</td></tr>
                <tr><th>ລາຍການກວດ:</th><td><div class="order-detail-list">${orderItemsHtml(order)}</div></td></tr>
                <tr><th>ໄຟລ໌ຜົນກວດ:</th><td><div class="order-upload-list">${await uploadedFilesHtml(order.order_id)}</div></td></tr>
            </tbody>
        </table>
    `;
    const modal = document.getElementById('orderDetailModal');
    if (window.bootstrap?.Modal && modal) bootstrap.Modal.getOrCreateInstance(modal).show();
};

window.uploadOrderResult = async function(orderId) {
    orderId = String(orderId || '').trim();
    const input = document.getElementById('orderResultUploadInput');
    const modal = document.getElementById('orderUploadModal');
    if (!input || !modal) return;
    input.dataset.orderId = orderId;
    await renderOrderUploadModal(orderId);
    if (window.bootstrap?.Modal) bootstrap.Modal.getOrCreateInstance(modal).show();
};

window.pickOrderResultFiles = function() {
    const input = document.getElementById('orderResultUploadInput');
    if (!input) return;
    input.value = '';
    input.click();
};

document.addEventListener('change', async (event) => {
    if (event.target?.id !== 'orderResultUploadInput') return;
    const input = event.target;
    const orderId = input.dataset.orderId;
    if (!orderId || !input.files?.length) return;
    const btn = document.querySelector('#orderUploadModal .btn-success');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> ກຳລັງອັບໂຫຼດ...'; }
    try {
        let uploadedCount = 0;
        const cleanOrderId = String(orderId || '').trim();
        const uploadedRows = [];
        for (const file of input.files) {
            const res = await api.uploadOrderFile(cleanOrderId, file);
            console.log('[FILES] upload response', res);
            if (res.success) {
                uploadedCount++;
                const row = res.file || (Array.isArray(res.data) ? res.data[0] : null);
                if (row?.id) uploadedRows.push(row);
            } else {
                const detail = res.detail?.message || res.detail?.error || (typeof res.detail === 'string' ? res.detail : '');
                throw new Error(detail || res.error || 'Upload failed');
            }
        }
        if (uploadedCount === 0) throw new Error('No files were uploaded');
        const filesRes = await api.getOrderFiles(cleanOrderId);
        let files = filesRes.success ? (filesRes.data || []) : [];
        uploadedRows.forEach(row => {
            const sameRow = files.some(file => String(file.id) === String(row.id));
            if (!sameRow && String(row.order_id || '').trim() === cleanOrderId) files.unshift(row);
        });
        console.log('[FILES] fetched rows after upload', { orderId: cleanOrderId, rows: files });
        invalidateFileCache(cleanOrderId);
        ORDER_FILE_CACHE[cleanOrderId] = files;
        await hydrateOrderUploadBadges(recentOrders);
        await renderOrderUploadModal(cleanOrderId, files);
        Swal.fire({
            icon: 'success',
            title: 'ສຳເລັດ',
            text: `ອັບໂຫຼດໄຟລ໌ຜົນກວດ ${uploadedCount} ໄຟລ໌ແລ້ວ`,
            timer: 1500,
            showConfirmButton: false
        });
    } catch (error) {
        console.error(error);
        Swal.fire('ຜິດພາດ', error.message || 'ອັບໂຫຼດໄຟລ໌ບໍ່ສຳເລັດ', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-plus-circle me-1"></i> ເພີ່ມໄຟລ໌'; }
    }
});

window.removeOrderFile = async function(fileId, storagePath, orderId, publicUrl) {
    const confirm = await Swal.fire({
        title: 'ລຶບໄຟລ໌?',
        text: 'ໄຟລ໌ນີ້ຈະຖືກລຶບຖາວອນ',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'ລຶບ',
        cancelButtonText: 'ຍົກເລີກ',
        confirmButtonColor: '#dc2626'
    });
    if (!confirm.isConfirmed) return;
    const res = await api.deleteOrderFile(fileId, storagePath, publicUrl);
    if (res.success) {
        invalidateFileCache(orderId);
        await hydrateOrderUploadBadges(recentOrders);
        await renderOrderUploadModal(orderId);
        Swal.fire('ສຳເລັດ', 'ລຶບໄຟລ໌ແລ້ວ', 'success');
    } else {
        const detail = res.detail?.message || res.detail?.error || (typeof res.detail === 'string' ? res.detail : '');
        Swal.fire('ຜິດພາດ', detail || res.error || 'ລຶບບໍ່ສຳເລັດ', 'error');
    }
};

window.printTubeLabelForOrder = function(orderId) {
    const order = findRecentOrder(orderId);
    if (!order) return;
    const html = `
        <div style="font-family:Arial,sans-serif;padding:16px;width:260px">
            <h3 style="margin:0 0 8px">LIS Test By No</h3>
            <div><b>Order:</b> ${escapeHtml(order.order_id)}</div>
            <div><b>HN:</b> ${escapeHtml(order.patient_id)}</div>
            <div><b>Name:</b> ${escapeHtml(order.patient_name)}</div>
            <div><b>Date:</b> ${formatDateTime(order.order_datetime)}</div>
        </div>`;
    const win = window.open('', '_blank', 'width=360,height=420');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.print();
};

function applyOrderSelections(order) {
    const rows = order?._item_rows?.length ? order._item_rows : [order];
    const wanted = new Set(rows.map(row => String(row.test_name || row.name || '').trim().toLowerCase()).filter(Boolean));
    selectedTests = [];
    document.querySelectorAll('.test-checkbox').forEach(chk => {
        const match = wanted.has(String(chk.dataset.name || '').trim().toLowerCase());
        chk.checked = match;
        const card = chk.closest('.test-item-card');
        if (card) card.classList.toggle('bg-primary-subtle', match), card.classList.toggle('border-primary', match);
        if (match) {
            selectedTests.push({
                id: chk.dataset.id,
                name: chk.dataset.name,
                price: Number(chk.dataset.price),
                category: chk.dataset.cat
            });
        }
    });
    renderOrderSummary();
}

window.editOrder = async function(orderId) {
    const order = findRecentOrder(orderId);
    if (!order) return Swal.fire('ບໍ່ພົບຂໍ້ມູນ', orderId, 'warning');
    editingOrderId = order.order_id;
    editingOrderStatus = order.status || 'Pending';
    window.showPage?.(null, 'orderForm');
    await populateDropdowns(true);
    await window.loadTestCheckboxes();

    document.getElementById('orderDateTime').value = toDateTimeLocal(order.order_datetime);
    document.getElementById('patientId').value = order.patient_id || '';
    document.getElementById('patientName').value = order.patient_name || '';
    document.getElementById('age').value = order.age || '';
    setSelectValue('gender', order.gender || 'Male');
    setSelectValue('doctor', order.doctor || '');
    setSelectValue('department', order.department || '');
    setSelectValue('sender', order.sender || '');
    setSelectValue('visitType', order.visit_type || '');
    setSelectValue('insite', order.insite || '');
    setSelectValue('timeSlot', order.time_slot || '');
    setSelectValue('testType', order.test_type || 'Normal');

    const isOutlab = String(order.lab_dest || '').toLowerCase() !== 'in-house';
    const outlab = document.getElementById('isOutlab');
    if (outlab) outlab.checked = isOutlab;
    window.toggleOutlab?.();
    if (isOutlab) setSelectValue('labDest', order.lab_dest || '');

    applyOrderSelections(order);
    const banner = document.getElementById('editAlert');
    const idDisplay = document.getElementById('editOrderIdDisplay');
    if (idDisplay) idDisplay.textContent = order.order_id;
    if (banner) banner.classList.remove('d-none');
    document.getElementById('submitBtn').innerHTML = '<i class="bi bi-save me-2"></i> ບັນທຶກການແກ້ໄຂ';
};

window.cancelEdit = function() {
    editingOrderId = null;
    editingOrderStatus = 'Pending';
    const banner = document.getElementById('editAlert');
    if (banner) banner.classList.add('d-none');
    const idDisplay = document.getElementById('editOrderIdDisplay');
    if (idDisplay) idDisplay.textContent = '';
    window.resetForm?.();
};

async function loadRecentOrders(force = false) {
    if (!force && recentOrders.length > 0 && Date.now() - (window.__lastOrdersUpdate || 0) < 60000) {
        renderOrderHistoryTable(recentOrders);
        return recentOrders;
    }
    const body = document.getElementById('orderTableBody');
    if (body) body.innerHTML = '<tr><td colspan="9" class="text-center py-4"><div class="spinner-border text-primary"></div><div class="mt-2 text-muted small">ກຳລັງໂຫຼດປະຫວັດສັ່ງກວດ...</div></td></tr>';
    
    const t0 = performance.now();
    recentOrders = groupOrdersById(await api.getRecentOrders());
    const loadTime = performance.now() - t0;
    if (loadTime > 2000) console.warn(`[PERF] loadRecentOrders: ${loadTime.toFixed(0)}ms (${recentOrders.length} orders)`);
    
    window.__lastOrdersUpdate = Date.now();
    renderOrderHistoryTable(recentOrders);
    return recentOrders;
}

window.loadTable = async () => {
    const searchDate = document.getElementById('searchDate');
    if (searchDate) searchDate.value = '';
    await loadRecentOrders(true);
};

let searchDebounceTimer = null;

window.filterTable = () => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        const date = document.getElementById('searchDate')?.value;
        if (!date) return renderOrderHistoryTable(recentOrders);
        renderOrderHistoryTable(recentOrders.filter(o => String(o.order_datetime || '').slice(0, 10) === date));
    }, 300);
};

function localDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

window.updateOrderStatus = async (orderId, status) => {
    const res = await api.updateOrder(orderId, { status });
    if (res.success) {
        await loadRecentOrders(true);
        Swal.fire('ສຳເລັດ', 'ອັບເດດສະຖານະແລ້ວ', 'success');
    } else {
        Swal.fire('Error', res.error?.message || res.error || 'Update failed', 'error');
    }
};

window.deleteOrder = async (orderId) => {
    const confirm = await Swal.fire({
        title: 'ຢືນຢັນການລຶບ?',
        html: `<b>${orderId}</b><br><small class="text-muted">ຂໍ້ມູນຜົນກວດທີ່ກ່ຽວຂ້ອງຈະຖືກລຶບໄປດ້ວຍ</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'ລຶບ',
        cancelButtonText: 'ຍົກເລີກ',
        confirmButtonColor: '#dc2626'
    });
    if (!confirm.isConfirmed) return;
    Swal.fire({ title: 'ກຳລັງລຶບ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    // Delete child rows first to avoid foreign-key violations.
    try {
        const resultsRes = await api.deleteResultsForOrder(orderId);
        if (!resultsRes.success && resultsRes.error) {
            console.warn('[deleteOrder] deleteResultsForOrder warning:', resultsRes.error);
        }
    } catch (e) {
        console.warn('[deleteOrder] deleteResultsForOrder threw:', e);
    }
    const res = await api.deleteOrder(orderId);
    Swal.close();
    if (res.success) {
        // Drop the order from local cache immediately so the row disappears.
        if (Array.isArray(recentOrders)) {
            recentOrders = recentOrders.filter(o => String(o.order_id) !== String(orderId));
            renderOrderHistoryTable(recentOrders);
        }
        await loadRecentOrders(true);
        try {
            const user = JSON.parse(sessionStorage.getItem('lis_user') || '{}').username || 'admin';
            api.writeAudit?.(user, 'DELETE', 'lis_one_test_orders', { order_id: orderId });
        } catch {}
        Swal.fire('ສຳເລັດ', 'ລຶບຂໍ້ມູນແລ້ວ', 'success');
    } else {
        const msg = res.error?.message || (typeof res.error === 'string' ? res.error : null) || JSON.stringify(res.error || {}) || 'Delete failed';
        Swal.fire('ລຶບບໍ່ສຳເລັດ', msg, 'error');
    }
};

window.exportHistoryData = (type) => {
    const rows = Array.from(document.querySelectorAll('#orderTableBody tr')).map(tr => {
        const c = tr.querySelectorAll('td');
        return {
            order_datetime: c[0]?.innerText.trim() || '',
            patient_id: c[1]?.innerText.trim() || '',
            patient_name: c[2]?.innerText.trim() || '',
            age: c[3]?.innerText.trim() || '',
            gender: c[4]?.innerText.trim() || '',
            lab_dest: c[5]?.innerText.trim() || '',
            order_id: c[6]?.innerText.trim() || '',
            total_price: c[7]?.innerText.trim() || '',
            actions: c[8]?.innerText.trim() || ''
        };
    });

    if (!rows.length) return Swal.fire('No data', 'ບໍ່ມີຂໍ້ມູນສຳລັບ Export', 'info');
    const filename = `lis-one-order-history-${new Date().toISOString().slice(0, 10)}`;

    if (type === 'excel' && window.XLSX) {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Order History');
        XLSX.writeFile(wb, `${filename}.xlsx`);
        return;
    }

    if (type === 'csv') {
        const headers = Object.keys(rows[0]);
        const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h]).replace(/"/g, '""')}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${filename}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        return;
    }

    if (type === 'pdf' && window.jspdf?.jsPDF) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        doc.setFontSize(14);
        doc.text('LIS-One Order History', 40, 35);
        const body = rows.map(r => [r.order_datetime, r.patient_id, r.patient_name, r.age, r.gender, r.lab_dest, r.order_id, r.total_price]);
        if (doc.autoTable) {
            doc.autoTable({
                head: [['Date/Time', 'Patient ID', 'Name', 'Age', 'Gender', 'Lab Dest', 'Order ID', 'Total Price']],
                body,
                startY: 50,
                styles: { fontSize: 8, cellPadding: 3 },
                headStyles: { fillColor: [31, 41, 55] }
            });
        } else {
            doc.text(body.map(r => r.join(' | ')).join('\n'), 40, 60);
        }
        doc.save(`${filename}.pdf`);
    }
};

async function loadDashboard() {
    const loader = document.getElementById('dashLoader');
    const alerts = document.getElementById('dashAlerts');
    const start = document.getElementById('dashStartDate')?.value || '';
    const end = document.getElementById('dashEndDate')?.value || '';
    const filterKey = JSON.stringify({ dateStart: start, dateEnd: end, ...getDashboardFilters() });
    if (dashboardState.lastUpdate && dashboardState.lastFilterKey === filterKey && Date.now() - dashboardState.lastUpdate < 1500) return;

    if (loader) loader.style.display = 'block';
    if (alerts) alerts.innerHTML = '';

    const t0 = performance.now();
    try {
        const [dashboardData, results, testMaster] = await Promise.all([
            api.getDashboardData(start, end),
            api.getTestResults().catch(() => []),
            api.getTestMaster().catch(() => [])
        ]);
        const fetchTime = performance.now() - t0;
        if (fetchTime > 2000) console.warn(`[PERF] loadDashboard fetch: ${fetchTime.toFixed(0)}ms`);

        const loadedAt = Date.now();

        const filters = getDashboardFilters();
        const dateRows = filterOrdersByDashboardDate(dashboardData.orders || [], start, end);
        const orderRows = applyDashboardFilters(dateRows, filters);
        const orders = groupDashboardOrders(orderRows);
        console.log('[DASH] date range, total orders, order ids', { start, end, totalOrders: orders.length, orderIds: orders.map(o => o.order_id) });
        const testRows = buildDashboardTestRows(orderRows, results || [], testMaster || []);
        const analytics = calculateDashboardAnalytics(orders, testRows);
        dashboardState = {
            orders,
            orderRows,
            testRows,
            summary: analytics.testSummary,
            timeSlotMode: dashboardState.timeSlotMode || 'all',
            analytics,
            lastUpdate: loadedAt,
            lastFilterKey: filterKey
        };

        const r0 = performance.now();
        renderDashboardKpis(analytics);
        renderDashboardCharts(analytics);
        renderTimeSlotReport(dashboardState.timeSlotMode || 'all');
        renderAgeGroupsTable(analytics.ageGroups);
        renderTopTables(analytics);
        renderDashboardSummaryTable(analytics.testSummary);
        populateDashboardFilterOptions(dashboardData.orders || []);
        const renderTime = performance.now() - r0;
        if (renderTime > 1000) console.warn(`[PERF] loadDashboard render: ${renderTime.toFixed(0)}ms`);
    } catch (err) {
        console.error('Dashboard Error:', err);
        if (alerts) alerts.innerHTML = `<div class="alert alert-danger">Dashboard Error: ${escapeHtml(err.message)}</div>`;
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

window.loadDashboard = loadDashboard;

function getDashboardFilters() {
    return {
        department: document.getElementById('dashDepartment')?.value || '',
        doctor: document.getElementById('dashDoctor')?.value || '',
        testType: document.getElementById('dashTestType')?.value || '',
        category: document.getElementById('dashCategory')?.value || ''
    };
}

function applyDashboardFilters(orders, filters) {
    return (orders || []).filter(o => {
        if (filters.department && o.department !== filters.department) return false;
        if (filters.doctor && o.doctor !== filters.doctor) return false;
        if (filters.testType && o.test_type !== filters.testType) return false;
        if (filters.category && (o.category || 'Other') !== filters.category) return false;
        return true;
    });
}

function filterOrdersByDashboardDate(orders, start, end) {
    const from = start ? `${start}T00:00:00` : '';
    const to = end ? `${end}T23:59:59.999` : '';
    return (orders || []).filter(order => {
        const dt = String(order.order_datetime || '');
        if (!dt) return false;
        if (from && dt < from) return false;
        if (to && dt > to) return false;
        return true;
    });
}

function populateDashboardFilterOptions(orders) {
    fillSelectOptions('dashDepartment', uniqueSorted(orders.map(o => o.department)));
    fillSelectOptions('dashDoctor', uniqueSorted(orders.map(o => o.doctor)));
    const cats = uniqueSorted(orders.map(o => o.category).filter(Boolean));
    if (cats.length) fillSelectOptions('dashCategory', cats);
}

function fillSelectOptions(id, values) {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    const first = el.querySelector('option[value=""]')?.textContent || 'ທັງໝົດ';
    el.innerHTML = `<option value="">${first}</option>` + values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    if (values.includes(current)) el.value = current;
}

function uniqueSorted(values) {
    return [...new Set(values.filter(v => v !== undefined && v !== null && String(v).trim() !== '').map(String))].sort((a, b) => a.localeCompare(b));
}

function groupCount(rows, normalizer) {
    const out = {};
    rows.forEach(row => {
        const key = normalizer(row) || 'Unknown';
        out[key] = (out[key] || 0) + 1;
    });
    return out;
}

function groupRevenue(rows, normalizer) {
    const out = {};
    rows.forEach(row => {
        const key = normalizer(row) || 'Unknown';
        out[key] = (out[key] || 0) + orderItemRevenue(row);
    });
    return out;
}

function dashboardOrderKey(order) {
    return String(order?.order_id || `${order?.patient_id || ''}-${order?.order_datetime || ''}`).trim();
}

function groupDashboardOrders(rows = []) {
    const groups = new Map();
    for (const row of rows || []) {
        const key = dashboardOrderKey(row);
        if (!key) continue;
        if (!groups.has(key)) {
            groups.set(key, {
                ...row,
                _item_rows: [],
                _orderRevenue: 0,
                _hasItemPrice: false,
                _totalCandidates: []
            });
        }
        const group = groups.get(key);
        group._item_rows.push(row);

        const itemPrice = Number(row.price);
        if (Number.isFinite(itemPrice) && itemPrice > 0) {
            group._orderRevenue += itemPrice;
            group._hasItemPrice = true;
        }

        const totalPrice = Number(row.total_price);
        if (Number.isFinite(totalPrice) && totalPrice > 0) group._totalCandidates.push(totalPrice);

        if ((row.order_datetime || '') > (group.order_datetime || '')) group.order_datetime = row.order_datetime;
        for (const field of ['patient_id', 'patient_name', 'age', 'gender', 'insite', 'visit_type', 'test_type', 'lab_dest', 'department', 'doctor', 'sender', 'time_slot', 'status']) {
            if ((group[field] == null || group[field] === '') && row[field] != null && row[field] !== '') group[field] = row[field];
        }
    }

    return [...groups.values()]
        .map(order => ({
            ...order,
            total_price: order._hasItemPrice
                ? order._orderRevenue
                : Math.max(0, ...(order._totalCandidates || [0]), Number(order.total_price) || 0)
        }))
        .sort((a, b) => String(b.order_datetime || '').localeCompare(String(a.order_datetime || '')));
}

function normalizeDoctorName(order) {
    const doctor = String(order?.doctor || '').trim();
    if (doctor && !/^unknown$/i.test(doctor) && doctor !== '-') return doctor;
    const sender = String(order?.sender || '').trim();
    if (sender && !/^unknown$/i.test(sender) && sender !== '-') return sender;
    return 'ບໍ່ລະບຸແພດ';
}

function normalizeGender(gender) {
    const g = String(gender || '').toLowerCase().trim();
    if (!g) return 'Unknown';
    if (g.startsWith('m') || g === 'male' || g.includes('ຊາຍ')) return 'Male';
    if (g.startsWith('f') || g === 'female' || g.includes('ຍິງ')) return 'Female';
    return 'Unknown';
}

function normalizeInsite(insite) {
    const v = String(insite || '').trim();
    if (!v) return 'Unknown';
    const upper = v.toUpperCase();
    if (upper.includes('IPD') || upper.includes('IN-PATIENT') || upper.includes('INPATIENT')) return 'IPD';
    if (upper.includes('OPD') || upper.includes('OUT-PATIENT') || upper.includes('OUTPATIENT')) return 'OPD';
    // Return the original value if it doesn't match known patterns
    return v;
}

function normalizeLabDest(dest) {
    const v = String(dest || '').toLowerCase();
    if (v.includes('out') || v.includes('send') || v.includes('external') || v.includes('source')) return 'Outsource';
    if (!v || v.includes('in-house') || v.includes('inlab') || v.includes('in lab') || v.includes('lab')) return 'In-Lab';
    return 'Outsource';
}

function ageGroup(age) {
    const cleaned = String(age ?? '').replace(/[^0-9.]/g, '').trim();
    if (!cleaned) return 'Unknown';
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return 'Unknown';
    if (n <= 15) return '0-15';
    if (n <= 35) return '16-35';
    if (n <= 55) return '36-55';
    return '56+';
}

function normalizeTimeSlot(slot) {
    const s = String(slot || '').trim();
    if (s.includes('08:00-16:00') || s.toLowerCase().includes('morning')) return '08:00-16:00';
    if (s.includes('16:00-21:00') || s.toLowerCase().includes('evening')) return '16:00-21:00';
    if (s.includes('21:00-08:00') || s.toLowerCase().includes('night')) return '21:00-08:00';
    return s || 'Unknown';
}

function parseOrderTestItems(order) {
    const raw = order?.test_items;
    if (!raw) return [];
    let items = raw;
    if (typeof raw === 'string') {
        try { items = JSON.parse(raw); } catch { items = raw.split(',').map(name => ({ name: name.trim() })).filter(x => x.name); }
    }
    if (!Array.isArray(items)) return [];
    return items.map(item => ({
        test_name: item.test_name || item.name || item.label || 'Unspecified Test',
        category: item.category || order.category || 'Other',
        test_type: item.test_type || order.test_type || 'Normal',
        revenue: Number(item.price ?? item.total_price ?? item.amount ?? 0) || 0
    })).filter(x => x.test_name);
}

function orderItemRevenue(order) {
    if (order?._orderRevenue != null) return Number(order.total_price ?? order._orderRevenue) || 0;
    const items = parseOrderTestItems(order);
    const itemTotal = items.reduce((s, x) => s + (Number(x.revenue) || 0), 0);
    if (order?.test_name && Number(order.price) > 0) return Number(order.price) || 0;
    return itemTotal || Number(order.price) || Number(order.total_price) || 0;
}

function percentLabel(value, total) {
    const pct = total ? ((Number(value) || 0) / total * 100) : 0;
    return `${pct.toFixed(pct === 100 ? 0 : 1)}%`;
}

function chartPointLabel(label, value, total) {
    return `${label}: ${Number(value || 0).toLocaleString()} (${percentLabel(value, total)})`;
}

function compactChartValue(value, isCount = false) {
    const n = Number(value) || 0;
    if (isCount) return Math.round(n).toLocaleString();
    const abs = Math.abs(n);
    if (abs >= 1000000) return `₭${(n / 1000000).toFixed(abs >= 10000000 ? 0 : 1)}M`;
    if (abs >= 1000) return `₭${(n / 1000).toFixed(abs >= 100000 ? 0 : 1)}K`;
    return formatKip(n);
}

function buildDashboardTestRows(orders, results, testMaster) {
    const masterMap = new Map((testMaster || []).map(t => [String(t.name).trim(), t]));
    const resultGroups = {};
    (results || []).forEach(r => {
        if (!r.order_id || !r.test_name) return;
        if (!resultGroups[r.order_id]) resultGroups[r.order_id] = [];
        if (!resultGroups[r.order_id].some(x => x.test_name === r.test_name)) resultGroups[r.order_id].push(r);
    });

    const rows = [];
    orders.forEach(order => {
        const itemRows = parseOrderTestItems(order);
        if (itemRows.length) {
            itemRows.forEach(item => {
                let revenue = Number(item.revenue) || 0;
                if (revenue === 0) {
                    const m = masterMap.get(String(item.test_name).trim());
                    if (m) revenue = Number(m.price) || 0;
                }
                // fallback if still 0
                if (revenue === 0) {
                    revenue = (Number(order.total_price) || 0) / itemRows.length;
                }
                rows.push({
                    order_id: order.order_id,
                    test_name: item.test_name,
                    category: item.category,
                    test_type: item.test_type,
                    revenue: revenue
                });
            });
            return;
        }

        if (order.test_name) {
            const m = masterMap.get(String(order.test_name).trim());
            let revenue = Number(order.price) || 0;
            if (revenue === 0 && m) revenue = Number(m.price) || 0;
            if (revenue === 0) revenue = Number(order.total_price) || 0;
            rows.push({
                order_id: order.order_id,
                test_name: order.test_name,
                category: order.category || m?.category || 'Other',
                test_type: order.test_type || 'Normal',
                revenue
            });
            return;
        }

        const items = resultGroups[order.order_id] || [];
        if (items.length) {
            items.forEach(item => {
                const m = masterMap.get(String(item.test_name).trim());
                let revenue = m ? (Number(m.price) || 0) : 0;
                if (revenue === 0) {
                   revenue = (Number(order.total_price) || 0) / items.length;
                }
                rows.push({
                    order_id: order.order_id,
                    test_name: item.test_name,
                    category: order.category || 'Other',
                    test_type: order.test_type || 'Normal',
                    revenue: revenue
                });
            });
            return;
        }

        rows.push({
            order_id: order.order_id,
            test_name: order.test_name || order.category || 'Unspecified Test',
            category: order.category || 'Other',
            test_type: order.test_type || 'Normal',
            revenue: Number(order.total_price) || 0
        });
    });
    return rows;
}

function calculateDashboardAnalytics(orders, testRows) {
    const totalRevenue = orders.reduce((s, o) => s + orderItemRevenue(o), 0);
    const labRevenue = {};
    orders.forEach(o => {
        const key = normalizeLabDest(o.lab_dest);
        labRevenue[key] = (labRevenue[key] || 0) + orderItemRevenue(o);
    });
    const timeLabels = ['08:00-16:00', '16:00-21:00', '21:00-08:00', 'Unknown'];
    const timeSlots = timeLabels.map(label => {
        const slotOrders = orders.filter(o => normalizeTimeSlot(o.time_slot) === label);
        const revenue = slotOrders.reduce((s, o) => s + orderItemRevenue(o), 0);
        return { label, count: slotOrders.length, revenue, avg: slotOrders.length ? revenue / slotOrders.length : 0 };
    }).filter(x => x.count > 0 || x.label !== 'Unknown');

    const ageLabels = ['0-15', '16-35', '36-55', '56+', 'Unknown'];
    const ageGroups = ageLabels.map(label => {
        const rows = orders.filter(o => ageGroup(o.age) === label);
        return { label, count: rows.length, revenue: rows.reduce((s, o) => s + orderItemRevenue(o), 0) };
    }).filter(x => x.count > 0 || x.label !== 'Unknown');

    const summaryMap = new Map();
    testRows.forEach(row => {
        const key = `${row.category}|||${row.test_name}`;
        if (!summaryMap.has(key)) summaryMap.set(key, { category: row.category, test_name: row.test_name, normal: 0, package: 0, count: 0, revenue: 0 });
        const item = summaryMap.get(key);
        item.count += 1;
        item.revenue += Number(row.revenue) || 0;
        if (String(row.test_type).toLowerCase() === 'package') item.package += 1;
        else item.normal += 1;
    });
    const testSummary = [...summaryMap.values()].sort((a, b) => b.revenue - a.revenue || b.count - a.count);

    return {
        kpis: {
            totalOrders: orders.length,
            totalPatients: new Set(orders.map(o => o.patient_id).filter(Boolean)).size,
            totalRevenue,
            inLabRevenue: labRevenue['In-Lab'] || 0,
            outLabRevenue: labRevenue['Outsource'] || 0
        },
        gender: groupCount(orders, o => normalizeGender(o.gender)),
        insite: groupCount(orders, o => normalizeInsite(o.insite)),
        visitType: groupCount(orders, o => o.visit_type || 'Unknown'),
        testType: groupCount(orders, o => o.test_type || 'Normal'),
        labType: groupCount(orders, o => normalizeLabDest(o.lab_dest)),
        doctorRevenue: groupRevenue(orders, normalizeDoctorName),
        deptRevenue: groupRevenue(orders, o => o.department || 'Unknown'),
        ageGroups,
        timeSlots,
        testSummary,
        categorySummary: summarizeBy(testRows, 'category')
    };
}

function summarizeBy(rows, key) {
    const map = new Map();
    rows.forEach(r => {
        const label = r[key] || 'Other';
        if (!map.has(label)) map.set(label, { name: label, count: 0, revenue: 0 });
        const item = map.get(label);
        item.count += 1;
        item.revenue += Number(r.revenue) || 0;
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue || b.count - a.count);
}

function renderDashboardKpis(analytics) {
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.innerText = value; };
    set('kpiPatients', analytics.kpis.totalOrders.toLocaleString());
    set('kpiRev', analytics.kpis.totalRevenue.toLocaleString());
    set('kpiInLab', analytics.kpis.inLabRevenue.toLocaleString());
    set('kpiOutLab', analytics.kpis.outLabRevenue.toLocaleString());
}

function renderChart(id, type, labels, data, label, colors) {
    const canvas = document.getElementById(id);
    if (!canvas || typeof Chart === 'undefined') return;
    if (window.ChartDataLabels && !Chart.registry.plugins.get('datalabels')) {
        Chart.register(window.ChartDataLabels);
    }
    if (dashboardCharts[id]) dashboardCharts[id].destroy();
    const isPie = type === 'pie' || type === 'doughnut';
    const isCountChart = label === 'Patients' || label === 'Orders' || label === 'Count';
    const formatChartValue = (value) => isCountChart ? Number(value || 0).toLocaleString() : formatKip(value);
    const formatCompactValue = (value) => compactChartValue(value, isCountChart || isPie);
    const total = data.reduce((s, v) => s + (Number(v) || 0), 0);
    const maxValue = Math.max(...data.map(v => Number(v) || 0), 0);
    const isCompactPie = isPie && id !== 'chartLabType';
    const chartType = isPie ? 'doughnut' : type;
    const centerTotalPlugin = {
        id: `dashboardCenterTotal-${id}`,
        afterDraw(chart) {
            if (!isPie || !total) return;
            const meta = chart.getDatasetMeta(0);
            const arc = meta?.data?.[0];
            const { ctx, chartArea } = chart;
            const x = arc?.x ?? ((chartArea.left + chartArea.right) / 2);
            const y = arc?.y ?? ((chartArea.top + chartArea.bottom) / 2);
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#6b7280';
            ctx.font = '700 11px "Noto Sans Lao", Arial, sans-serif';
            ctx.fillText('Total', x, y - 8);
            ctx.fillStyle = '#111827';
            ctx.font = '800 17px "Noto Sans Lao", Arial, sans-serif';
            ctx.fillText(formatCompactValue(total), x, y + 10);
            ctx.restore();
        }
    };

    dashboardCharts[id] = new Chart(canvas, {
        type: chartType,
        data: {
            labels,
            datasets: [{
                label,
                data,
                backgroundColor: colors,
                borderColor: '#ffffff',
                borderWidth: isPie ? 2 : 0,
                hoverBorderWidth: isPie ? 2 : 0,
                maxBarThickness: id === 'chartTimeSlot' ? 42 : 34,
                borderRadius: isPie ? 0 : 4
            }]
        },
        plugins: isPie ? [centerTotalPlugin] : [],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: isPie ? '58%' : undefined,
            layout: { padding: isPie ? { top: 12, right: 14, bottom: 34, left: 14 } : { top: 40, right: 14, bottom: 8, left: 8 } },
            plugins: {
                legend: {
                    display: isPie && labels.length > 1,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        boxWidth: 7,
                        boxHeight: 7,
                        padding: 10,
                        color: '#475569',
                        font: { size: 11, weight: '700' }
                    }
                },
                tooltip: {
                    callbacks: {
                        label(ctx) {
                            const value = Number(ctx.raw || 0);
                            return isPie ? chartPointLabel(ctx.label, value, total) : `${ctx.label}: ${formatChartValue(value)}`;
                        }
                    }
                },
                datalabels: {
                    display: (ctx) => {
                        const value = Number(ctx.dataset.data[ctx.dataIndex]) || 0;
                        if (!value) return false;
                        if (!isPie) return true;
                        const pct = total ? (value / total * 100) : 0;
                        return labels.length <= 3 || pct >= 8;
                    },
                    color: isPie ? '#ffffff' : '#1f2937',
                    backgroundColor: isPie ? 'rgba(49,46,129,0.82)' : 'rgba(255,255,255,0.94)',
                    borderColor: isPie ? 'rgba(255,255,255,0.55)' : 'rgba(124,58,237,0.22)',
                    borderWidth: 1,
                    borderRadius: 6,
                    padding: { top: 3, bottom: 3, left: 5, right: 5 },
                    clamp: true,
                    clip: false,
                    anchor: isPie ? 'center' : 'end',
                    align: isPie ? (isCompactPie ? 'center' : 'bottom') : 'top',
                    offset: isPie ? 0 : 10,
                    textAlign: 'center',
                    font: { size: isPie ? 10 : 12, weight: '800' },
                    formatter(value, ctx) {
                        const lbl = ctx.chart.data.labels[ctx.dataIndex];
                        return isPie ? `${lbl} ${formatCompactValue(value)}\n${percentLabel(value, total)}` : formatCompactValue(value);
                    }
                }
            },
            scales: isPie ? {} : {
                y: {
                    beginAtZero: true,
                    suggestedMax: maxValue > 0 ? maxValue * 1.22 : undefined,
                    grace: '18%',
                    ticks: { font: { size: 11, weight: '600' }, precision: 0, callback: v => formatCompactValue(v) },
                    grid: { color: 'rgba(148,163,184,0.18)' }
                },
                x: { ticks: { font: { size: 11, weight: '600' }, maxRotation: 0, autoSkip: true }, grid: { display: false } }
            }
        }
    });
}

function renderDashboardCharts(analytics) {
    const palette = ['#2563eb', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#64748b'];
    renderObjectPie('chartGender', analytics.gender, 'Gender', ['#2563eb', '#ec4899', '#94a3b8']);
    renderObjectPie('chartInsite', analytics.insite, 'Insite', ['#10b981', '#f97316', '#94a3b8']);
    renderObjectPie('chartVisitType', analytics.visitType, 'Visit Type', palette);
    renderObjectPie('chartTestType', analytics.testType, 'Test Type', ['#6366f1', '#f59e0b', '#94a3b8']);
    renderObjectPie('chartLabType', analytics.labType, 'In-Lab vs Outsource', ['#16a34a', '#dc2626']);
    renderObjectBar('chartDoctor', topEntries(analytics.doctorRevenue, 8), 'Revenue', palette);
    renderObjectBar('chartDept', topEntries(analytics.deptRevenue, 8), 'Revenue', palette);
    renderChart('chartAgeGroups', 'bar', analytics.ageGroups.map(x => x.label), analytics.ageGroups.map(x => x.count), 'Patients', ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#94a3b8']);
}

function topEntries(obj, limit) {
    return Object.fromEntries(Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limit));
}

function renderObjectPie(id, obj, label, colors) {
    if (!obj || typeof obj !== 'object') return;
    const entries = Object.entries(obj).filter(([k, v]) => v > 0);
    if (entries.length === 0) return;
    renderChart(id, 'pie', entries.map(([k]) => k), entries.map(([, v]) => v), label, colors);
}

function renderObjectBar(id, obj, label, colors) {
    if (!obj || typeof obj !== 'object') return;
    const entries = Object.entries(obj).filter(([, v]) => v > 0);
    if (entries.length === 0) return;
    renderChart(id, 'bar', entries.map(([k]) => k), entries.map(([, v]) => Math.round(v)), label, colors);
}

function renderTimeSlotReport(mode = 'all') {
    dashboardState.timeSlotMode = mode;
    const slotMap = { morning: '08:00-16:00', evening: '16:00-21:00', night: '21:00-08:00' };
    const rows = mode === 'all' ? dashboardState.analytics.timeSlots : dashboardState.analytics.timeSlots.filter(x => x.label === slotMap[mode]);
    renderChart('chartTimeSlot', 'bar', rows.map(x => x.label), rows.map(x => x.revenue), 'Revenue', ['#2563eb', '#10b981', '#f59e0b', '#ef4444']);
    const body = document.getElementById('timeSlotSummaryBody');
    const foot = document.getElementById('timeSlotSummaryFoot');
    if (body) body.innerHTML = rows.map(r => `<tr><td>${escapeHtml(r.label)}</td><td class="text-center">${r.count.toLocaleString()}</td><td class="text-end">${formatKip(r.revenue)}</td><td class="text-end">${formatKip(r.avg)}</td></tr>`).join('');
    if (foot) {
        const count = rows.reduce((s, r) => s + r.count, 0);
        const rev = rows.reduce((s, r) => s + r.revenue, 0);
        foot.innerHTML = `<tr class="table-light fw-bold"><td>Total</td><td class="text-center">${count.toLocaleString()}</td><td class="text-end">${formatKip(rev)}</td><td class="text-end">${formatKip(count ? rev / count : 0)}</td></tr>`;
    }
}

window.loadTimeSlotReport = renderTimeSlotReport;

function renderAgeGroupsTable(rows) {
    const body = document.getElementById('ageGroupsSummaryBody');
    const foot = document.getElementById('ageGroupsSummaryFoot');
    if (body) body.innerHTML = rows.map(r => `<tr><td class="text-center">${escapeHtml(r.label)}</td><td class="text-center">${r.count.toLocaleString()}</td><td class="text-end">${formatKip(r.revenue)}</td></tr>`).join('');
    if (foot) foot.innerHTML = `<tr class="table-light fw-bold"><td class="text-center">Total</td><td class="text-center">${rows.reduce((s, r) => s + r.count, 0).toLocaleString()}</td><td class="text-end">${formatKip(rows.reduce((s, r) => s + r.revenue, 0))}</td></tr>`;
}

function renderTopTables(analytics) {
    const tests = analytics.testSummary.slice(0, 5).map((x, i) => ({ rank: i + 1, name: x.test_name, count: x.count, revenue: x.revenue }));
    const cats = analytics.categorySummary.slice(0, 5).map((x, i) => ({ rank: i + 1, name: x.name, count: x.count, revenue: x.revenue }));
    renderRankTable('topTestsBody', tests);
    renderRankTable('topCatsBody', cats);
}

function renderRankTable(id, rows) {
    const body = document.getElementById(id);
    if (!body) return;
    body.innerHTML = rows.map(r => `<tr><td class="ps-3">${r.rank}</td><td>${escapeHtml(r.name)}</td><td class="text-center">${r.count.toLocaleString()}</td><td class="text-end pe-3">${formatKip(r.revenue)}</td></tr>`).join('');
}

function renderDashboardSummaryTable(rows) {
    const body = document.getElementById('dashboardSummaryBody');
    const foot = document.getElementById('dashboardSummaryFoot');
    if (body) body.innerHTML = rows.map(r => `<tr><td>${escapeHtml(r.category)}</td><td>${escapeHtml(r.test_name)}</td><td class="text-center">${r.normal.toLocaleString()}</td><td class="text-center">${r.package.toLocaleString()}</td><td class="text-end">${formatKip(r.revenue)}</td></tr>`).join('');
    if (foot) foot.innerHTML = `<tr class="table-light fw-bold"><td colspan="2">Total</td><td class="text-center">${rows.reduce((s, r) => s + r.normal, 0).toLocaleString()}</td><td class="text-center">${rows.reduce((s, r) => s + r.package, 0).toLocaleString()}</td><td class="text-end">${formatKip(rows.reduce((s, r) => s + r.revenue, 0))}</td></tr>`;
}

window.toggleSummaryTableDashboard = () => {
    const container = document.getElementById('dashboardSummaryTableContainer');
    const text = document.getElementById('summaryTableTextDash');
    if (!container) return;
    container.style.display = 'block';
    if (text) text.innerText = 'Always On';
};

window.resetDashboardFilters = () => {
    ['dashStartDate','dashEndDate','dashDepartment','dashDoctor','dashTestType','dashCategory'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    loadDashboard();
};

window.setDashDate = (period) => {
    const now = new Date();
    const start = new Date(now);
    if (period === 'today') start.setHours(0, 0, 0, 0);
    if (period === 'week') start.setDate(now.getDate() - 6);
    if (period === 'month') start.setDate(1);
    if (period === 'year') { start.setMonth(0); start.setDate(1); }
    const s = document.getElementById('dashStartDate');
    const e = document.getElementById('dashEndDate');
    if (s) s.value = localDateString(start);
    if (e) e.value = localDateString(now);
    loadDashboard();
};

window.exportDashboardPDF = async () => {
    if (!dashboardState.analytics) await loadDashboard();
    
    // Check if html2pdf is available
    if (!window.html2pdf) {
        return Swal.fire('PDF Error', 'html2pdf library is not loaded', 'error');
    }

    try {
        // Show loading indicator
        Swal.fire({
            title: 'Generating PDF...',
            html: 'Please wait while we create your dashboard report',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // Create a temporary container for PDF content
        const pdfContainer = document.createElement('div');
        pdfContainer.style.position = 'absolute';
        pdfContainer.style.left = '-9999px';
        pdfContainer.style.width = '1200px';
        pdfContainer.style.backgroundColor = '#ffffff';
        pdfContainer.style.padding = '40px';
        pdfContainer.style.fontFamily = 'Arial, sans-serif';
        document.body.appendChild(pdfContainer);

        const start = document.getElementById('dashStartDate')?.value || 'All';
        const end = document.getElementById('dashEndDate')?.value || 'All';
        const analytics = dashboardState.analytics;

        // Helper function to format currency as text
        const formatKipText = (value) => {
            const amount = Math.abs(Math.round(Number(value) || 0));
            return `Kip ${amount.toLocaleString()}`;
        };

        // Build PDF HTML content
        pdfContainer.innerHTML = `
            <div style="font-family: 'Noto Sans Lao', Arial, sans-serif;">
                <!-- Header -->
                <div style="background: #1e293b; color: white; padding: 20px; margin-bottom: 30px; border-radius: 8px;">
                    <h1 style="margin: 0 0 10px 0; font-size: 28px;">LIS-One Dashboard Report</h1>
                    <div style="display: flex; justify-content: space-between; font-size: 14px;">
                        <div>
                            <div>Period: ${escapeHtml(start)} to ${escapeHtml(end)}</div>
                            <div>Generated: ${new Date().toLocaleString()}</div>
                        </div>
                        <div style="text-align: right;">
                            <div>Total Orders: ${analytics.kpis.totalOrders.toLocaleString()}</div>
                            <div>Total Revenue: ₭ ${formatPrice(analytics.kpis.totalRevenue)}</div>
                        </div>
                    </div>
                </div>

                <!-- KPI Cards -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px;">
                    <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px;">
                        <div style="font-size: 12px; margin-bottom: 8px;">ORDERS</div>
                        <div style="font-size: 24px; font-weight: bold;">${analytics.kpis.totalOrders.toLocaleString()}</div>
                    </div>
                    <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px;">
                        <div style="font-size: 12px; margin-bottom: 8px;">TOTAL REVENUE</div>
                        <div style="font-size: 20px; font-weight: bold;">₭ ${formatPrice(analytics.kpis.totalRevenue)}</div>
                    </div>
                    <div style="background: #6366f1; color: white; padding: 20px; border-radius: 8px;">
                        <div style="font-size: 12px; margin-bottom: 8px;">IN-LAB</div>
                        <div style="font-size: 20px; font-weight: bold;">₭ ${formatPrice(analytics.kpis.inLabRevenue)}</div>
                    </div>
                    <div style="background: #ef4444; color: white; padding: 20px; border-radius: 8px;">
                        <div style="font-size: 12px; margin-bottom: 8px;">OUTSOURCE</div>
                        <div style="font-size: 20px; font-weight: bold;">₭ ${formatPrice(analytics.kpis.outLabRevenue)}</div>
                    </div>
                </div>

                <!-- Charts Section -->
                <div style="margin-bottom: 30px;">
                    <h2 style="font-size: 18px; color: #1e293b; margin-bottom: 15px;">Analytics Charts</h2>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px;">
                        ${await captureChartAsImage('chartGender', 'Gender Distribution')}
                        ${await captureChartAsImage('chartInsite', 'OPD vs IPD')}
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
                        ${await captureChartAsImage('chartLabType', 'In-Lab vs Outsource')}
                        ${await captureChartAsImage('chartAgeGroups', 'Age Groups')}
                    </div>
                </div>

                <!-- Summary Table -->
                <div style="margin-top: 30px; page-break-before: always;">
                    <h2 style="font-size: 18px; color: #1e293b; margin-bottom: 15px;">Summary Report Table</h2>
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead>
                            <tr style="background: #1e293b; color: white;">
                                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Category</th>
                                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Test Name</th>
                                <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">Normal</th>
                                <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">Package</th>
                                <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">Total</th>
                                <th style="padding: 10px; text-align: right; border: 1px solid #ddd;">Revenue</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${analytics.testSummary.map((r, i) => `
                                <tr style="background: ${i % 2 === 0 ? '#f8fafc' : 'white'};">
                                    <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(r.category)}</td>
                                    <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(r.test_name)}</td>
                                    <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${r.normal}</td>
                                    <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${r.package}</td>
                                    <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${r.count}</td>
                                    <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">₭ ${formatPrice(r.revenue)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr style="background: #e2e8f0; font-weight: bold;">
                                <td colspan="2" style="padding: 10px; border: 1px solid #ddd;">TOTAL</td>
                                <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${analytics.testSummary.reduce((s, r) => s + r.normal, 0)}</td>
                                <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${analytics.testSummary.reduce((s, r) => s + r.package, 0)}</td>
                                <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${analytics.testSummary.reduce((s, r) => s + r.count, 0)}</td>
                                <td style="padding: 10px; text-align: right; border: 1px solid #ddd;">₭ ${formatPrice(analytics.testSummary.reduce((s, r) => s + r.revenue, 0))}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;

        // Generate PDF using html2pdf
        const opt = {
            margin: 10,
            filename: `Dashboard-Report-${new Date().toISOString().slice(0, 10)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2,
                useCORS: true,
                logging: false,
                letterRendering: true
            },
            jsPDF: { 
                unit: 'mm', 
                format: 'a4', 
                orientation: 'landscape' 
            },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        await html2pdf().set(opt).from(pdfContainer).save();

        // Clean up
        document.body.removeChild(pdfContainer);

        Swal.fire({
            icon: 'success',
            title: 'PDF Generated!',
            text: 'Your dashboard report has been downloaded',
            timer: 2000,
            showConfirmButton: false
        });

    } catch (error) {
        console.error('PDF Export Error:', error);
        Swal.fire('Error', 'Failed to generate PDF: ' + error.message, 'error');
    }
};

window.exportDashboardPDF = async () => {
    if (!dashboardState.analytics) await loadDashboard();
    if (!window.html2pdf) {
        return Swal.fire('PDF Error', 'html2pdf library is not loaded', 'error');
    }

    const analytics = dashboardState.analytics;
    const start = document.getElementById('dashStartDate')?.value || 'All';
    const end = document.getElementById('dashEndDate')?.value || 'All';
    const chartImg = (id) => {
        const canvas = document.getElementById(id);
        return canvas ? canvas.toDataURL('image/png', 1.0) : '';
    };
    const summaryRows = analytics.testSummary || [];
    const mid = Math.ceil(summaryRows.length / 2);
    const renderSummaryRows = (rows, offset = 0) => rows.map((r, i) => `
        <tr>
            <td>${offset + i + 1}</td>
            <td>${escapeHtml(r.category)}</td>
            <td>${escapeHtml(r.test_name)}</td>
            <td class="num">${r.count.toLocaleString()}</td>
            <td class="num">${formatPrice(r.revenue)}</td>
        </tr>
    `).join('');

    const pdfContainer = document.createElement('div');
    pdfContainer.className = 'dashboard-pdf-export';
    pdfContainer.style.position = 'absolute';
    pdfContainer.style.left = '0';
    pdfContainer.style.top = '0';
    pdfContainer.style.zIndex = '2147483647';
    pdfContainer.style.pointerEvents = 'none';
    pdfContainer.innerHTML = `
        <style>
            .dashboard-pdf-export { width: 297mm; background: #fff; color: #111827; font-family: 'Noto Sans Lao', Arial, sans-serif; }
            .pdf-page { width: 297mm; height: 210mm; box-sizing: border-box; padding: 8mm; background: #fff; overflow: hidden; page-break-after: always; }
            .pdf-page:last-child { page-break-after: auto; }
            .pdf-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e5e7eb; padding-bottom: 4mm; margin-bottom: 4mm; }
            .pdf-title { font-size: 12px; font-weight: 800; margin: 0; color: #111827; }
            .pdf-meta { font-size: 8px; color: #4b5563; line-height: 1.45; text-align: right; }
            .pdf-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-bottom: 4mm; }
            .pdf-kpi { border: 1px solid #e9d5ff; background: #faf5ff; border-radius: 3mm; padding: 3mm; }
            .pdf-kpi .label { font-size: 7px; color: #6b7280; font-weight: 700; }
            .pdf-kpi .value { font-size: 12px; color: #111827; font-weight: 800; margin-top: 1mm; }
            .pdf-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
            .pdf-chart { border: 1px solid #e5e7eb; border-radius: 3mm; padding: 2mm; height: 52mm; box-sizing: border-box; overflow: hidden; }
            .pdf-chart-title { font-size: 8px; font-weight: 800; margin-bottom: 1mm; }
            .pdf-chart img { width: 100%; height: 42mm; object-fit: contain; display: block; }
            .pdf-summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
            .pdf-summary-title { font-size: 12px; font-weight: 800; margin: 0 0 3mm 0; }
            .pdf-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 6.2px; }
            .pdf-table th { background: #1f2937; color: #fff; border: 0.2mm solid #d1d5db; padding: 1.1mm; text-align: left; }
            .pdf-table td { border: 0.2mm solid #e5e7eb; padding: 0.95mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .pdf-table .num { text-align: right; font-weight: 700; }
            .pdf-total { margin-top: 3mm; font-size: 8px; font-weight: 800; text-align: right; }
        </style>
        <section class="pdf-page">
            <div class="pdf-head">
                <div>
                    <h1 class="pdf-title">LIS-One Dashboard Report</h1>
                    <div class="pdf-meta" style="text-align:left;">Period: ${escapeHtml(start)} to ${escapeHtml(end)}</div>
                </div>
                <div class="pdf-meta">Generated: ${new Date().toLocaleString()}<br>Format: A4 Landscape / 2 Pages</div>
            </div>
            <div class="pdf-kpis">
                <div class="pdf-kpi"><div class="label">ORDERS</div><div class="value">${analytics.kpis.totalOrders.toLocaleString()}</div></div>
                <div class="pdf-kpi"><div class="label">TOTAL REVENUE</div><div class="value">₭ ${formatPrice(analytics.kpis.totalRevenue)}</div></div>
                <div class="pdf-kpi"><div class="label">IN-LAB</div><div class="value">₭ ${formatPrice(analytics.kpis.inLabRevenue)}</div></div>
                <div class="pdf-kpi"><div class="label">OUTSOURCE</div><div class="value">₭ ${formatPrice(analytics.kpis.outLabRevenue)}</div></div>
            </div>
            <div class="pdf-grid">
                <div class="pdf-chart"><div class="pdf-chart-title">Time Slot Revenue</div><img src="${chartImg('chartTimeSlot')}"></div>
                <div class="pdf-chart"><div class="pdf-chart-title">Doctor Revenue</div><img src="${chartImg('chartDoctor')}"></div>
                <div class="pdf-chart"><div class="pdf-chart-title">Age Groups</div><img src="${chartImg('chartAgeGroups')}"></div>
                <div class="pdf-chart"><div class="pdf-chart-title">Gender</div><img src="${chartImg('chartGender')}"></div>
                <div class="pdf-chart"><div class="pdf-chart-title">Visit Type</div><img src="${chartImg('chartVisitType')}"></div>
                <div class="pdf-chart"><div class="pdf-chart-title">In-Lab vs Outsource</div><img src="${chartImg('chartLabType')}"></div>
            </div>
        </section>
        <section class="pdf-page">
            <div class="pdf-head">
                <h2 class="pdf-summary-title">Summary Report</h2>
                <div class="pdf-meta">Total Rows: ${summaryRows.length.toLocaleString()}<br>Total Revenue: ₭ ${formatPrice(summaryRows.reduce((s, r) => s + r.revenue, 0))}</div>
            </div>
            <div class="pdf-summary-grid">
                <table class="pdf-table">
                    <thead><tr><th style="width:8mm;">#</th><th style="width:24mm;">Category</th><th>Test</th><th style="width:14mm;">Qty</th><th style="width:23mm;">Revenue</th></tr></thead>
                    <tbody>${renderSummaryRows(summaryRows.slice(0, mid), 0)}</tbody>
                </table>
                <table class="pdf-table">
                    <thead><tr><th style="width:8mm;">#</th><th style="width:24mm;">Category</th><th>Test</th><th style="width:14mm;">Qty</th><th style="width:23mm;">Revenue</th></tr></thead>
                    <tbody>${renderSummaryRows(summaryRows.slice(mid), mid)}</tbody>
                </table>
            </div>
            <div class="pdf-total">TOTAL: ₭ ${formatPrice(summaryRows.reduce((s, r) => s + r.revenue, 0))}</div>
        </section>
    `;

    try {
        Swal.fire({ title: 'Generating PDF...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        document.body.appendChild(pdfContainer);
        await html2pdf().set({
            margin: 0,
            filename: `Dashboard-Report-${new Date().toISOString().slice(0, 10)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        }).from(pdfContainer).save();
        Swal.fire({ icon: 'success', title: 'PDF Generated!', timer: 1800, showConfirmButton: false });
    } catch (error) {
        console.error('PDF Export Error:', error);
        Swal.fire('Error', 'Failed to generate PDF: ' + error.message, 'error');
    } finally {
        pdfContainer.remove();
    }
};

// Helper function to capture chart as image
async function captureChartAsImage(canvasId, title) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        return `<div style="border: 1px solid #ddd; padding: 20px; text-align: center; background: #f8fafc; border-radius: 8px;">
            <div style="font-weight: bold; margin-bottom: 10px;">${title}</div>
            <div style="color: #64748b;">Chart not available</div>
        </div>`;
    }
    
    try {
        const imageData = canvas.toDataURL('image/png', 1.0);
        return `<div style="border: 1px solid #ddd; padding: 15px; background: white; border-radius: 8px; text-align: center;">
            <div style="font-weight: bold; margin-bottom: 10px; color: #1e293b;">${title}</div>
            <div style="width: 500px; height: 300px; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
                <img src="${imageData}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
            </div>
        </div>`;
    } catch (error) {
        console.error(`Error capturing ${canvasId}:`, error);
        return `<div style="border: 1px solid #ddd; padding: 20px; text-align: center; background: #f8fafc; border-radius: 8px;">
            <div style="font-weight: bold; margin-bottom: 10px;">${title}</div>
            <div style="color: #ef4444;">Error capturing chart</div>
        </div>`;
    }
}

window.exportDashboardPDF = async () => {
    if (!dashboardState.analytics) await loadDashboard();
    if (!window.html2pdf) {
        return Swal.fire('PDF Error', 'html2pdf library is not loaded', 'error');
    }

    const analytics = dashboardState.analytics;
    const start = document.getElementById('dashStartDate')?.value || 'All';
    const end = document.getElementById('dashEndDate')?.value || 'All';
    const summaryRows = analytics.testSummary || [];
    const summaryTotal = summaryRows.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
    const mid = Math.ceil(summaryRows.length / 2);
    const chartImg = (id) => {
        const canvas = document.getElementById(id);
        return canvas ? canvas.toDataURL('image/png', 1.0) : '';
    };
    const renderSummaryRows = (rows, offset = 0) => rows.map((r, i) => `
        <tr>
            <td>${offset + i + 1}</td>
            <td>${escapeHtml(r.category || '')}</td>
            <td>${escapeHtml(r.test_name || '')}</td>
            <td class="num">${(Number(r.count) || 0).toLocaleString()}</td>
            <td class="num">Kip ${formatPrice(r.revenue || 0)}</td>
        </tr>
    `).join('');

    const pdfContainer = document.createElement('div');
    pdfContainer.className = 'dashboard-pdf-export';
    pdfContainer.style.position = 'fixed';
    pdfContainer.style.left = '-10000px';
    pdfContainer.style.top = '0';
    pdfContainer.innerHTML = `
        <style>
            .dashboard-pdf-export { width: 297mm; background: #fff; color: #111827; font-family: 'Noto Sans Lao', Arial, sans-serif; }
            .pdf-page { width: 297mm; height: 210mm; box-sizing: border-box; padding: 7mm; background: #fff; overflow: hidden; page-break-after: always; break-after: page; }
            .pdf-page:last-child { page-break-after: auto; break-after: auto; }
            .pdf-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #d1d5db; padding-bottom: 3mm; margin-bottom: 3mm; }
            .pdf-title, .pdf-summary-title { font-size: 16px; font-weight: 800; margin: 0; color: #111827; line-height: 1.25; }
            .pdf-meta { font-size: 12px; color: #4b5563; line-height: 1.35; text-align: right; }
            .pdf-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-bottom: 3mm; }
            .pdf-kpi { border: 1px solid #dbeafe; background: #eff6ff; border-radius: 2mm; padding: 2.4mm; }
            .pdf-kpi .label { font-size: 12px; color: #4b5563; font-weight: 700; line-height: 1.2; }
            .pdf-kpi .value { font-size: 16px; color: #111827; font-weight: 800; margin-top: 1mm; line-height: 1.15; }
            .pdf-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
            .pdf-chart { border: 1px solid #e5e7eb; border-radius: 2mm; padding: 2mm; height: 76mm; box-sizing: border-box; overflow: hidden; page-break-inside: avoid; break-inside: avoid; }
            .pdf-chart-title { font-size: 16px; font-weight: 800; margin-bottom: 1mm; line-height: 1.2; }
            .pdf-chart img { width: 100%; height: 61mm; object-fit: contain; display: block; }
            .pdf-summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
            .pdf-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; line-height: 1.15; }
            .pdf-table th { background: #1f2937; color: #fff; border: 0.2mm solid #d1d5db; padding: 1mm; text-align: left; font-size: 12px; }
            .pdf-table td { border: 0.2mm solid #e5e7eb; padding: 0.7mm 0.9mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; }
            .pdf-table .num { text-align: right; font-weight: 700; }
            .pdf-total { margin-top: 3mm; font-size: 16px; font-weight: 800; text-align: right; }
        </style>
        <section class="pdf-page">
            <div class="pdf-head">
                <div>
                    <h1 class="pdf-title">LIS-One Dashboard Report</h1>
                    <div class="pdf-meta" style="text-align:left;">Period: ${escapeHtml(start)} to ${escapeHtml(end)}</div>
                </div>
                <div class="pdf-meta">Generated: ${new Date().toLocaleString()}<br>Format: A4 Landscape / 2 Pages</div>
            </div>
            <div class="pdf-kpis">
                <div class="pdf-kpi"><div class="label">ORDERS</div><div class="value">${analytics.kpis.totalOrders.toLocaleString()}</div></div>
                <div class="pdf-kpi"><div class="label">TOTAL REVENUE</div><div class="value">Kip ${formatPrice(analytics.kpis.totalRevenue)}</div></div>
                <div class="pdf-kpi"><div class="label">IN-LAB</div><div class="value">Kip ${formatPrice(analytics.kpis.inLabRevenue)}</div></div>
                <div class="pdf-kpi"><div class="label">OUTSOURCE</div><div class="value">Kip ${formatPrice(analytics.kpis.outLabRevenue)}</div></div>
            </div>
            <div class="pdf-grid">
                <div class="pdf-chart"><div class="pdf-chart-title">Time Slot Revenue</div><img src="${chartImg('chartTimeSlot')}" alt=""></div>
                <div class="pdf-chart"><div class="pdf-chart-title">Doctor Revenue</div><img src="${chartImg('chartDoctor')}" alt=""></div>
                <div class="pdf-chart"><div class="pdf-chart-title">Age Groups</div><img src="${chartImg('chartAgeGroups')}" alt=""></div>
                <div class="pdf-chart"><div class="pdf-chart-title">Gender</div><img src="${chartImg('chartGender')}" alt=""></div>
                <div class="pdf-chart"><div class="pdf-chart-title">Visit Type</div><img src="${chartImg('chartVisitType')}" alt=""></div>
                <div class="pdf-chart"><div class="pdf-chart-title">In-Lab vs Outsource</div><img src="${chartImg('chartLabType')}" alt=""></div>
            </div>
        </section>
        <section class="pdf-page">
            <div class="pdf-head">
                <h2 class="pdf-summary-title">Summary Report</h2>
                <div class="pdf-meta">Total Rows: ${summaryRows.length.toLocaleString()}<br>Total Revenue: Kip ${formatPrice(summaryTotal)}</div>
            </div>
            <div class="pdf-summary-grid">
                <table class="pdf-table">
                    <thead><tr><th style="width:8mm;">#</th><th style="width:24mm;">Category</th><th>Test</th><th style="width:14mm;">Qty</th><th style="width:29mm;">Revenue</th></tr></thead>
                    <tbody>${renderSummaryRows(summaryRows.slice(0, mid), 0)}</tbody>
                </table>
                <table class="pdf-table">
                    <thead><tr><th style="width:8mm;">#</th><th style="width:24mm;">Category</th><th>Test</th><th style="width:14mm;">Qty</th><th style="width:29mm;">Revenue</th></tr></thead>
                    <tbody>${renderSummaryRows(summaryRows.slice(mid), mid)}</tbody>
                </table>
            </div>
            <div class="pdf-total">TOTAL: Kip ${formatPrice(summaryTotal)}</div>
        </section>
    `;

    try {
        Swal.fire({
            title: 'Generating PDF...',
            html: 'Creating a fixed 2-page dashboard report',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });
        document.body.appendChild(pdfContainer);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await html2pdf().set({
            margin: 0,
            filename: `Dashboard-Report-${new Date().toISOString().slice(0, 10)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                letterRendering: true,
                backgroundColor: '#ffffff',
                scrollX: 0,
                scrollY: 0,
                windowWidth: pdfContainer.scrollWidth,
                windowHeight: pdfContainer.scrollHeight
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape', compress: true },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'], before: '.pdf-page + .pdf-page', avoid: '.pdf-chart, .card, .dashboard-card, .chart-card, canvas, table, .summary-report' }
        }).from(pdfContainer).save();
        Swal.fire({ icon: 'success', title: 'PDF Generated!', timer: 1800, showConfirmButton: false });
    } catch (error) {
        console.error('PDF Export Error:', error);
        Swal.fire('Error', 'Failed to generate PDF: ' + error.message, 'error');
    } finally {
        pdfContainer.remove();
    }
};

window.exportDashboardPDF = async () => {
    if (!dashboardState.analytics) await loadDashboard();
    if (!window.jspdf?.jsPDF) {
        return Swal.fire('PDF Error', 'jsPDF library is not loaded', 'error');
    }

    const analytics = dashboardState.analytics;
    const start = document.getElementById('dashStartDate')?.value || 'All';
    const end = document.getElementById('dashEndDate')?.value || 'All';
    const summaryRows = analytics.testSummary || [];
    const summaryTotal = summaryRows.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0);
    const chartIds = [
        ['chartTimeSlot', 'Time Slot Revenue'],
        ['chartDoctor', 'Doctor Revenue'],
        ['chartAgeGroups', 'Age Groups'],
        ['chartGender', 'Gender'],
        ['chartVisitType', 'Visit Type'],
        ['chartLabType', 'In-Lab vs Outsource']
    ];

    try {
        Swal.fire({
            title: 'Generating PDF...',
            html: 'Creating dashboard report',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 8;
        const contentW = pageW - margin * 2;

        const text = (value, x, y, opts = {}) => doc.text(String(value ?? ''), x, y, opts);
        const box = (x, y, w, h, fill = [255, 255, 255], stroke = [229, 231, 235]) => {
            doc.setFillColor(...fill);
            doc.setDrawColor(...stroke);
            doc.roundedRect(x, y, w, h, 2, 2, 'FD');
        };

        doc.setTextColor(17, 24, 39);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        text('LIS-One Dashboard Report', margin, 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(75, 85, 99);
        text(`Period: ${start} to ${end}`, margin, 21);
        text(`Generated: ${new Date().toLocaleString()}`, pageW - margin, 14, { align: 'right' });
        text('A4 Landscape / 2 Pages', pageW - margin, 21, { align: 'right' });

        const kpis = [
            ['ORDERS', analytics.kpis.totalOrders.toLocaleString()],
            ['TOTAL REVENUE', `Kip ${formatPrice(analytics.kpis.totalRevenue)}`],
            ['IN-LAB', `Kip ${formatPrice(analytics.kpis.inLabRevenue)}`],
            ['OUTSOURCE', `Kip ${formatPrice(analytics.kpis.outLabRevenue)}`]
        ];
        const kpiGap = 4;
        const kpiW = (contentW - kpiGap * 3) / 4;
        kpis.forEach(([label, value], i) => {
            const x = margin + i * (kpiW + kpiGap);
            box(x, 28, kpiW, 22, [239, 246, 255], [191, 219, 254]);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(12);
            doc.setTextColor(75, 85, 99);
            text(label, x + 3, 36);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(17, 24, 39);
            text(value, x + 3, 46);
        });

        const chartGap = 4;
        const chartW = (contentW - chartGap * 2) / 3;
        const chartH = 62;
        chartIds.forEach(([id, title], i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const x = margin + col * (chartW + chartGap);
            const y = 57 + row * (chartH + chartGap);
            box(x, y, chartW, chartH);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(17, 24, 39);
            text(title, x + 3, y + 7);
            const canvas = document.getElementById(id);
            if (canvas) {
                const img = canvas.toDataURL('image/png', 1.0);
                doc.addImage(img, 'PNG', x + 3, y + 10, chartW - 6, chartH - 14, undefined, 'FAST');
            } else {
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(107, 114, 128);
                text('Chart not available', x + chartW / 2, y + chartH / 2, { align: 'center' });
            }
        });

        doc.addPage('a4', 'landscape');
        doc.setTextColor(17, 24, 39);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        text('Summary Report', margin, 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(75, 85, 99);
        text(`Rows: ${summaryRows.length.toLocaleString()} | Total: Kip ${formatPrice(summaryTotal)}`, pageW - margin, 14, { align: 'right' });

        const headers = ['#', 'Category', 'Test', 'Qty', 'Revenue'];
        const colGap = 4;
        const tableW = (contentW - colGap) / 2;
        const rowH = 5.2;
        const startY = 24;
        const maxRowsPerCol = Math.floor((pageH - startY - 14) / rowH) - 1;
        const rowsToDraw = summaryRows.slice(0, maxRowsPerCol * 2);
        const drawTable = (rows, offset, x) => {
            let y = startY;
            doc.setFillColor(31, 41, 55);
            doc.setTextColor(255, 255, 255);
            doc.rect(x, y, tableW, rowH, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            const widths = [8, 25, tableW - 8 - 25 - 15 - 26, 15, 26];
            let cx = x + 1;
            headers.forEach((h, i) => {
                text(h, cx, y + 3.5);
                cx += widths[i];
            });
            y += rowH;
            doc.setFont('helvetica', 'normal');
            rows.forEach((r, i) => {
                doc.setFillColor((offset + i) % 2 ? 255 : 248, (offset + i) % 2 ? 255 : 250, (offset + i) % 2 ? 255 : 252);
                doc.setTextColor(17, 24, 39);
                doc.rect(x, y, tableW, rowH, 'F');
                const cells = [
                    offset + i + 1,
                    r.category || '',
                    r.test_name || '',
                    Number(r.count) || 0,
                    `Kip ${formatPrice(r.revenue || 0)}`
                ];
                cx = x + 1;
                cells.forEach((cell, c) => {
                    const value = String(cell);
                    const clipped = value.length > (c === 2 ? 26 : 14) ? `${value.slice(0, c === 2 ? 25 : 13)}...` : value;
                    text(clipped, cx, y + 3.5);
                    cx += widths[c];
                });
                y += rowH;
            });
        };
        drawTable(rowsToDraw.slice(0, maxRowsPerCol), 0, margin);
        drawTable(rowsToDraw.slice(maxRowsPerCol), maxRowsPerCol, margin + tableW + colGap);
        if (summaryRows.length > rowsToDraw.length) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(12);
            doc.setTextColor(107, 114, 128);
            text(`Showing first ${rowsToDraw.length} rows of ${summaryRows.length}. Use Excel/CSV export for the full table.`, margin, pageH - 8);
        }

        doc.save(`Dashboard-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
        Swal.fire({ icon: 'success', title: 'PDF Generated!', timer: 1800, showConfirmButton: false });
    } catch (error) {
        console.error('PDF Export Error:', error);
        Swal.fire('Error', 'Failed to generate PDF: ' + error.message, 'error');
    }
};

window.exportDashboardPDF = async () => {
    if (!dashboardState.analytics) await loadDashboard();
    if (!window.jspdf?.jsPDF || typeof html2canvas === 'undefined') {
        return Swal.fire('PDF Error', 'jsPDF/html2canvas library is not loaded', 'error');
    }

    const dashboard = document.getElementById('dashboard');
    if (!dashboard) return Swal.fire('PDF Error', 'Dashboard not found', 'error');

    const content = document.querySelector('.content');
    const previousScroll = content?.scrollTop || 0;
    let screenshotClone = null;
    let originalOverflow = '';

    try {
        Swal.fire({
            title: 'Generating PDF...',
            html: 'Taking a real screenshot of the dashboard',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        content?.scrollTo({ top: 0, behavior: 'instant' });
        await new Promise(resolve => setTimeout(resolve, 500));

        originalOverflow = dashboard.style.overflow;
        dashboard.style.overflow = 'visible';
        await new Promise(resolve => requestAnimationFrame(resolve));

        const buildScreenshotClone = () => {
            const clone = dashboard.cloneNode(true);
            Object.assign(clone.style, {
                position: 'fixed',
                left: '0px',
                top: '0px',
                width: `${dashboard.scrollWidth}px`,
                minHeight: `${dashboard.scrollHeight}px`,
                background: '#ffffff',
                zIndex: '2147483647',
                overflow: 'visible',
                transform: 'none',
                opacity: '1',
                display: 'block',
                visibility: 'visible',
                pointerEvents: 'none',
                animation: 'none'
            });
            clone.querySelectorAll('*').forEach(el => {
                el.style.animation = 'none';
                el.style.transition = 'none';
            });
            const exportStyle = document.createElement('style');
            exportStyle.textContent = `
                .dashboard-pdf-capture, .dashboard-pdf-capture * {
                    font-family: 'Noto Sans Lao', 'Phetsarath OT', 'Saysettha OT', 'Segoe UI', Arial, sans-serif !important;
                    text-rendering: geometricPrecision;
                    -webkit-font-smoothing: antialiased;
                    font-kerning: normal;
                    font-synthesis: none;
                    scrollbar-width: none !important;
                }
                .dashboard-pdf-capture *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
                .dashboard-pdf-capture .table-responsive,
                .dashboard-pdf-capture .card,
                .dashboard-pdf-capture .card-body,
                .dashboard-pdf-capture #dashboardSummaryTableContainer {
                    overflow: visible !important;
                    max-height: none !important;
                }
                .dashboard-pdf-capture table {
                    width: 100% !important;
                    table-layout: fixed !important;
                }
                .dashboard-pdf-capture .card-header,
                .dashboard-pdf-capture .table th {
                    font-weight: 800 !important;
                }
                .dashboard-pdf-capture .table th,
                .dashboard-pdf-capture .table td {
                    font-size: 13px !important;
                    line-height: 1.35 !important;
                }
                .dashboard-pdf-capture .card,
                .dashboard-pdf-capture .dashboard-card,
                .dashboard-pdf-capture .chart-card,
                .dashboard-pdf-capture canvas,
                .dashboard-pdf-capture img,
                .dashboard-pdf-capture table,
                .dashboard-pdf-capture .summary-report {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }
            `;
            clone.classList.add('dashboard-pdf-capture');
            clone.prepend(exportStyle);
            dashboard.querySelectorAll('canvas').forEach(sourceCanvas => {
                if (!sourceCanvas.id) return;
                const targetCanvas = clone.querySelector(`#${CSS.escape(sourceCanvas.id)}`);
                if (!targetCanvas) return;
                const img = document.createElement('img');
                img.src = sourceCanvas.toDataURL('image/png');
                img.style.display = 'block';
                img.style.width = `${sourceCanvas.offsetWidth || sourceCanvas.width}px`;
                img.style.height = `${sourceCanvas.offsetHeight || sourceCanvas.height}px`;
                targetCanvas.replaceWith(img);
            });
            return clone;
        };

        screenshotClone = buildScreenshotClone();
        document.body.appendChild(screenshotClone);
        if (document.fonts?.ready) await document.fonts.ready;
        await new Promise(resolve => requestAnimationFrame(resolve));

        const canvas = await html2canvas(screenshotClone, {
            scale: 4,
            useCORS: true,
            allowTaint: true,
            foreignObjectRendering: false,
            letterRendering: false,
            backgroundColor: '#ffffff',
            logging: false,
            imageTimeout: 15000,
            width: screenshotClone.scrollWidth,
            height: screenshotClone.scrollHeight,
            windowWidth: screenshotClone.scrollWidth,
            windowHeight: screenshotClone.scrollHeight,
            scrollX: 0,
            scrollY: 0
        });
        screenshotClone.remove();
        screenshotClone = null;
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 1.5;
        const maxW = pageW - margin * 2;
        const maxH = pageH - margin * 2;
        const dashboardRect = dashboard.getBoundingClientRect();
        const yRatio = canvas.height / Math.max(1, dashboard.scrollHeight || dashboardRect.height);
        const safeCuts = [...dashboard.querySelectorAll('.card, .row, .dashboard-section, .page-header')]
            .map(el => {
                const rect = el.getBoundingClientRect();
                return Math.round((rect.bottom - dashboardRect.top) * yRatio);
            })
            .filter(y => y > 80 && y < canvas.height - 80)
            .sort((a, b) => a - b);
        const avoidRects = [...dashboard.querySelectorAll('.card, .dashboard-card, .chart-card, canvas, table, .summary-report')]
            .map(el => {
                const rect = el.getBoundingClientRect();
                return {
                    top: Math.round((rect.top - dashboardRect.top) * yRatio),
                    bottom: Math.round((rect.bottom - dashboardRect.top) * yRatio)
                };
            })
            .filter(r => r.bottom > 80 && r.top < canvas.height - 80 && r.bottom > r.top)
            .sort((a, b) => a.top - b.top);

        const priorityCharts = ['chartGender', 'chartInsite', 'chartVisitType', 'chartTestType'];
        const priorityCut = Math.max(0, ...priorityCharts.map(id => {
            const card = document.getElementById(id)?.closest('.card');
            if (!card) return 0;
            const rect = card.getBoundingClientRect();
            return Math.round((rect.bottom - dashboardRect.top + 16) * yRatio);
        }));

        dashboard.style.overflow = originalOverflow;

        const pagePixelH = Math.floor(canvas.width * (maxH / maxW));

        const findSafeCut = (target, minY) => {
            const crossing = avoidRects.find(r => r.top < target && r.bottom > target);
            if (crossing) {
                if (crossing.top > minY + 80) return crossing.top;
                if (crossing.bottom < canvas.height && crossing.bottom > minY + 80) return crossing.bottom;
            }
            const windowPx = Math.max(120, Math.round(pagePixelH * 0.16));
            const candidates = safeCuts.filter(y => y > minY + 80 && y >= target - windowPx && y <= target + windowPx);
            if (!candidates.length) return Math.min(canvas.height, target);
            return candidates.reduce((best, y) => Math.abs(y - target) < Math.abs(best - target) ? y : best, candidates[0]);
        };

        const cuts = [0];
        let cursor = 0;
        if (priorityCut > 120 && priorityCut < canvas.height - 120 && priorityCut <= pagePixelH * 1.05) {
            cuts.push(priorityCut);
            cursor = priorityCut;
        }
        while (canvas.height - cursor > pagePixelH && cuts.length < 8) {
            const next = findSafeCut(cursor + pagePixelH, cursor);
            if (next <= cursor + 80) break;
            cuts.push(next);
            cursor = next;
        }
        if (cuts[cuts.length - 1] < canvas.height) cuts.push(canvas.height);

        for (let i = 0; i < cuts.length - 1; i += 1) {
            if (i > 0) doc.addPage('a4', 'landscape');
            const y = cuts[i];
            const h = cuts[i + 1] - y;
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = canvas.width;
            pageCanvas.height = h;
            const ctx = pageCanvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);

            const img = pageCanvas.toDataURL('image/png');
            const scale = Math.min(maxW / pageCanvas.width, maxH / pageCanvas.height);
            const imgW = pageCanvas.width * scale;
            const imgH = pageCanvas.height * scale;
            doc.addImage(img, 'PNG', margin + (maxW - imgW) / 2, margin, imgW, imgH, undefined, 'FAST');
        }

        doc.save(`Dashboard-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
        Swal.fire({ icon: 'success', title: 'PDF Generated!', timer: 1800, showConfirmButton: false });
    } catch (error) {
        console.error('PDF Export Error:', error);
        Swal.fire('Error', 'Failed to generate PDF: ' + error.message, 'error');
    } finally {
        if (screenshotClone?.parentNode) screenshotClone.remove();
        dashboard.style.overflow = originalOverflow;
        content?.scrollTo({ top: previousScroll, behavior: 'instant' });
    }
};

// Safety fallback: any function still not defined logs a console warning
const requiredFns = [
    // Core CRUD
    'loadInventoryTable','loadTestMasterTable','loadMappingData','loadPackagesTable',
    'loadSettings','setSetupTab','performLogout','toggleSidebar',
    'loadMaintenanceTable',
    // Phase 2
    'loadResultEntryOrders','openResultEntry','saveResultEntry','openResultReport',
    'loadAuditLog','checkReagentAvailability','deductReagentsForOrder',
    // Phase 3
    'loadPatientMaster','openPatientModal','savePatient','deletePatient',
    'openPatientPicker','applyPickedPatient',
    'loadPatientHistoryPage','closePatientHistoryDetail','openPatientVisitDetail','filterPatientHistory',
    'loadOutlabTable','filterOutlabByDate','resetOutlabFilter','setOutlabStatus','exportOutlabCSV',
    'showInventoryAlerts','refreshInventoryAlertBadge',
    'cancelEdit','printTubeLabel','filterTestItems',
    'userCan','applyRolePermissions',
];
requiredFns.forEach(s => {
    if(!window[s]) window[s] = (...args) => console.warn('[missing impl]', s, args);
});

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Loaded. Checking session...');
    bindLoginEvents();
    const user = JSON.parse(sessionStorage.getItem('lis_user') || 'null');
    if (user && api.hasValidAuthToken()) bootApp(user);
    else if (user) {
        console.warn('[auth] stale session removed: missing or expired token');
        sessionStorage.removeItem('lis_user');
        const errDiv = document.getElementById('loginError');
        if (errDiv) {
            errDiv.textContent = 'Session ໝົດອາຍຸ ຫຼື token ບໍ່ຖືກຕ້ອງ. ກະລຸນາ login ໃໝ່.';
            errDiv.style.display = 'block';
        }
    }
    else console.log('No user session.');
});
