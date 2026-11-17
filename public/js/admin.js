/**
 * Page 7: System Administration Controller
 */
document.addEventListener('DOMContentLoaded', () => {
    const addReadingForm = document.getElementById('addReadingForm');
    const manageApForm = document.getElementById('manageApForm');
    const alertBox = document.getElementById('operationAlert');
    const alertTitle = document.getElementById('operationAlertTitle');
    const alertMsg = document.getElementById('operationAlertMsg');

    // Load Live Row Counts from Database
    async function loadAuditMetrics() {
        try {
            const res = await API.getAnalyticsSummary();
            const { monitoring_period, incident_overview } = res.data;
            const overviewRes = await API.getOverview();
            const { summary } = overviewRes.data;

            // Target KPI cards
            const kpiValues = document.querySelectorAll('.kpi-card .kpi-value');
            if (kpiValues.length >= 3) {
                kpiValues[0].textContent = summary.total_access_points;
                kpiValues[1].textContent = monitoring_period.total_readings.toLocaleString();
                kpiValues[2].textContent = incident_overview.total;
            }
        } catch (err) {
            console.error('Error fetching audit metrics:', err);
        }
    }

    function showBanner(title, message, isSuccess = true) {
        if (!alertBox) return;
        alertTitle.textContent = title;
        alertMsg.textContent = message;
        alertBox.className = `alert ${isSuccess ? 'alert-success border-success' : 'alert-danger border-danger'} mb-4 py-3 px-4`;
        alertBox.classList.remove('d-none');
        alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Input Validation for Entering New Simulated Reading
    if (addReadingForm) {
        addReadingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const apId = document.getElementById('adminApSelect').value;
            const timestamp = document.getElementById('adminReadingTimestamp').value.trim();
            const latencyStr = document.getElementById('adminReadingLatency').value;
            const packetLossStr = document.getElementById('adminReadingPacketLoss').value;
            const isUp = document.getElementById('adminReadingIsUp').checked;

            const packetLoss = parseFloat(packetLossStr);
            if (isNaN(packetLoss) || packetLoss < 0 || packetLoss > 100) {
                showBanner('VALIDATION ERROR', 'Packet loss percentage must be between 0 and 100.', false);
                return;
            }

            if (latencyStr !== '') {
                const latency = parseFloat(latencyStr);
                if (isNaN(latency) || latency < 0) {
                    showBanner('VALIDATION ERROR', 'Latency cannot be negative.', false);
                    return;
                }
            }

            if (!isUp && latencyStr !== '') {
                showBanner('VALIDATION NOTICE', 'Offline devices (is_up = false) typically have NULL latency. Latency input will be ignored for offline reading.', true);
            }

            showBanner(
                'INPUT VALIDATED & STAGED',
                `Telemetry input validated successfully for ${apId} at ${timestamp}. Write mutations to PostgreSQL will be enabled in Phase 6.`,
                true
            );
        });
    }

    // Input Validation for Managing Access Points
    if (manageApForm) {
        manageApForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const apId = document.getElementById('adminNewApId').value.trim();
            const building = document.getElementById('adminNewBuilding').value.trim();
            const location = document.getElementById('adminNewLocation').value.trim();

            if (!apId || !building || !location) {
                showBanner('VALIDATION ERROR', 'All fields (AP ID, Building, Location) are required.', false);
                return;
            }

            showBanner(
                'HARDWARE REGISTRATION VALIDATED',
                `Access Point profile for ${apId} in ${building} (${location}) is verified and ready for persistence. Write mutations will be enabled in Phase 6.`,
                true
            );
        });
    }

    // Initial load
    loadAuditMetrics();
});
