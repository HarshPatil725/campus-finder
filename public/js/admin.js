/**
 * Page 7: System Administration Controller (Phase 6 Write Operations)
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

    // Functionality 1: Add Network Reading into PostgreSQL
    if (addReadingForm) {
        addReadingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const apId = document.getElementById('adminApSelect').value;
            const timestamp = document.getElementById('adminReadingTimestamp').value.trim();
            const latencyStr = document.getElementById('adminReadingLatency').value;
            const packetLossStr = document.getElementById('adminReadingPacketLoss').value;
            const isUp = document.getElementById('adminReadingIsUp').checked;

            if (!apId) {
                showBanner('VALIDATION ERROR', 'Please select a target access point.', false);
                return;
            }

            if (!timestamp) {
                showBanner('VALIDATION ERROR', 'Timestamp is required.', false);
                return;
            }

            const packetLoss = parseFloat(packetLossStr);
            if (isNaN(packetLoss) || packetLoss < 0 || packetLoss > 100) {
                showBanner('VALIDATION ERROR', 'Packet loss percentage must be between 0 and 100.', false);
                return;
            }

            let latency = null;
            if (isUp) {
                if (latencyStr !== '') {
                    latency = parseFloat(latencyStr);
                    if (isNaN(latency) || latency < 0) {
                        showBanner('VALIDATION ERROR', 'Latency cannot be negative.', false);
                        return;
                    }
                } else {
                    latency = 0;
                }
            } else {
                latency = null;
            }

            try {
                const readingPayload = {
                    access_point_id: apId,
                    timestamp,
                    latency_ms: latency,
                    packet_loss_pct: packetLoss,
                    is_up: isUp,
                };

                const res = await API.createReading(readingPayload);
                showBanner(
                    'READING RECORDED IN POSTGRESQL',
                    `Successfully persisted reading #${res.data.reading_id} for ${res.data.access_point_id} at ${res.data.timestamp}.`,
                    true
                );

                // Reset inputs and refresh audit counts
                addReadingForm.reset();
                document.getElementById('adminReadingIsUp').checked = true;
                await loadAuditMetrics();

            } catch (err) {
                console.error('Error inserting reading:', err);
                showBanner('DATABASE INSERTION FAILED', err.message, false);
            }
        });
    }

    // Functionality: Manage Access Point Registry
    if (manageApForm) {
        manageApForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const apId = document.getElementById('adminNewApId').value.trim();
            const building = document.getElementById('adminNewBuilding').value.trim();
            const location = document.getElementById('adminNewLocation').value.trim();

            if (!apId || !building || !location) {
                showBanner('VALIDATION ERROR', 'All fields (AP ID, Building, Location) are required.', false);
                return;
            }

            try {
                const res = await API.updateAccessPoint(apId, { building, location });
                showBanner(
                    'HARDWARE REGISTRY UPDATED',
                    `Access point ${res.data.access_point_id} updated: Building="${res.data.building}", Location="${res.data.location}".`,
                    true
                );
                await loadAuditMetrics();
            } catch (err) {
                showBanner('UPDATE FAILED', err.message, false);
            }
        });
    }

    // Initial load
    loadAuditMetrics();
});
