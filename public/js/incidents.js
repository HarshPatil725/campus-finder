/**
 * Page 4: Incident Management Controller (Phase 6 Write Operations)
 */
document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('incidentsTableBody');
    const searchInput = document.getElementById('incidentSearchInput');
    const statusFilter = document.getElementById('incidentStatusFilter');
    const buildingFilter = document.getElementById('incidentBuildingFilter');
    const resetBtn = document.getElementById('btnResetIncidentFilters');
    const btnSaveIncident = document.getElementById('btnSaveIncident');

    async function loadIncidents() {
        const search = searchInput ? searchInput.value.trim() : '';
        const status = statusFilter ? statusFilter.value : '';
        const building = buildingFilter ? buildingFilter.value : '';

        try {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="state-placeholder py-4">
                        <div class="state-placeholder-icon"><i class="bi bi-arrow-repeat spin"></i></div>
                        <div class="state-placeholder-title">Loading Incidents...</div>
                        <div class="state-placeholder-text">Querying /api/incidents</div>
                    </td>
                </tr>
            `;

            const res = await API.getIncidents({ search, status, building });
            const incidents = res.data;

            if (!incidents || incidents.length === 0) {
                tableBody.innerHTML = `
                    <tr><td colspan="9" class="text-center py-4 text-muted mono-label">No incidents found matching current filters</td></tr>
                `;
                return;
            }

            tableBody.innerHTML = incidents.map(inc => `
                <tr>
                    <td class="font-monospace fw-bold">${inc.incident_id}</td>
                    <td class="font-monospace">${inc.access_point_id}</td>
                    <td>${inc.building} <span class="text-muted small">(${inc.location})</span></td>
                    <td class="font-monospace small">${UIUtils.formatTimestamp(inc.start_time)}</td>
                    <td class="font-monospace small text-muted">${inc.end_time ? UIUtils.formatTimestamp(inc.end_time) : '<span class="text-danger fw-bold">ONGOING</span>'}</td>
                    <td>${UIUtils.getStatusBadge(inc.status)}</td>
                    <td class="small">${inc.suspected_cause}</td>
                    <td class="small text-muted">${inc.resolution || '<span class="fst-italic text-muted">Pending investigation</span>'}</td>
                    <td>
                        <a href="/investigation.html?id=${inc.incident_id}" class="btn btn-sm btn-editorial-outline">
                            INVESTIGATE &rarr;
                        </a>
                    </td>
                </tr>
            `).join('');

        } catch (err) {
            console.error('Error loading incidents:', err);
            tableBody.innerHTML = `
                <tr><td colspan="9" class="text-danger p-4 text-center">Failed to load incidents: ${err.message}</td></tr>
            `;
        }
    }

    // Functionality 2: Register New Incident
    if (btnSaveIncident) {
        btnSaveIncident.addEventListener('click', async () => {
            const apId = document.getElementById('formApId').value;
            const startTime = document.getElementById('formStartTime').value.trim();
            const status = document.getElementById('formStatus').value;
            const suspectedCause = document.getElementById('formSuspectedCause').value.trim();
            const endTime = document.getElementById('formEndTime').value.trim();
            const resolution = document.getElementById('formResolution').value.trim();

            if (!apId || !startTime || !suspectedCause) {
                alert('Please fill out all required fields: Access Point, Start Time, and Suspected Cause.');
                return;
            }

            if (status === 'Resolved' && (!resolution || !endTime)) {
                alert('Resolved incidents strictly require both an End Time and Resolution notes.');
                return;
            }

            try {
                const payload = {
                    access_point_id: apId,
                    start_time: startTime,
                    status,
                    suspected_cause: suspectedCause,
                    end_time: endTime || null,
                    resolution: resolution || null,
                };

                const res = await API.createIncident(payload);
                alert(`Incident ${res.data.incident_id} registered successfully in PostgreSQL!`);

                // Close modal
                const modalEl = document.getElementById('registerIncidentModal');
                const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                modal.hide();

                // Reset form
                document.getElementById('incidentForm').reset();

                // Reload incidents list
                await loadIncidents();

            } catch (err) {
                console.error('Error saving incident:', err);
                alert(`Failed to register incident: ${err.message}`);
            }
        });
    }

    // Search and filter listeners
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(loadIncidents, 250);
        });
    }

    if (statusFilter) statusFilter.addEventListener('change', loadIncidents);
    if (buildingFilter) buildingFilter.addEventListener('change', loadIncidents);

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (statusFilter) statusFilter.value = '';
            if (buildingFilter) buildingFilter.value = '';
            loadIncidents();
        });
    }

    // Initial load
    loadIncidents();
});
