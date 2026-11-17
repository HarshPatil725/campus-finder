/**
 * Page 5: Incident Investigation Controller (Phase 6 Write Operations)
 */
document.addEventListener('DOMContentLoaded', () => {
    const selectEl = document.getElementById('investigationSelect');
    const invIncidentId = document.getElementById('invIncidentId');
    const invStatusBadge = document.getElementById('invStatusBadge');
    const invApId = document.getElementById('invApId');
    const invBuildingLocation = document.getElementById('invBuildingLocation');
    const invStartTime = document.getElementById('invStartTime');
    const invEndTime = document.getElementById('invEndTime');
    const invSuspectedCause = document.getElementById('invSuspectedCause');
    const invResolution = document.getElementById('invResolution');
    const readingsTableBody = document.getElementById('invReadingsTableBody');

    // Update Form Elements
    const updateForm = document.getElementById('updateIncidentForm');
    const updateStatusSelect = document.getElementById('updateStatusSelect');
    const updateSuspectedCauseInput = document.getElementById('updateSuspectedCauseInput');
    const updateEndTimeInput = document.getElementById('updateEndTimeInput');
    const updateResolutionTextarea = document.getElementById('updateResolutionTextarea');
    const invUpdateAlert = document.getElementById('invUpdateAlert');

    let currentIncident = null;

    // Read ?id= from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    let currentIncidentId = urlParams.get('id') || 'INC-001';

    async function initializeDropdown() {
        try {
            const res = await API.getIncidents();
            const incidents = res.data;

            if (selectEl && incidents && incidents.length > 0) {
                selectEl.innerHTML = incidents.map(inc => `
                    <option value="${inc.incident_id}" ${inc.incident_id === currentIncidentId ? 'selected' : ''}>
                        ${inc.incident_id} &bull; ${inc.access_point_id} (${inc.building}) &bull; [${inc.status}]
                    </option>
                `).join('');
            }
        } catch (err) {
            console.error('Error populating incident dropdown:', err);
        }
    }

    async function loadIncidentInvestigation(incidentId) {
        try {
            currentIncidentId = incidentId;
            readingsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="state-placeholder py-4">
                        <div class="state-placeholder-icon"><i class="bi bi-arrow-repeat spin"></i></div>
                        <div class="state-placeholder-title">Loading Telemetry Evidence...</div>
                        <div class="state-placeholder-text">Querying /api/incidents/${incidentId}</div>
                    </td>
                </tr>
            `;

            const res = await API.getIncidentById(incidentId);
            const inc = res.data;
            currentIncident = inc;

            invIncidentId.textContent = inc.incident_id;
            invStatusBadge.innerHTML = UIUtils.getStatusBadge(inc.status);
            invApId.textContent = inc.access_point_id;
            invBuildingLocation.textContent = `${inc.building} \u2022 ${inc.location}`;
            invStartTime.textContent = `START: ${UIUtils.formatTimestamp(inc.start_time)}`;
            invEndTime.textContent = `END: ${inc.end_time ? UIUtils.formatTimestamp(inc.end_time) : 'ONGOING / UNRESOLVED'}`;
            invSuspectedCause.textContent = inc.suspected_cause;
            invResolution.textContent = inc.resolution || 'Resolution pending. Incident remains open or actively undergoing investigation.';

            // Populate update form inputs
            if (updateStatusSelect) updateStatusSelect.value = inc.status;
            if (updateSuspectedCauseInput) updateSuspectedCauseInput.value = inc.suspected_cause || '';
            if (updateEndTimeInput) updateEndTimeInput.value = inc.end_time ? UIUtils.formatTimestamp(inc.end_time) : '';
            if (updateResolutionTextarea) updateResolutionTextarea.value = inc.resolution || '';

            const readings = inc.related_readings || [];

            if (readings.length === 0) {
                readingsTableBody.innerHTML = `
                    <tr><td colspan="6" class="text-center py-4 text-muted mono-label">No related telemetry readings captured in window.</td></tr>
                `;
                return;
            }

            readingsTableBody.innerHTML = readings.map(r => `
                <tr>
                    <td class="font-monospace small">${UIUtils.formatTimestamp(r.timestamp)}</td>
                    <td class="font-monospace">${r.reading_id}</td>
                    <td class="font-monospace fw-bold">${UIUtils.formatLatency(r.latency_ms)}</td>
                    <td class="font-monospace fw-bold">${UIUtils.formatPacketLoss(r.packet_loss_pct)}</td>
                    <td>${r.is_up ? '<span class="text-success fw-bold">TRUE</span>' : '<span class="text-danger fw-bold">FALSE</span>'}</td>
                    <td>${UIUtils.getStatusBadge(r.health_status)}</td>
                </tr>
            `).join('');

        } catch (err) {
            console.error('Error loading investigation:', err);
            readingsTableBody.innerHTML = `
                <tr><td colspan="6" class="text-danger p-4 text-center">Failed to load incident investigation: ${err.message}</td></tr>
            `;
        }
    }

    // Functionality 3: Update Incident & Resolution in PostgreSQL
    if (updateForm) {
        updateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newStatus = updateStatusSelect.value;
            const newCause = updateSuspectedCauseInput.value.trim();
            const newEndTime = updateEndTimeInput.value.trim();
            const newResolution = updateResolutionTextarea.value.trim();

            if (newStatus === 'Resolved') {
                if (!newResolution) {
                    alert('Resolution details are strictly required when marking an incident as Resolved.');
                    return;
                }
                if (!newEndTime) {
                    alert('End time is required when marking an incident as Resolved.');
                    return;
                }
            }

            try {
                const payload = {
                    status: newStatus,
                    suspected_cause: newCause,
                    end_time: newEndTime || null,
                    resolution: newResolution || null,
                };

                const res = await API.updateIncident(currentIncidentId, payload);

                if (invUpdateAlert) {
                    invUpdateAlert.className = 'alert alert-success py-2 px-3 small mono-label mb-3';
                    invUpdateAlert.textContent = `Incident ${res.data.incident_id} successfully updated to "${res.data.status}".`;
                    invUpdateAlert.classList.remove('d-none');
                }

                // Refresh incident details and dropdown list
                await loadIncidentInvestigation(currentIncidentId);
                await initializeDropdown();

            } catch (err) {
                console.error('Error updating incident:', err);
                if (invUpdateAlert) {
                    invUpdateAlert.className = 'alert alert-danger py-2 px-3 small mono-label mb-3';
                    invUpdateAlert.textContent = `Update failed: ${err.message}`;
                    invUpdateAlert.classList.remove('d-none');
                }
            }
        });
    }

    if (selectEl) {
        selectEl.addEventListener('change', (e) => {
            const selectedId = e.target.value;
            history.pushState(null, '', `?id=${encodeURIComponent(selectedId)}`);
            loadIncidentInvestigation(selectedId);
        });
    }

    // Initialize dropdown and load target incident
    initializeDropdown().then(() => {
        loadIncidentInvestigation(currentIncidentId);
    });
});
