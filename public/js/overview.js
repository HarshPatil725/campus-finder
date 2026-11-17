/**
 * Page 1: Network Overview Controller
 */
document.addEventListener('DOMContentLoaded', () => {
    const buildingFilter = document.getElementById('buildingFilter');
    const apTableBody = document.getElementById('overviewAPTableBody');
    const incidentTableBody = document.getElementById('overviewIncidentTableBody');

    // KPI Elements
    const kpiTotalAPs = document.getElementById('kpiTotalAPs');
    const kpiHealthyAPs = document.getElementById('kpiHealthyAPs');
    const kpiDegradedAPs = document.getElementById('kpiDegradedAPs');
    const kpiDownAPs = document.getElementById('kpiDownAPs');
    const kpiTotalIncidents = document.getElementById('kpiTotalIncidents');
    const kpiUnresolvedIncidents = document.getElementById('kpiUnresolvedIncidents');

    async function loadOverviewData(building = '') {
        try {
            // Loading placeholder state
            apTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="state-placeholder py-4">
                        <div class="state-placeholder-icon"><i class="bi bi-arrow-repeat spin"></i></div>
                        <div class="state-placeholder-title">Fetching Real Telemetry...</div>
                        <div class="state-placeholder-text">Querying PostgreSQL /api/overview</div>
                    </td>
                </tr>
            `;

            const res = await API.getOverview(building);
            const { summary, recent_incidents, latest_readings } = res.data;

            // 1. Update KPIs
            kpiTotalAPs.textContent = summary.total_access_points;
            kpiHealthyAPs.textContent = summary.healthy_access_points;
            kpiDegradedAPs.textContent = summary.degraded_access_points;
            kpiDownAPs.textContent = summary.down_access_points;
            kpiTotalIncidents.textContent = summary.total_incidents;
            kpiUnresolvedIncidents.textContent = summary.unresolved_incidents;

            // 2. Render Latest Access Point Statuses
            if (!latest_readings || latest_readings.length === 0) {
                apTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center py-4 text-muted mono-label">No access points found for selected filter</td>
                    </tr>
                `;
            } else {
                apTableBody.innerHTML = latest_readings.map(ap => `
                    <tr>
                        <td class="fw-bold font-monospace">${ap.access_point_id}</td>
                        <td>${ap.building}</td>
                        <td class="text-muted">${ap.location}</td>
                        <td class="font-monospace">${UIUtils.formatLatency(ap.latency_ms)}</td>
                        <td class="font-monospace">${UIUtils.formatPacketLoss(ap.packet_loss_pct)}</td>
                        <td>${UIUtils.getStatusBadge(ap.health_status)}</td>
                    </tr>
                `).join('');
            }

            // 3. Render Recent Incidents
            if (!recent_incidents || recent_incidents.length === 0) {
                incidentTableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center py-4 text-muted mono-label">No recorded incidents for selected filter</td>
                    </tr>
                `;
            } else {
                incidentTableBody.innerHTML = recent_incidents.map(inc => `
                    <tr>
                        <td class="font-monospace fw-bold">
                            <a href="/investigation.html?id=${inc.incident_id}" class="text-dark text-decoration-underline">${inc.incident_id}</a>
                        </td>
                        <td class="font-monospace">${inc.access_point_id}</td>
                        <td>${UIUtils.getStatusBadge(inc.status)}</td>
                        <td class="small text-muted">${inc.suspected_cause}</td>
                    </tr>
                `).join('');
            }

        } catch (err) {
            console.error('Error loading overview:', err);
            apTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-danger p-4 text-center">
                        <i class="bi bi-exclamation-triangle-fill fs-3 d-block mb-2"></i>
                        Failed to fetch overview data from server. ${err.message}
                    </td>
                </tr>
            `;
        }
    }

    // Filter change handler
    if (buildingFilter) {
        buildingFilter.addEventListener('change', (e) => {
            loadOverviewData(e.target.value);
        });
    }

    // Initial load
    loadOverviewData();
});
