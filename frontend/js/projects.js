// PROJECTS.JS
let ALL_PROJECTS = [];
const updateModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('update-modal'));

// ============================================================
// FORM: THÊM BÁO GIÁ
// ============================================================
document.getElementById('form-add-project').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = Object.fromEntries(new FormData(e.target).entries());
  
  // Gom chung thành 1 trường customerName tùy theo phân loại
  form.customerName = (form.customerType === 'Khách cũ') ? form.customerNameOld : form.customerNameNew;
  delete form.customerNameOld;
  delete form.customerNameNew;
  
  // KIỂM TRA CHÍNH TẢ KHÁCH HÀNG CŨ (Mặc dù Tom Select đã chặn rồi nhưng cứ phòng hờ)
  if (form.customerType === 'Khách cũ') {
    if (!form.customerName) {
      toast('Vui lòng chọn khách hàng cũ từ danh sách!', 'danger');
      return;
    }
    const found = ALL_CUSTOMERS.find(c => String(c.customerName).trim().toLowerCase() === form.customerName.trim().toLowerCase());
    if (!found) {
      toast('Vui lòng chọn đúng khách hàng có sẵn từ danh sách, hoặc đổi phân loại thành "Khách mới"!', 'danger');
      return;
    }
    form.customerName = found.customerName;
  }
  
  // Lọc bỏ dấu chấm phân tách hàng nghìn trước khi gửi lên API
  if (form.amount) {
    form.amount = form.amount.replace(/\./g, '');
  }
  
  showLoading(true);
  try {
    await callApi('createProject', form);
    toast('Đã thêm báo giá mới.');
    e.target.reset();
    document.querySelector('[name="quoteDate"]').value = new Date().toISOString().slice(0, 10);
    await reloadAll();
    switchToTab('list');
  } catch (err) {
    toast('Lỗi: ' + err.message, 'danger');
  } finally {
    showLoading(false);
  }
});

// Tự động định dạng hàng nghìn khi nhập số tiền (VNĐ)
const amountInput = document.querySelector('#form-add-project [name="amount"]');
if (amountInput) {
  amountInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value) {
      e.target.value = new Intl.NumberFormat('vi-VN').format(parseInt(value, 10));
    } else {
      e.target.value = '';
    }
  });
}

// ============================================================
// DANH SÁCH & FOLLOW UP
// ============================================================
async function loadProjectList() {
  ALL_PROJECTS = await callApi('getProjects');
  applyListFilters();
}

let CURRENT_LIST_PERIOD = 'week';

function applyListFilters() {
  const period = CURRENT_LIST_PERIOD;
  const q = document.getElementById('search-box').value.trim().toLowerCase();
  let rows = filterByPeriod(ALL_PROJECTS, period);
  if (q) rows = rows.filter((r) => (r.customerName || '').toLowerCase().includes(q));
  renderProjectTable(rows);
  document.getElementById('list-count-label').textContent = rows.length + ' / ' + ALL_PROJECTS.length + ' báo giá';
}

function renderProjectTable(rows) {
  const tbody = document.getElementById('project-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">Không có báo giá nào khớp bộ lọc.</td></tr>';
    return;
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  tbody.innerHTML = rows.map((r) => {
    let rowClass = '';
    if (!r.finalStatus && r.nextFollowUpDate) {
      const due = new Date(r.nextFollowUpDate);
      const daysLeft = Math.round((due - today) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) rowClass = 'row-overdue';
      else if (daysLeft <= 2) rowClass = 'row-soon';
    }
    const isLink = r.productFile && (r.productFile.startsWith('http://') || r.productFile.startsWith('https://'));
    const fileLinkHtml = isLink 
      ? `<a href="${r.productFile}" target="_blank" onclick="event.stopPropagation()" class="btn-view-file ms-2" title="Xem file báo giá (Link Drive)"><i class="ti ti-brand-google-drive text-accent" style="font-size: 1.25rem;"></i></a>` 
      : (r.productFile ? `<span class="text-muted small ms-2" title="${r.productFile}"><i class="ti ti-file-description"></i></span>` : '');

    return `
      <tr class="${rowClass}" style="cursor:pointer" onclick="openUpdateModal('${r.quoteId}')">
        <td>
          <div class="d-flex align-items-center justify-content-between">
            <div>
              <div class="fw-semibold">${r.customerName}</div>
              <div class="text-muted small">${r.customerType || ''}</div>
            </div>
            ${fileLinkHtml}
          </div>
        </td>
        <td>${r.sales || ''}</td>
        <td>${formatVND(r.amount)}</td>
        <td><span class="status-badge ${statusClass(r.currentStatus)}">${r.currentStatus || ''}</span></td>
        <td>${formatPercent(r.probability)}</td>
        <td>${formatVND(r.expectedRevenue)}</td>
        <td>${r.followUp || 0} lần</td>
        <td>${r.nextFollowUpDate || '—'}</td>
        <td class="text-end"><i class="ti ti-edit btn-edit-row"></i></td>
      </tr>`;
  }).join('');
}

document.getElementById('search-box').addEventListener('input', applyListFilters);

// Xử lý chuyển đổi bộ lọc thời gian dạng phân đoạn (Segmented Control)
const listFilterSegmented = document.getElementById('list-period-filter-segmented');
if (listFilterSegmented) {
  listFilterSegmented.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    document.querySelectorAll('#list-period-filter-segmented .seg-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    CURRENT_LIST_PERIOD = btn.dataset.period;
    applyListFilters();
  });
}

// ============================================================
// MODAL CẬP NHẬT
// ============================================================
function openUpdateModal(projectId) {
  const row = ALL_PROJECTS.filter((r) => r.quoteId === projectId)[0];
  if (!row) return;
  const form = document.getElementById('form-update-project');
  form.projectId.value = row.quoteId;
  form.currentStatus.value = row.currentStatus || '';
  form.finalStatus.value = row.finalStatus || '';
  form.nextFollowUpDate.value = row.nextFollowUpDate || '';
  form.note.value = row.note || '';
  document.getElementById('update-followup-count').textContent = row.followUp || 0;
  updateModal().show();
}

document.getElementById('btn-mark-followup').addEventListener('click', async () => {
  const projectId = document.querySelector('#form-update-project [name="projectId"]').value;
  if (!projectId) return;
  showLoading(true);
  try {
    await callApi('markFollowUp', {
      projectId: projectId,
      nextFollowUpDate: document.querySelector('#form-update-project [name="nextFollowUpDate"]').value,
      note: document.querySelector('#form-update-project [name="note"]').value
    });
    toast('Đã ghi nhận thêm 1 lần follow up.');
    await reloadAll();
    const count = document.getElementById('update-followup-count');
    count.textContent = Number(count.textContent) + 1;
  } catch (err) {
    toast('Lỗi: ' + err.message, 'danger');
  } finally {
    showLoading(false);
  }
});

// Follow up nhanh 1-chạm ngay trong danh sách nhắc nhở, không cần mở modal.
async function quickFollowUp(projectId) {
  showLoading(true);
  try {
    await callApi('markFollowUp', { projectId: projectId });
    toast('Đã ghi nhận thêm 1 lần follow up.');
    await reloadAll();
  } catch (err) {
    toast('Lỗi: ' + err.message, 'danger');
  } finally {
    showLoading(false);
  }
}

document.getElementById('form-update-project').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = Object.fromEntries(new FormData(e.target).entries());
  const projectId = form.projectId;
  delete form.projectId;
  showLoading(true);
  try {
    await callApi('updateProject', { projectId: projectId, form: form });
    toast('Đã lưu thay đổi.');
    updateModal().hide();
    await reloadAll();
  } catch (err) {
    toast('Lỗi: ' + err.message, 'danger');
  } finally {
    showLoading(false);
  }
});

document.getElementById('btn-delete-project').addEventListener('click', async () => {
  const projectId = document.querySelector('#form-update-project [name="projectId"]').value;
  if (!projectId) return;
  if (!confirm('Xoá báo giá này? Không thể hoàn tác.')) return;
  showLoading(true);
  try {
    await callApi('deleteProject', { projectId: projectId });
    toast('Đã xoá báo giá.');
    updateModal().hide();
    await reloadAll();
  } catch (err) {
    toast('Lỗi: ' + err.message, 'danger');
  } finally {
    showLoading(false);
  }
});

// ============================================================
// TOM SELECT: SELECT SEARCH KHÁCH HÀNG CŨ
// ============================================================
let tomSelectInstance = null;

function initTomSelect() {
  const selectOld = document.getElementById('select-old-customer');
  if (!selectOld) return;
  
  if (tomSelectInstance) {
    tomSelectInstance.destroy();
  }
  
  // Nạp options vào select
  selectOld.innerHTML = '<option value="">Chọn khách hàng...</option>';
  (ALL_CUSTOMERS || []).forEach(c => {
    if (!c.customerName) return;
    const opt = document.createElement('option');
    opt.value = c.customerName;
    opt.textContent = c.customerName;
    selectOld.appendChild(opt);
  });
  
  if (typeof TomSelect !== 'undefined') {
    tomSelectInstance = new TomSelect('#select-old-customer', {
      create: false,
      sortField: { field: 'text', direction: 'asc' },
      placeholder: 'Gõ để tìm kiếm khách hàng...'
    });
    
    // Tự động điền SĐT/Email khi chọn
    tomSelectInstance.on('change', (val) => {
      const found = ALL_CUSTOMERS.find(c => String(c.customerName).trim().toLowerCase() === String(val).trim().toLowerCase());
      if (found) {
        const phoneInput = document.querySelector('#form-add-project [name="customerPhone"]');
        const emailInput = document.querySelector('#form-add-project [name="customerEmail"]');
        if (phoneInput && !phoneInput.value) phoneInput.value = found.phone || '';
        if (emailInput && !emailInput.value) emailInput.value = found.email || '';
      }
    });
  }
}

// Xử lý giao diện chọn Khách cũ / Khách mới
const customerTypeSelect = document.getElementById('select-customer-type');
const wrapperOld = document.getElementById('wrapper-customer-old');
const wrapperNew = document.getElementById('wrapper-customer-new');
const inputNew = document.getElementById('input-customer-new');

if (customerTypeSelect && wrapperOld && wrapperNew) {
  customerTypeSelect.addEventListener('change', () => {
    if (customerTypeSelect.value === 'Khách cũ') {
      wrapperOld.style.display = 'block';
      wrapperNew.style.display = 'none';
      inputNew.removeAttribute('required');
      if (!tomSelectInstance) initTomSelect();
    } else {
      wrapperOld.style.display = 'none';
      wrapperNew.style.display = 'block';
      inputNew.setAttribute('required', 'true');
      
      // Xoá sđt/email cũ nếu chuyển sang khách mới
      document.querySelector('#form-add-project [name="customerPhone"]').value = '';
      document.querySelector('#form-add-project [name="customerEmail"]').value = '';
    }
  });
}
