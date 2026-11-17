/**
 * Page 2: Access Point Directory Controller
 */
document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('apDirectoryTableBody');
    const searchInput = document.getElementById('apSearchInput');
    const buildingFilter = document.getElementById('apBuildingFilter');
    const statusFilter = document.getElementById('apStatusFilter');

    // Details Drawer Elements
    const detailsPanel = document.getElementById('apDetailsPanel');
    const detailApId = document.getElementById('detailApId');
    const detailBuilding = document.getElementById('detailBuilding');
    const detailLocation = document.getElementById('detailLocation');
    const detailStatusBadge = document.getElementById('detailStatusBadge');
    const detailIncidentTableBody = document.getElementById('detailIncidentTableBody');

    async function loadAccessPoints() {
        const search = searchInput ? searchInput.value.trim() : '';
        const building = buildingFilter ? buildingFilter.value : '';
        const status = statusFilter ? statusFilter.value : '';

        try {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="state-placeholder py-4">
                        <div class="state-placeholder-icon"><i class="bi bi-arrow-repeat spin"></i></div>
                        <div class="state-placeholder-title">Loading Access Points...</div>
                        <div class="state-placeholder-text">Querying /api/access-points</div>
                    </td>
                </tr>
            `;

            const res = await API.getAccessPoints({ search, building, status });
            const accessPoints = res.data;

            if (!accessPoints || accessPoints.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center py-4 text-muted mono-label">
                            No access points found matching criteria.
                        </td>
                    </tr>
                `;
                return;
            }

            tableBody.innerHTML = accessPoints.map(ap => `
                <tr>
                    <td class="font-monospace fw-bold">${ap.access_point_id}</td>
                    <td>${ap.building}</td>
                    <td class="text-muted">${ap.location}</td>
                    <td class="font-monospace">${UIUtils.formatLatency(ap.latest_latency_ms)}</td>
                    <td class="font-monospace">${UIUtils.formatPacketLoss(ap.latest_packet_loss_pct)}</td>
                    <td>${UIUtils.getStatusBadge(ap.current_status)}</td>
                    <td class="font-monospace small text-muted">${UIUtils.formatTimestamp(ap.latest_reading_timestamp)}</td>
                    <td>
                        <button type="button" class="btn btn-sm btn-editorial-outline btn-view-detail" data-ap-id="${ap.access_point_id}">
                            DETAILS <i class="bi bi-chevron-right"></i>
                        </button>
                    </td>
                </tr>
            `).join('');

            // Attach click listeners to Details buttons
            document.querySelectorAll('.btn-view-detail').forEach(btn => {
                btn.addEventListener('click', () => {
                    const apId = btn.getAttribute('data-ap-id');
                    showAccessPointDetails(apId);
                });
            });

        } catch (err) {
            console.error('Error loading access points:', err);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-danger p-4 text-center">
                        <i class="bi bi-exclamation-triangle-fill fs-3 d-block mb-2"></i>
                        Failed to load access points from API. ${err.message}
                    </td>
                </tr>
            `;
        }
    }

    async function showAccessPointDetails(apId) {
        try {
            detailsPanel.style.display = 'block';
            detailApId.textContent = `${apId} (Loading...)`;
            detailIncidentTableBody.innerHTML = `
                <tr><td colspan="4" class="text-center py-3 text-muted mono-label">Fetching device history...</td></tr>
            `;

            // Scroll smoothly to details panel
            detailsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            const res = await API.getAccessPointById(apId);
            const ap = res.data;

            detailApId.textContent = ap.access_point_id;
            detailBuilding.textContent = ap.building;
            detailLocation.textContent = ap.location;
            detailStatusBadge.innerHTML = UIUtils.getStatusBadge(ap.current_status);

            if (!ap.incidents || ap.incidents.length === 0) {
                detailIncidentTableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center py-3 text-muted mono-label">
                            No historical incidents recorded for this device.
                        </td>
                    </tr>
                `;
            } else {
                detailIncidentTableBody.innerHTML = ap.incidents.map(inc => `
                    <tr>
                        <td class="font-monospace fw-bold">
                            <a href="/investigation.html?id=${inc.incident_id}" class="text-dark text-decoration-underline">${inc.incident_id}</a>
                        </td>
                        <td class="font-monospace small text-muted">${UIUtils.formatTimestamp(inc.start_time)}</td>
                        <td>${UIUtils.getStatusBadge(inc.status)}</td>
                        <td class="small">${inc.suspected_cause}</td>
                    </tr>
                `).join('');
            }
        } catch (err) {
            console.error('Error fetching details:', err);
            detailIncidentTableBody.innerHTML = `
                <tr><td colspan="4" class="text-danger py-3 text-center">Failed to load device details: ${err.message}</td></tr>
            `;
        }
    }

    // Debounced search input
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(loadAccessPoints, 250);
        });
    }

    if (buildingFilter) buildingFilter.addEventListener('change', loadAccessPoints);
    if (statusFilter) statusFilter.addEventListener('change', loadAccessPoints);

    // Initial load
    loadAccessPoints();
});
