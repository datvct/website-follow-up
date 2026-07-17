// REPORTS.JS
let reportChart = null;
let CURRENT_REPORT = 'sales'; // 'sales' | 'customer' | 'day' | 'week' | 'month'

const REPORT_TITLES = {
  sales: '<i class="ti ti-users"></i> Theo sales phụ trách',
  customer: '<i class="ti ti-building"></i> Theo Khách hàng / Công ty',
  day: '<i class="ti ti-calendar-event"></i> Theo ngày báo giá',
  week: '<i class="ti ti-calendar-week"></i> Theo tuần',
  month: '<i class="ti ti-calendar"></i> Theo tháng'
};

function loadReports() {
  renderCurrentReport();
}

function getReportGroups() {
  if (CURRENT_REPORT === 'sales') return groupBySales(ALL_PROJECTS);
  if (CURRENT_REPORT === 'customer') {
    // Sắp xếp các khách hàng có doanh thu đã chốt lớn nhất lên đầu
    return groupByCustomer(ALL_PROJECTS).sort((a, b) => b.closedRevenue - a.closedRevenue);
  }
  if (CURRENT_REPORT === 'day') return lastBuckets(groupByDay(ALL_PROJECTS), 30);
  if (CURRENT_REPORT === 'week') return lastBuckets(groupByWeek(ALL_PROJECTS), 12);
  return lastBuckets(groupByMonth(ALL_PROJECTS), 12);
}

function renderCurrentReport() {
  document.getElementById('report-list-title').innerHTML = REPORT_TITLES[CURRENT_REPORT];
  const groups = getReportGroups();
  renderReportList(groups);
  renderReportChart(groups);
}

function renderReportList(rows) {
  const box = document.getElementById('report-list-box');
  if (!rows.length) { box.innerHTML = '<div class="text-muted small">Chưa có dữ liệu.</div>'; return; }
  
  if (CURRENT_REPORT === 'customer') {
    // Tạo bản đồ tra cứu thông tin liên hệ của khách hàng từ danh sách ALL_CUSTOMERS
    const contactMap = {};
    if (window.ALL_CUSTOMERS) {
      ALL_CUSTOMERS.forEach((c) => {
        contactMap[String(c.customerName).trim().toLowerCase()] = { phone: c.phone, email: c.email };
      });
    }

    box.innerHTML = rows.map((r) => {
      const cleanName = String(r.label).trim().toLowerCase();
      const contact = contactMap[cleanName] || { phone: '', email: '' };
      const contactStr = [contact.phone, contact.email].filter(Boolean).join(' · ');

      return `
        <div class="report-row">
          <div>
            <div class="label">${r.label}</div>
            <div class="sub text-muted small" style="font-size: 0.76rem; margin-top: 2px;">${contactStr || 'Chưa cập nhật thông tin liên hệ'}</div>
            <div class="sub" style="font-size: 0.76rem; color: var(--muted); margin-top: 4px;">Tổng cộng: ${r.totalQuotes} cơ hội</div>
          </div>
          <div class="text-end">
            <div class="fw-semibold text-success">Đã chốt: ${formatVND(r.closedRevenue)}</div>
            <div class="sub" style="font-size: 0.76rem; color: var(--muted); margin-top: 4px;">Kỳ vọng: ${formatVND(r.expectedRevenue)}</div>
          </div>
        </div>`;
    }).join('');
    return;
  }

  const display = CURRENT_REPORT === 'sales' ? rows : rows.slice().reverse();
  box.innerHTML = display.map((r) => `
    <div class="report-row">
      <div>
        <div class="label">${r.label}</div>
        <div class="sub">${r.totalQuotes} báo giá</div>
      </div>
      <div class="text-end">
        <div>${formatVND(r.expectedRevenue)}</div>
        <div class="sub">Đã chốt: ${formatVND(r.closedRevenue)}</div>
      </div>
    </div>`).join('');
}

function renderReportChart(rows) {
  if (reportChart) reportChart.destroy();
  
  // Tránh vẽ quá nhiều cột gây vỡ biểu đồ, nếu là khách hàng chỉ hiển thị Top 8
  let chartData = rows;
  if (CURRENT_REPORT === 'customer') {
    chartData = rows.slice(0, 8);
  }

  reportChart = new Chart(document.getElementById('chart-report'), {
    type: 'bar',
    data: {
      labels: chartData.map((r) => r.label),
      datasets: [
        { label: 'Doanh thu kỳ vọng', data: chartData.map((r) => r.expectedRevenue), backgroundColor: '#008080', borderRadius: 6 },
        { label: 'Doanh thu đã chốt', data: chartData.map((r) => r.closedRevenue), backgroundColor: '#f28500', borderRadius: 6 }
      ]
    },
    options: {
      plugins: { legend: { position: 'bottom' } },
      scales: {
        y: { ticks: { callback: (v) => formatVND(v) } },
        x: { ticks: { autoSkip: true, maxRotation: 45, minRotation: 0 }, grid: { display: false } }
      }
    }
  });
}

document.getElementById('report-switch').addEventListener('click', (e) => {
  const btn = e.target.closest('.seg-btn');
  if (!btn) return;
  document.querySelectorAll('#report-switch .seg-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  CURRENT_REPORT = btn.dataset.report;
  renderCurrentReport();
});
