/**
 * Page 6: Reports and Analytics Controller
 */
document.addEventListener('DOMContentLoaded', () => {
    let healthChartInstance = null;
    let causesChartInstance = null;

    const buildingTableBody = document.getElementById('analyticsBuildingTableBody');
    const healthPlaceholder = document.getElementById('healthChartPlaceholder');
    const causesPlaceholder = document.getElementById('causesChartPlaceholder');

    async function loadAnalytics() {
        try {
            buildingTableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="state-placeholder py-4">
                        <div class="state-placeholder-icon"><i class="bi bi-arrow-repeat spin"></i></div>
                        <div class="state-placeholder-title">Aggregating Campus Telemetry...</div>
                        <div class="state-placeholder-text">Querying /api/analytics/summary</div>
                    </td>
                </tr>
            `;

            const res = await API.getAnalyticsSummary();
            const { health_distribution, building_metrics, suspected_causes } = res.data;

            // 1. Populate Building Metrics Table
            if (building_metrics && building_metrics.length > 0) {
                buildingTableBody.innerHTML = building_metrics.map(b => `
                    <tr>
                        <td class="fw-bold">${b.building}</td>
                        <td class="font-monospace">${b.access_point_count}</td>
                        <td class="font-monospace">${b.total_readings.toLocaleString()}</td>
                        <td class="font-monospace">${b.avg_latency_ms !== null ? b.avg_latency_ms + ' ms' : '--'}</td>
                        <td class="font-monospace">${b.avg_packet_loss_pct}%</td>
                        <td class="font-monospace ${b.degraded_readings > 0 ? 'text-warning fw-bold' : ''}">${b.degraded_readings}</td>
                        <td class="font-monospace ${b.down_readings > 0 ? 'text-danger fw-bold' : ''}">${b.down_readings}</td>
                        <td class="font-monospace fw-bold">${b.incident_count}</td>
                    </tr>
                `).join('');
            } else {
                buildingTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-3 text-muted">No building metrics available</td></tr>`;
            }

            // 2. Render Health Distribution Pie/Doughnut Chart
            renderHealthChart(health_distribution);

            // 3. Render Suspected Causes Bar Chart
            renderCausesChart(suspected_causes);

        } catch (err) {
            console.error('Error loading analytics:', err);
            buildingTableBody.innerHTML = `
                <tr><td colspan="8" class="text-danger p-4 text-center">Failed to load analytics: ${err.message}</td></tr>
            `;
        }
    }

    function renderHealthChart(health) {
        if (healthPlaceholder) healthPlaceholder.classList.add('d-none');
        const canvas = document.getElementById('healthPieChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (healthChartInstance) healthChartInstance.destroy();
        healthChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Healthy', 'Degraded', 'Down'],
                datasets: [{
                    data: [health.healthy, health.degraded, health.down],
                    backgroundColor: ['#247A52', '#C58A20', '#C83225'],
                    borderColor: '#F8F5EB',
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { family: "'Space Mono', monospace", size: 11 },
                            color: '#111111',
                            padding: 16
                        }
                    },
                    tooltip: {
                        backgroundColor: '#111111',
                        titleFont: { family: "'Space Mono', monospace" },
                        bodyFont: { family: "'Inter', sans-serif" },
                        cornerRadius: 0,
                    }
                }
            }
        });
    }

    function renderCausesChart(causes) {
        if (causesPlaceholder) causesPlaceholder.classList.add('d-none');
        const canvas = document.getElementById('causesBarChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const labels = causes.map(c => c.suspected_cause);
        const data = causes.map(c => c.count);

        if (causesChartInstance) causesChartInstance.destroy();
        causesChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Occurrences',
                    data,
                    backgroundColor: '#FF3D0A',
                    borderColor: '#111111',
                    borderWidth: 1,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Horizontal bars for clean editorial readability
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#111111',
                        cornerRadius: 0,
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(217, 210, 194, 0.4)' },
                        ticks: { stepSize: 1, font: { family: "'Space Mono', monospace" } }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { font: { family: "'Inter', sans-serif", size: 12 }, color: '#111111' }
                    }
                }
            }
        });
    }

    // Initial load
    loadAnalytics();
});
