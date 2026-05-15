import * as api from './api.js';

let selectedTests = [];
const Pages = { active: 'dashboard', setupTab: 'tests' };

async function bootApp(user) {
    console.log('Booting app for:', user.username);
    document.getElementById('loginScreen').style.display = 'none';
    const mainApp = document.getElementById('mainApp');
    mainApp.style.display = 'flex';
    document.getElementById('displayRole').innerText = (user.username || 'User') + ' (' + (user.role || 'Admin') + ')';
    
    await loadInitialData();
}

async function loadInitialData() {
    loadDashboard();
    window.loadTestCheckboxes();
    loadRecentOrders();
    populateDropdowns();
}

async function populateDropdowns() {
    console.log('Populating dropdowns...');
    try {
        const settings = await api.getSettings();
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
                // Keep the first default option if it exists
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
    } catch (e) {
        console.error('Dropdown Error:', e);
    }
}

window.performLogin = async () => {
    const u = document.getElementById('loginUser').value;
    const p = document.getElementById('loginPass').value;
    const btn = document.getElementById('btnLogin');
    if(!u || !p) return;
    btn.disabled = true;
    try {
        const res = await api.loginUser(u, p);
        if(res && res.success) {
            sessionStorage.setItem('lis_user', JSON.stringify(res));
            bootApp(res);
        } else Swal.fire('Error', res?.message || 'Login failed', 'error');
    } catch(e) { console.error(e); }
    finally { btn.disabled = false; }
};

window.showPage = (e, id) => {
    if (e) e.preventDefault();
    Pages.active = id;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
    
    document.querySelectorAll('.nav-link').forEach(l => {
       if(l.getAttribute('onclick')?.includes(id)) l.classList.add('active');
    });

    if(id === 'dashboard') loadDashboard();
    if(id === 'inventoryPage') loadInventoryTable();
    if(id === 'testSetup') window.setSetupTab(Pages.setupTab);
    if(id === 'orderForm') window.loadTestCheckboxes();
    if(id === 'trackResult') loadRecentOrders();
};

window.loadTestCheckboxes = async function() {
    const container = document.getElementById('dynamicTestContainer');
    if(!container) return;
    container.innerHTML = '<div class="col-12 text-center py-4"><div class="spinner-border text-primary"></div></div>';
    
    try {
        const tests = await api.getTestMaster();
        container.innerHTML = '';
        if(!tests || tests.length === 0) {
            container.innerHTML = '<div class="col-12 text-center text-muted">ຍັງບໍ່ມີລາຍການກວດ</div>';
            return;
        }
        
        const grouped = {};
        tests.forEach(t => {
            const cat = t.category || 'Other';
            if(!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(t);
        });
        
        Object.keys(grouped).forEach(cat => {
            let h = `<div class="col-12 mt-3"><h6 class="fw-bold border-bottom pb-1 text-primary"><i class="bi bi-tag-fill me-2"></i>${cat}</h6><div class="row g-2">`;
            grouped[cat].forEach(t => {
                const isSelected = selectedTests.some(s => s.id == t.id);
                h += `
                <div class="col-6 col-md-4 col-xl-2">
                    <div class="test-item-card border p-2 rounded ${isSelected ? 'bg-primary-subtle border-primary' : 'bg-white'}" 
                         style="cursor:pointer; transition:all 0.2s;" 
                         onclick="window.toggleTestAndRender('${t.id}', '${t.name.replace(/'/g, "\\'")}', '${t.price}', '${t.category}')">
                        <div class="d-flex align-items-center mb-0">
                            <input class="form-check-input test-checkbox me-2" type="checkbox" id="chk_${t.id}" 
                                   data-id="${t.id}" data-name="${t.name.replace(/'/g, "\\'")}" data-price="${t.price}" data-cat="${t.category}"
                                   ${isSelected ? 'checked' : ''} onclick="event.stopPropagation()">
                            <div class="w-100 overflow-hidden">
                                <div class="fw-bold text-truncate" style="font-size:0.75rem;">${t.name}</div>
                                <div class="text-danger fw-bold" style="font-size:0.7rem;">${Number(t.price).toLocaleString()} ₭</div>
                            </div>
                        </div>
                    </div>
                </div>`;
            });
            h += '</div></div>';
            container.innerHTML += h;
        });

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

    selectedTests.forEach((t) => {
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

    if(selectedTests.length === 0) {
        summaryList.innerHTML = `
            <li class="list-group-item text-center text-muted py-5 border-0 bg-transparent">
                <i class="bi bi-cart-x fs-1 opacity-25"></i>
                <div class="mt-2">ຍັງບໍ່ມີລາຍການເລືອກ</div>
            </li>`;
    }

    if(totalDisplay) totalDisplay.innerText = total.toLocaleString() + ' ₭';
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

    const orderId = 'ORD-' + Date.now().toString().slice(-8);
    const totalPrice = selectedTests.reduce((s, t) => s + t.price, 0);

    const orderData = {
        order_id: orderId,
        patient_id: pid,
        patient_name: pname,
        age, gender, doctor, department: dept,
        visit_type: visitType,
        insite: insite,
        time_slot: timeSlot,
        sender: sender,
        total_price: totalPrice,
        status: 'Pending'
    };

    try {
        const res = await api.saveOrder(orderData, selectedTests);
        if(res.success) {
            Swal.fire({
                title: 'ສຳເລັດ',
                html: 'ບັນທຶກສັ່ງກວດສຳເລັດ! <br> ລະຫັດບິນ: <b>' + orderId + '</b>',
                icon: 'success'
            });
            window.resetForm();
            loadRecentOrders();
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
};

async function loadRecentOrders() {
    const orders = await api.getRecentOrders();
    const body = document.getElementById('orderTableBody');
    if(!body) return;
    body.innerHTML = (orders || []).map(o => `
        <tr>
            <td><small>${new Date(o.order_datetime).toLocaleString()}</small></td>
            <td><b>${o.order_id}</b></td>
            <td>${o.patient_name}</td>
            <td class="text-end text-danger fw-bold">${Number(o.total_price).toLocaleString()} ₭</td>
            <td class="text-center"><span class="badge bg-secondary">${o.status}</span></td>
        </tr>
    `).join('');
}

async function loadDashboard() {
    const data = await api.getDashboardData();
    if(data.success && data.kpis) {
        if(document.getElementById('kpiPatients')) document.getElementById('kpiPatients').innerText = data.kpis.totalPatients.toLocaleString();
        if(document.getElementById('kpiRev')) document.getElementById('kpiRev').innerText = '₭ ' + data.kpis.totalRevenue.toLocaleString();
    }
}

// Fixed stubs that now call actual functions if they exist
const stubs = ['loadInventoryTable','loadTestMasterTable','loadMappingData','loadPackagesTable','loadSettings','loadParamSetupData','setSetupTab','performLogout','toggleSidebar'];
stubs.forEach(s => { 
    if(!window[s]) window[s] = (...args) => console.log('STUB called:', s, args); 
});

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Loaded. Checking session...');
    const user = JSON.parse(sessionStorage.getItem('lis_user') || 'null');
    if (user) bootApp(user);
    else console.log('No user session.');
});
