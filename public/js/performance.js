/**
 * Page 3: Network Performance Controller with Chart.js
 */
document.addEventListener('DOMContentLoaded', () => {
    let latencyChartInstance = null;
    let packetLossChartInstance = null;

    let currentPage = 1;
    const limit = 50;

    const buildingSelect = document.getElementById('perfBuildingSelect');
    const apSelect = document.getElementById('perfApSelect');
    const startDateInput = document.getElementById('perfStartDate');
    const endDateInput = document.getElementById('perfEndDate');
    const applyBtn = document.getElementById('btnApplyPerfFilters');

    const readingsTableBody = document.getElementById('readingsTableBody');
    const readingsCountLabel = document.getElementById('readingsCountLabel');
    const currentPageNum = document.getElementById('currentPageNum');
    const totalPagesNum = document.getElementById('totalPagesNum');
    const btnPrevPage = document.getElementById('btnPrevPage');
    const btnNextPage = document.getElementById('btnNextPage');

    const latencyPlaceholder = document.getElementById('latencyPlaceholder');
    const packetLossPlaceholder = document.getElementById('packetLossPlaceholder');

    async function loadPerformanceData() {
        const building = buildingSelect ? buildingSelect.value : '';
        const access_point_id = apSelect ? apSelect.value : '';
        const start_date = startDateInput ? startDateInput.value : '';
        const end_date = endDateInput ? endDateInput.value : '';

        // 1. Fetch readings for table (paginated)
        await loadTableReadings({ building, access_point_id, start_date, end_date, page: currentPage, limit });

        // 2. Fetch readings for charts (up to 500 points for smooth trend line)
        await loadChartData({ building, access_point_id, start_date, end_date, limit: 500, sort: 'ASC' });
    }

    async function loadTableReadings(params) {
        try {
            readingsTableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="state-placeholder py-4">
                        <div class="state-placeholder-icon"><i class="bi bi-arrow-repeat spin"></i></div>
                        <div class="state-placeholder-title">Loading Telemetry Records...</div>
                        <div class="state-placeholder-text">Querying /api/readings</div>
                    </td>
                </tr>
            `;

            const res = await API.getReadings(params);
            const { pagination, data } = res;

            readingsCountLabel.textContent = `Showing ${data.length} of ${pagination.total_records} total readings`;
            currentPageNum.textContent = pagination.page;
            totalPagesNum.textContent = pagination.total_pages;

            btnPrevPage.disabled = pagination.page <= 1;
            btnNextPage.disabled = pagination.page >= pagination.total_pages;

            if (data.length === 0) {
                readingsTableBody.innerHTML = `
                    <tr><td colspan="8" class="text-center py-4 text-muted mono-label">No network readings match selected criteria</td></tr>
                `;
                return;
            }

            readingsTableBody.innerHTML = data.map(r => `
                <tr>
                    <td class="font-monospace">${r.reading_id}</td>
                    <td class="font-monospace small">${UIUtils.formatTimestamp(r.timestamp)}</td>
                    <td class="font-monospace fw-bold">${r.access_point_id}</td>
                    <td>${r.building} <span class="text-muted small">(${r.location})</span></td>
                    <td class="font-monospace">${UIUtils.formatLatency(r.latency_ms)}</td>
                    <td class="font-monospace">${UIUtils.formatPacketLoss(r.packet_loss_pct)}</td>
                    <td>${r.is_up ? '<span class="text-success fw-bold">TRUE</span>' : '<span class="text-danger fw-bold">FALSE</span>'}</td>
                    <td>${UIUtils.getStatusBadge(r.health_status)}</td>
                </tr>
            `).join('');

        } catch (err) {
            console.error('Error fetching table readings:', err);
            readingsTableBody.innerHTML = `
                <tr><td colspan="8" class="text-danger p-4 text-center">Failed to load readings: ${err.message}</td></tr>
            `;
        }
    }

    async function loadChartData(params) {
        try {
            const res = await API.getReadings(params);
            const readings = res.data;

            if (!readings || readings.length === 0) {
                if (latencyPlaceholder) latencyPlaceholder.classList.remove('d-none');
                if (packetLossPlaceholder) packetLossPlaceholder.classList.remove('d-none');
                return;
            }

            if (latencyPlaceholder) latencyPlaceholder.classList.add('d-none');
            if (packetLossPlaceholder) packetLossPlaceholder.classList.add('d-none');

            // Format data labels and points (preserving null for offline readings!)
            const labels = readings.map(r => UIUtils.formatTimestamp(r.timestamp));
            const latencyData = readings.map(r => r.latency_ms !== null ? parseFloat(r.latency_ms) : null);
            const packetLossData = readings.map(r => parseFloat(r.packet_loss_pct));

            renderCharts(labels, latencyData, packetLossData);

        } catch (err) {
            console.error('Error fetching chart data:', err);
        }
    }

    function renderCharts(labels, latencyData, packetLossData) {
        const latencyCtx = document.getElementById('latencyChart').getContext('2d');
        const packetLossCtx = document.getElementById('packetLossChart').getContext('2d');

        // Common Chart styling options
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#111111',
                    titleFont: { family: "'Space Mono', monospace", size: 12 },
                    bodyFont: { family: "'Inter', sans-serif", size: 13 },
                    cornerRadius: 0,
                    padding: 10,
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(217, 210, 194, 0.4)' },
                    ticks: {
                        font: { family: "'Space Mono', monospace", size: 10 },
                        color: '#77736B',
                        maxTicksLimit: 8
                    }
                },
                y: {
                    grid: { color: 'rgba(217, 210, 194, 0.4)' },
                    ticks: {
                        font: { family: "'Space Mono', monospace", size: 10 },
                        color: '#77736B'
                    }
                }
            }
        };

        // 1. Latency Chart (Handles null gracefully with spanGaps: false)
        if (latencyChartInstance) latencyChartInstance.destroy();
        latencyChartInstance = new Chart(latencyCtx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Latency (ms)',
                    data: latencyData,
                    borderColor: '#111111',
                    backgroundColor: 'rgba(17, 17, 17, 0.05)',
                    borderWidth: 1.8,
                    pointRadius: 1.5,
                    pointHoverRadius: 4,
                    spanGaps: false, // Explicitly break line when device is offline (null latency)
                    fill: false,
                }]
            },
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: {
                        ...commonOptions.scales.y,
                        title: { display: true, text: 'Milliseconds (ms)', font: { family: "'Space Mono', monospace", size: 10 } }
                    }
                }
            }
        });

        // 2. Packet Loss Chart
        if (packetLossChartInstance) packetLossChartInstance.destroy();
        packetLossChartInstance = new Chart(packetLossCtx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Packet Loss (%)',
                    data: packetLossData,
                    borderColor: '#FF3D0A',
                    backgroundColor: 'rgba(255, 61, 10, 0.08)',
                    borderWidth: 1.8,
                    pointRadius: 1.5,
                    pointHoverRadius: 4,
                    fill: true,
                }]
            },
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: {
                        ...commonOptions.scales.y,
                        min: 0,
                        max: 100,
                        title: { display: true, text: 'Packet Loss (%)', font: { family: "'Space Mono', monospace", size: 10 } }
                    }
                }
            }
        });
    }

    // Pagination Listeners
    if (btnPrevPage) {
        btnPrevPage.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadPerformanceData();
            }
        });
    }

    if (btnNextPage) {
        btnNextPage.addEventListener('click', () => {
            currentPage++;
            loadPerformanceData();
        });
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            currentPage = 1;
            loadPerformanceData();
        });
    }

    // Initial load
    loadPerformanceData();
});
