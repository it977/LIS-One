import * as api from './api.js';

let selectedTests = [];
const Pages = { active: 'dashboard', setupTab: 'tests' };

async function bootApp(user) {
    document.getElementById('loginScreen').style.display = 'none';
    const mainApp = document.getElementById('mainApp');
    mainApp.style.display = 'flex';
    document.getElementById('displayRole').innerText = (user.username || 'User') + ' (' + (user.role || 'Admin') + ')';
    
    loadDashboard();
    window.loadTestCheckboxes();
    loadRecentOrders();
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
        } else alert(res?.message || 'Login failed');
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
        let h = `<div class="col-12 mt-3"><h6 class="fw-bold border-bottom pb-1 text-primary">${cat}</h6><div class="row g-2">`;
        grouped[cat].forEach(t => {
            h += `<div class="col-6 col-md-4 col-xl-2">
                <div class="form-check card-test p-2 border rounded">
                    <input class="form-check-input test-checkbox" type="checkbox" id="chk_${t.id}" 
                           data-id="${t.id}" data-name="${t.name}" data-price="${t.price}" data-cat="${t.category}">
                    <label class="form-check-label w-100" for="chk_${t.id}">
                        <div class="small fw-bold">${t.name}</div>
                        <div class="small text-danger">${Number(t.price).toLocaleString()} ₭</div>
                    </label>
                </div>
            </div>`;
        });
        h += '</div></div>';
        container.innerHTML += h;
    });

    document.querySelectorAll('.test-checkbox').forEach(chk => {
        chk.addEventListener('change', handleTestSelection);
    });
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
    console.log('Selected Tests:', selectedTests);
    renderOrderSummary();
}

function renderOrderSummary() {
    const summaryList = document.getElementById('cartList');
    const totalDisplay = document.getElementById('totalPriceDisplay');
    if(!summaryList) return;

    summaryList.innerHTML = '';
    let total = 0;

    selectedTests.forEach((t, index) => {
        total += t.price;
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center py-1 bg-light mb-1 border-0 rounded';
        li.innerHTML = `
            <div class="small">
                <div class="fw-bold">${t.name}</div>
                <div class="text-muted">${t.category}</div>
            </div>
            <div class="text-end">
                <div class="fw-bold text-danger">${t.price.toLocaleString()} ₭</div>
                <button class="btn btn-sm text-muted p-0" onclick="window.removeTest('${t.id}')"><i class="bi bi-x-circle"></i></button>
            </div>`;
        summaryList.appendChild(li);
    });

    if(selectedTests.length === 0) {
        summaryList.innerHTML = '<li class="list-group-item text-center text-muted small py-3">ຍັງບໍ່ມີລາຍການເລືອກ</li>';
    }

    if(totalDisplay) totalDisplay.innerText = total.toLocaleString() + ' ₭';
}

window.removeTest = (id) => {
    const chk = document.getElementById('chk_' + id);
    if(chk) {
        chk.checked = false;
        handleTestSelection();
    }
};

window.submitData = async () => {
    const pid = document.getElementById('patientId').value;
    const pname = document.getElementById('patientName').value;
    const age = document.getElementById('age').value;
    const gender = document.getElementById('gender').value;
    const doctor = document.getElementById('doctor').value;
    const dept = document.getElementById('department').value;
    
    if(!pid || !pname || selectedTests.length === 0) {
        alert('ກະລຸນາປ້ອນຂໍ້ມູນຄົນເຈັບ ແລະ ເລືອກລາຍການກວດ');
        return;
    }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerHTML = 'ກຳລັງບັນທຶກ...';

    const orderId = 'ORD-' + Date.now().toString().slice(-8);
    const totalPrice = selectedTests.reduce((s, t) => s + t.price, 0);

    const orderData = {
        order_id: orderId,
        patient_id: pid,
        patient_name: pname,
        age: age,
        gender: gender,
        doctor: doctor,
        department: dept,
        total_price: totalPrice,
        status: 'Pending'
    };

    try {
        const res = await api.saveOrder(orderData, selectedTests);
        if(res.success) {
            alert('ບັນທຶກສັ່ງກວດສຳເລັດ! ລະຫັດບິນ: ' + orderId);
            window.resetForm();
            loadRecentOrders();
        } else {
            alert('ຜິດພາດ: ' + res.error);
        }
    } catch(e) {
        console.error(e);
        alert('Internal Error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'ບັນທຶກການສັ່ງກວດ';
    }
};

window.resetForm = () => {
    document.getElementById('patientId').value = '';
    document.getElementById('patientName').value = '';
    document.getElementById('age').value = '';
    document.querySelectorAll('.test-checkbox').forEach(c => c.checked = false);
    selectedTests = [];
    renderOrderSummary();
};

async function loadRecentOrders() {
    const orders = await api.getRecentOrders();
    const body = document.getElementById('orderTableBody');
    if(!body) return;
    body.innerHTML = (orders || []).map(o => `
        <tr>
            <td>${new Date(o.order_datetime).toLocaleString()}</td>
            <td><b>${o.order_id}</b></td>
            <td>${o.patient_name}</td>
            <td class="text-end">${Number(o.total_price).toLocaleString()} ₭</td>
            <td><span class="badge bg-secondary">${o.status}</span></td>
        </tr>
    `).join('');
}

// Stubs for other pages
window.setSetupTab = (t) => console.log('Tab:', t);
window.performLogout = () => { sessionStorage.removeItem('lis_user'); window.location.reload(); };
window.toggleSidebar = () => document.getElementById('sidebar').classList.toggle('collapsed');

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(sessionStorage.getItem('lis_user') || 'null');
    if (user) bootApp(user);
});
