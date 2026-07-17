// APP.JS
// Helpers dùng chung + màn hình đăng nhập mật khẩu + khởi động ứng dụng.

let FORM_OPTIONS = null;
let _autoRefreshTimer = null;
let ALL_CUSTOMERS = [];

function fillCustomerDatalist(customers) {
  const dl = document.getElementById('customer-datalist');
  if (!dl) return;
  dl.innerHTML = '';
  // Gom nhóm danh sách khách hàng để tránh trùng lặp hiển thị gợi ý
  const uniqueNames = [...new Set(customers.map(c => c.customerName).filter(Boolean))];
  uniqueNames.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    dl.appendChild(opt);
  });
}

const TAB_TITLES = {
  dashboard: 'Tổng quan',
  list: 'Danh sách & follow up',
  add: 'Thêm báo giá',
  reports: 'Báo cáo',
  probability: 'Xác suất chốt'
};

function showLoading(show) {
  document.getElementById('loading-overlay').classList.toggle('d-none', !show);
}

function toast(message, type) {
  const id = 't' + Date.now();
  const html = `
    <div id="${id}" class="toast align-items-center text-bg-${type || 'success'} border-0" role="alert">
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>`;
  document.getElementById('toast-container').insertAdjacentHTML('beforeend', html);
  const el = document.getElementById(id);
  new bootstrap.Toast(el, { delay: 3500 }).show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}

function formatVND(value) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0)) + ' đ';
}

function formatPercent(value) {
  return Math.round((Number(value) || 0) * 100) + '%';
}

function statusClass(status) {
  return 'status-' + String(status || '').trim().replace(/\s+/g, '-');
}

function fillSelect(select, options, placeholder) {
  select.innerHTML = '';
  if (placeholder !== undefined) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    select.appendChild(opt);
  }
  options.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v || '(Chưa kết thúc)';
    select.appendChild(opt);
  });
}

// Gọi lại dữ liệu báo giá 1 lần duy nhất rồi vẽ lại cả Dashboard + Danh sách + Báo cáo.
// (Không gọi 2-3 API riêng lẻ như trước — giảm số lần JSONP round-trip.)
async function reloadAll() {
  ALL_PROJECTS = await callApi('getProjects');
  ALL_CUSTOMERS = await callApi('getCustomers').catch(() => []);
  fillCustomerDatalist(ALL_CUSTOMERS);
  applyListFilters();
  refreshDashboard();
  if (!document.getElementById('tab-reports').classList.contains('d-none')) renderCurrentReport();
}

// ============================================================
// SIDEBAR / CHUYỂN TAB
// ============================================================
function switchToTab(tabName) {
  document.querySelectorAll('#main-tabs .side-link').forEach((b) => b.classList.toggle('active', b.dataset.tab === tabName));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('d-none'));
  document.getElementById('tab-' + tabName).classList.remove('d-none');
  document.getElementById('page-title').textContent = TAB_TITLES[tabName] || '';
  closeMobileSidebar();
  if (tabName === 'reports') renderCurrentReport();
  if (tabName === 'probability') loadProbabilityTab();
}

document.getElementById('main-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (!btn) return;
  switchToTab(btn.dataset.tab);
});

function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('show');
}

document.getElementById('btn-menu-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-backdrop').classList.add('show');
});
document.getElementById('sidebar-backdrop').addEventListener('click', closeMobileSidebar);

document.getElementById('btn-notifications').addEventListener('click', () => switchToTab('dashboard'));

document.getElementById('btn-refresh-all').addEventListener('click', async () => {
  showLoading(true);
  try {
    await reloadAll();
    toast('Đã làm mới dữ liệu.');
  } catch (err) {
    toast('Lỗi: ' + err.message, 'danger');
  } finally {
    showLoading(false);
  }
});

// ============================================================
// ĐĂNG NHẬP MẬT KHẨU
// ============================================================
document.getElementById('login-submit').addEventListener('click', attemptLogin);
document.getElementById('login-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') attemptLogin();
});

async function attemptLogin() {
  const pass = document.getElementById('login-password').value.trim();
  const errorBox = document.getElementById('login-error');
  errorBox.classList.add('d-none');
  if (!pass) return;

  showLoading(true);
  try {
    await verifyPassword(pass);
    document.getElementById('login-overlay').classList.add('d-none');
    await init();
  } catch (err) {
    errorBox.textContent = err.message || 'Sai mật khẩu, vui lòng thử lại.';
    errorBox.classList.remove('d-none');
  } finally {
    showLoading(false);
  }
}

document.getElementById('btn-logout').addEventListener('click', () => {
  clearStoredPassword();
  if (_autoRefreshTimer) clearInterval(_autoRefreshTimer);
  document.getElementById('app-root').classList.add('d-none');
  document.getElementById('login-overlay').classList.remove('d-none');
  document.getElementById('login-password').value = '';
});

// ============================================================
// KHỞI ĐỘNG
// ============================================================
async function init() {
  showLoading(true);
  try {
    FORM_OPTIONS = await callApi('getFormOptions');
    fillSelect(document.querySelector('[name="source"]'), FORM_OPTIONS.source);
    fillSelect(document.querySelector('[name="customerType"]'), FORM_OPTIONS.customerType);
    fillSelect(document.querySelector('[name="currentStatus"]'), FORM_OPTIONS.currentStatus);
    fillSelect(document.getElementById('update-current-status'), FORM_OPTIONS.currentStatus);
    fillSelect(document.getElementById('update-final-status'), FORM_OPTIONS.finalStatus, 'Chưa kết thúc');
    document.querySelector('[name="quoteDate"]').value = new Date().toISOString().slice(0, 10);

    ALL_PROJECTS = await callApi('getProjects');
    ALL_CUSTOMERS = await callApi('getCustomers').catch(() => []);
    fillCustomerDatalist(ALL_CUSTOMERS);
    applyListFilters();
    refreshDashboard();

    document.getElementById('app-root').classList.remove('d-none');

    requestNotificationPermissionOnce();
    if (_autoRefreshTimer) clearInterval(_autoRefreshTimer);
    // Tự động làm mới nhắc nhở/số liệu mỗi 5 phút trong lúc mở app, không cần bấm gì.
    _autoRefreshTimer = setInterval(() => { reloadAll().catch(() => {}); }, 5 * 60 * 1000);
  } catch (err) {
    toast('Lỗi tải dữ liệu: ' + err.message, 'danger');
    // Nếu lỗi do sai mật khẩu (hết hạn session), quay lại màn hình đăng nhập.
    document.getElementById('app-root').classList.add('d-none');
    document.getElementById('login-overlay').classList.remove('d-none');
  } finally {
    showLoading(false);
  }
}

// Nếu đã đăng nhập trong phiên này (sessionStorage còn mật khẩu), vào thẳng app.
(function bootstrapApp() {
  const savedPass = getStoredPassword();
  if (savedPass) {
    document.getElementById('login-overlay').classList.add('d-none');
    init();
  }
})();
