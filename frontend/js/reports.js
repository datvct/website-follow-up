// REPORTS.JS
let reportChart = null;
let CURRENT_REPORT = 'sales'; // 'sales' | 'day' | 'week' | 'month'

const REPORT_TITLES = {
  sales: '<i class="ti ti-users"></i> Theo sales phụ trách',
  day: '<i class="ti ti-calendar-event"></i> Theo ngày báo giá',
  week: '<i class="ti ti-calendar-week"></i> Theo tuần',
  month: '<i class="ti ti-calendar"></i> Theo tháng'
};

function loadReports() {
  renderCurrentReport();
}

function getReportGroups() {
  if (CURRENT_REPORT === 'sales') return groupBySales(ALL_PROJECTS);
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
  // Với báo cáo theo ngày/tuần/tháng, hiển thị mới nhất lên trên; theo sales giữ nguyên thứ tự A-Z.
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
  reportChart = new Chart(document.getElementById('chart-report'), {
    type: 'bar',
    data: {
      labels: rows.map((r) => r.label),
      datasets: [
        { label: 'Doanh thu kỳ vọng', data: rows.map((r) => r.expectedRevenue), backgroundColor: '#0f6e56', borderRadius: 6 },
        { label: 'Doanh thu đã chốt', data: rows.map((r) => r.closedRevenue), backgroundColor: '#c98a1f', borderRadius: 6 }
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
