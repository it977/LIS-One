/* ============================================================
 * LIS-One — FRONTEND PERMISSIONS
 *
 * Mirrors the server permission matrix (see functions/_lib/auth.js).
 * Use:
 *   - window.userCan(table, action)             → boolean
 *   - window.applyRolePermissions()             → hides elements with
 *                                                  data-perm-table+data-perm-action
 *                                                  that the current role lacks
 *   - <button data-perm-table="lis_one_test_master" data-perm-action="insert">
 *
 * Elements marked .admin-only are also handled (kept for legacy markup).
 * ============================================================ */

const FULL = { s: true, i: true, u: true, d: true };
const READ = { s: true, i: false, u: false, d: false };

const PERMISSIONS = {
  admin: { '*': FULL },
  lab_staff: {
    lis_one_test_orders:          { s: true, i: true,  u: true,  d: false },
    lis_one_test_results:         FULL,
    lis_one_test_parameters:      READ,
    lis_one_test_master:          READ,
    lis_one_test_reagent_mapping: READ,
    lis_one_inventory_lots:       { s: true, i: true,  u: true,  d: false },
    lis_one_stock_master:         { s: true, i: true,  u: true,  d: false },
    lis_one_stock_transactions:   { s: true, i: true,  u: false, d: false },
    lis_one_maintenance_log:      { s: true, i: true,  u: true,  d: false },
    lis_one_patients:             { s: true, i: true,  u: true,  d: false },
    lis_one_settings:             READ,
    lis_one_audit_log:            { s: true, i: true,  u: false, d: false },
    test_packages:                READ,
    test_package_items:           READ,
  },
  cashier: {
    lis_one_test_orders:          { s: true, i: true, u: true, d: false },
    lis_one_test_results:         READ,
    lis_one_test_parameters:      READ,
    lis_one_test_master:          READ,
    lis_one_test_reagent_mapping: READ,
    lis_one_inventory_lots:       READ,
    lis_one_stock_master:         READ,
    lis_one_stock_transactions:   READ,
    lis_one_patients:             { s: true, i: true, u: true, d: false },
    lis_one_settings:             READ,
    lis_one_audit_log:            { s: true, i: true, u: false, d: false },
    test_packages:                READ,
    test_package_items:           READ,
  },
  doctor: {
    lis_one_test_orders:          READ,
    lis_one_test_results:         READ,
    lis_one_test_parameters:      READ,
    lis_one_test_master:          READ,
    lis_one_test_reagent_mapping: READ,
    lis_one_patients:             READ,
    lis_one_settings:             READ,
    lis_one_inventory_lots:       READ,
    lis_one_stock_master:         READ,
    lis_one_audit_log:            READ,
    test_packages:                READ,
    test_package_items:           READ,
  },
};

const K = { select: 's', insert: 'i', update: 'u', delete: 'd' };

function getRole() {
  try {
    const raw = sessionStorage.getItem('lis_user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    return (u?.role || 'doctor').toLowerCase().replace(/[^a-z_]/g, '_');
  } catch { return null; }
}

window.userRole = getRole;

window.userCan = function(table, action = 'select') {
  const role = getRole();
  if (!role) return false;
  // normalize legacy role names
  const r = role === 'user' ? 'lab_staff' : role;
  const map = PERMISSIONS[r];
  if (!map) return false;
  const entry = map['*'] || map[table];
  if (!entry) return false;
  return Boolean(entry[K[action]]);
};

window.applyRolePermissions = function() {
  const role = getRole();
  if (!role) {
    console.log('[permissions.js] no authenticated user; skipping role permissions');
    return;
  }
  // Admin sees everything
  const isAdmin = role === 'admin';

  // 1) Legacy .admin-only: show only for admin
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });

  // 2) data-perm-table + data-perm-action gating
  document.querySelectorAll('[data-perm-table]').forEach(el => {
    const table  = el.dataset.permTable;
    const action = el.dataset.permAction || 'select';
    el.style.display = window.userCan(table, action) ? '' : 'none';
  });

  // 3) Reveal role badge if present
  const badge = document.getElementById('userRoleBadge');
  if (badge) {
    badge.textContent = role;
    badge.className = 'badge role-badge role-' + role;
  }
};

// Re-apply when DOM mutates (new pages mounted dynamically)
/* 
  if (typeof MutationObserver !== 'undefined') {
    const obs = new MutationObserver((muts) => {
      if (muts.some(m => m.addedNodes && m.addedNodes.length)) {
        window.applyRolePermissions();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }
*/


console.log('[permissions.js] loaded — current role:', getRole() || 'none (not logged in)');
