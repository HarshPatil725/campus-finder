/**
 * Shared API Client for Campus Wi-Fi Monitoring System
 * Communicates exclusively with Express REST endpoints via fetch()
 */

const API = {
    /**
     * Fetch system-wide or building-filtered overview KPIs and latest readings
     */
    async getOverview(building = '') {
        const query = building ? `?building=${encodeURIComponent(building)}` : '';
        const res = await fetch(`/api/overview${query}`);
        if (!res.ok) throw new Error(`Failed to fetch overview: ${res.statusText}`);
        return await res.json();
    },

    /**
     * Fetch access points with optional filters
     */
    async getAccessPoints(params = {}) {
        const query = new URLSearchParams();
        if (params.building) query.append('building', params.building);
        if (params.search) query.append('search', params.search);
        if (params.status) query.append('status', params.status);
        const res = await fetch(`/api/access-points?${query.toString()}`);
        if (!res.ok) throw new Error(`Failed to fetch access points: ${res.statusText}`);
        return await res.json();
    },

    /**
     * Fetch individual access point details
     */
    async getAccessPointById(id) {
        const res = await fetch(`/api/access-points/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(`Failed to fetch access point ${id}: ${res.statusText}`);
        return await res.json();
    },

    /**
     * Fetch paginated and filtered network readings
     */
    async getReadings(params = {}) {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, val]) => {
            if (val !== undefined && val !== null && val !== '') {
                query.append(key, val);
            }
        });
        const res = await fetch(`/api/readings?${query.toString()}`);
        if (!res.ok) throw new Error(`Failed to fetch readings: ${res.statusText}`);
        return await res.json();
    },

    /**
     * POST /api/readings: Add new simulated network reading
     */
    async createReading(readingData) {
        const res = await fetch('/api/readings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(readingData),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Failed to create reading: ${res.statusText}`);
        return json;
    },

    /**
     * Fetch incidents with optional filters
     */
    async getIncidents(params = {}) {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, val]) => {
            if (val !== undefined && val !== null && val !== '') {
                query.append(key, val);
            }
        });
        const res = await fetch(`/api/incidents?${query.toString()}`);
        if (!res.ok) throw new Error(`Failed to fetch incidents: ${res.statusText}`);
        return await res.json();
    },

    /**
     * Fetch individual incident details with ±2hr correlated telemetry readings evidence
     */
    async getIncidentById(id) {
        const res = await fetch(`/api/incidents/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(`Failed to fetch incident ${id}: ${res.statusText}`);
        return await res.json();
    },

    /**
     * POST /api/incidents: Register new incident
     */
    async createIncident(incidentData) {
        const res = await fetch('/api/incidents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(incidentData),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Failed to register incident: ${res.statusText}`);
        return json;
    },

    /**
     * PATCH /api/incidents/:id: Update status, suspected cause, resolution, end time
     */
    async updateIncident(id, updateData) {
        const res = await fetch(`/api/incidents/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Failed to update incident: ${res.statusText}`);
        return json;
    },

    /**
     * PATCH /api/access-points/:id: Update access point building or location
     */
    async updateAccessPoint(id, updateData) {
        const res = await fetch(`/api/access-points/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || `Failed to update access point: ${res.statusText}`);
        return json;
    },

    /**
     * Fetch macro analytical summaries and building comparisons
     */
    async getAnalyticsSummary() {
        const res = await fetch('/api/analytics/summary');
        if (!res.ok) throw new Error(`Failed to fetch analytics: ${res.statusText}`);
        return await res.json();
    },

    /**
     * Health status check
     */
    async checkHealth() {
        const res = await fetch('/api/health');
        if (!res.ok) throw new Error(`API health check failed: ${res.statusText}`);
        return await res.json();
    }
};

// Formatting utilities for consistent UI display
const UIUtils = {
    formatTimestamp(isoString) {
        if (!isoString) return '--';
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return isoString;
        return d.toISOString().replace('T', ' ').substring(0, 16);
    },

    formatLatency(latency) {
        if (latency === null || latency === undefined || latency === '') return 'OFFLINE (NULL)';
        return `${parseFloat(latency).toFixed(1)} ms`;
    },

    formatPacketLoss(loss) {
        if (loss === null || loss === undefined) return '--';
        return `${parseFloat(loss).toFixed(1)}%`;
    },

    getStatusBadge(status) {
        const s = (status || '').toLowerCase();
        if (s === 'healthy') return `<span class="status-pill status-healthy"><i class="bi bi-check-circle me-1"></i>HEALTHY</span>`;
        if (s === 'degraded') return `<span class="status-pill status-degraded"><i class="bi bi-exclamation-triangle me-1"></i>DEGRADED</span>`;
        if (s === 'down') return `<span class="status-pill status-down"><i class="bi bi-x-circle me-1"></i>DOWN</span>`;
        if (s === 'open') return `<span class="status-pill status-open"><i class="bi bi-exclamation-circle me-1"></i>OPEN</span>`;
        if (s === 'investigating') return `<span class="status-pill status-investigating"><i class="bi bi-search me-1"></i>INVESTIGATING</span>`;
        if (s === 'resolved') return `<span class="status-pill status-resolved"><i class="bi bi-check2-all me-1"></i>RESOLVED</span>`;
        return `<span class="status-pill">${status || 'UNKNOWN'}</span>`;
    }
};

window.API = API;
window.UIUtils = UIUtils;
