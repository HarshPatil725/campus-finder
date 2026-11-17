# Campus Wi-Fi Monitoring and Incident Management System

A web-based network telemetry monitoring, incident investigation, and lifecycle management system designed for campus infrastructure administrators.

> **ACADEMIC & DEMONSTRATION NOTICE**: This system processes synthetic historical monitoring telemetry representing November 1–14, 2026 across six campus zones. It is designed as an architectural prototype and educational full-stack demonstration. It does not interface directly with proprietary physical router firmware or live SNMP polling daemons.

---

## 1. Project Introduction

Modern university campuses rely on extensive wireless network infrastructure spanning academic blocks, residence halls, computer laboratories, administrative wings, and event spaces. When network degradation or hardware outages occur, network operations teams need immediate visibility into access point health, historical latency and packet loss trends, and structured workflows to register, investigate, and resolve service incidents.

The **Campus Wi-Fi Monitoring and Incident Management System** provides an editorial, dashboard-driven web application enabling operators to:
- Monitor access point availability across 6 campus facilities.
- Analyze 14-day historical performance telemetry (4,032 baseline readings).
- Classify health states dynamically (*Healthy*, *Degraded*, *Down*).
- Track incident lifecycles through *Open*, *Investigating*, and *Resolved* states.
- Correlate metric evidence surrounding incident time windows.
- Perform administrative hardware registration and telemetry simulations.

---

## 2. Problem Statement

Campus network management often suffers from fragmented visibility:
1. **Scattered Metrics**: Telemetry from diverse campus buildings is frequently siloed in raw system logs without intuitive correlation to physical facilities.
2. **Delayed Root-Cause Analysis**: Operators struggle to correlate user incident reports with historical packet loss or latency trends at the exact time of the anomaly.
3. **Inconsistent Incident Tracking**: Remediation steps, technician resolution notes, and outage durations are often logged in disparate ticketing channels without direct links to device telemetry.

---

## 3. Project Objectives

- **Centralized Telemetry Dashboard**: Provide a high-level overview of total, healthy, degraded, and down access points.
- **Relational Integrity**: Enforce strict relational schema constraints, foreign key references, and identity sequences using PostgreSQL.
- **Root-Cause Investigation**: Automatically retrieve and graph network readings within a $\pm 2\text{ hour}$ window of an incident's start time.
- **Security Hardening**: Defend against SQL injection via parameterized queries, add secure HTTP headers (CSP, nosniff, frameguard), enforce request size limits, and provide cryptographic administrator sessions.
- **Containerized Portability**: Package the entire application and database stack with Docker and Docker Compose for zero-configuration deployment.

---

## 4. Technologies Used

### Frontend
- **HTML5 & CSS3**: Custom editorial design system with warm ivory tones and responsive grid layouts.
- **Vanilla JavaScript (ES6+)**: Modular client-side controllers and unified API communication via `fetch()`. No heavy frameworks (No React, Next.js, or TypeScript).
- **Bootstrap 5.3.3 & Bootstrap Icons 1.11.3**: Responsive UI components, modal dialogues, navigation drawers, and iconography.
- **Chart.js 4.4.1**: Interactive line charts, doughnut distribution graphs, and performance visualizations.

### Backend
- **Node.js 20 LTS**: Fast asynchronous JavaScript runtime.
- **Express.js 4.21.2**: Modular REST API routing, static asset serving on the same origin, and centralized error handling.
- **Node `pg` 8.13.1**: Connection pooling, parameterized queries, and ACID transaction control.
- **Node Native `crypto`**: PBKDF2/scrypt password hashing with cryptographic salt and timing-safe comparison (`crypto.timingSafeEqual`).

### Database
- **PostgreSQL 16**: Relational database engine with primary keys, foreign keys, check constraints, composite indexes, and analytical SQL views.

### DevOps & Deployment
- **Docker & Docker Compose**: Multi-container orchestration, persistent named volumes, and health-checked service dependencies.
- **Render.com / Cloud Containers**: Cloud deployment readiness with SSL termination and managed PostgreSQL.

---

## 5. System Architecture

The application adopts a monolithic architecture hosted on a single origin, avoiding cross-origin complexities and microservice overhead:

```
+-------------------------------------------------------------------------+
|                              WEB BROWSER                                |
|  Vanilla JS UI Controllers  <--->  Chart.js  <--->  Bootstrap 5 Views   |
+------------------------------------+------------------------------------+
                                     |
                               HTTP / REST (JSON)
                                     |
+------------------------------------v------------------------------------+
|                         NODE.JS / EXPRESS SERVER                        |
|  - Security Headers (CSP, Frameguard, nosniff)                          |
|  - Static Asset Delivery (/public)                                      |
|  - Session Context & Administrator Authentication Layer                 |
|  - Modular API Routers (/api/overview, /api/readings, /api/incidents)   |
|  - Centralized Error Boundary                                           |
+------------------------------------+------------------------------------+
                                     |
                          pg Pool (Parameterized SQL)
                                     |
+------------------------------------v------------------------------------+
|                       POSTGRESQL 16 DATABASE                            |
|  - access_points (Hardware Registry)                                    |
|  - network_readings (Time-series Telemetry)                             |
|  - incidents (Incident Management & Resolutions)                        |
|  - Analytical Views:                                                    |
|      * v_network_readings_with_health                                   |
|      * v_latest_access_point_status                                     |
|  - Persistent Storage: Named Volume (campus-wifi-tracker_pgdata)        |
+-------------------------------------------------------------------------+
```

---

## 6. Database Structure & Relational Schema

### Tables & Key Constraints

```sql
-- 1. Hardware Access Points
CREATE TABLE access_points (
    access_point_id TEXT PRIMARY KEY,
    building        TEXT NOT NULL,
    location        TEXT NOT NULL
);

-- 2. Time-Series Network Telemetry
CREATE TABLE network_readings (
    reading_id      INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    access_point_id TEXT NOT NULL REFERENCES access_points(access_point_id) ON DELETE CASCADE,
    timestamp       TIMESTAMP NOT NULL,
    latency_ms      NUMERIC NULL,
    packet_loss_pct NUMERIC NOT NULL,
    is_up           BOOLEAN NOT NULL,
    CONSTRAINT chk_latency_non_negative CHECK (latency_ms IS NULL OR latency_ms >= 0),
    CONSTRAINT chk_packet_loss_range CHECK (packet_loss_pct >= 0 AND packet_loss_pct <= 100)
);

-- 3. Incident Lifecycle
CREATE TABLE incidents (
    incident_id     TEXT PRIMARY KEY,
    access_point_id TEXT NOT NULL REFERENCES access_points(access_point_id) ON DELETE CASCADE,
    start_time      TIMESTAMP NOT NULL,
    end_time        TIMESTAMP NULL,
    status          TEXT NOT NULL DEFAULT 'Open',
    suspected_cause TEXT NOT NULL,
    resolution      TEXT NULL,
    CONSTRAINT chk_incident_status CHECK (status IN ('Open', 'Investigating', 'Resolved')),
    CONSTRAINT chk_incident_time_chronology CHECK (end_time IS NULL OR end_time >= start_time),
    CONSTRAINT chk_resolved_requires_resolution_and_end_time CHECK (
        (status = 'Resolved' AND end_time IS NOT NULL AND resolution IS NOT NULL AND LENGTH(TRIM(resolution)) > 0)
        OR (status != 'Resolved')
    )
);
```

### Health Classification Business Logic
Stored in analytical view `v_network_readings_with_health`:
- **Healthy**: `is_up = true AND latency_ms < 250 AND packet_loss_pct < 20`
- **Degraded**: `is_up = true AND (latency_ms >= 250 OR packet_loss_pct >= 20)`
- **Down**: `is_up = false` (enforces `latency_ms = null`)

---

## 7. Seven Application Views

The application provides seven distinct HTML interfaces sharing an editorial aesthetic:

1. **Overview (`/index.html`)**:
   Executive KPI metrics (Total APs, Healthy, Degraded, Down, Active Incidents), campus building filters, and active incident summary cards.
2. **Access Point Directory (`/access-points.html`)**:
   Hardware inventory table, building and status filters, search by AP ID or room, and offcanvas device detail drawers.
3. **Performance Telemetry (`/performance.html`)**:
   Interactive Chart.js line charts illustrating latency and packet loss trends over time with AP-specific selectors and date range filters.
4. **Incident Management (`/incidents.html`)**:
   Comprehensive incident master table with status badges (`Open`, `Investigating`, `Resolved`), building filters, and modal registration form.
5. **Incident Investigation (`/investigation.html`)**:
   Deep-dive root-cause workbench. Displays affected device location, chronological telemetry readings within $\pm 2\text{ hours}$ of outage onset, and atomic state transition controls.
6. **Network Analytics (`/analytics.html`)**:
   Aggregated visual intelligence including global health distribution doughnut charts, building-level performance averages, and incident frequency heat tables.
7. **System Administration (`/admin.html`)**:
   Data entry portal allowing operators to simulate fresh telemetry readings, register new AP hardware, and review live PostgreSQL row counts.

---

## 8. REST API Endpoints

| Category | Method & Endpoint | Description |
| :--- | :--- | :--- |
| **System** | `GET /api/health` | Verifies Express server and live PostgreSQL pool connectivity. |
| **Auth** | `POST /api/auth/login` | Validates admin credentials via timing-safe scrypt and establishes session. |
| **Auth** | `POST /api/auth/logout` | Invalidates active server-side session and clears cookie. |
| **Auth** | `GET /api/auth/session` | Reports current session status. |
| **Overview** | `GET /api/overview` | Returns system KPIs, health counts, and latest readings (supports `?building=`). |
| **Access Points**| `GET /api/access-points` | Lists all access points with current status (supports `?building=`, `?search=`). |
| **Access Points**| `GET /api/access-points/:id` | Returns single AP details, recent incidents, and readings. |
| **Access Points**| `PATCH /api/access-points/:id`| Updates access point building or location metadata. |
| **Readings** | `GET /api/readings` | Paginated time-series telemetry (supports `?access_point_id=`, `?page=`, `?limit=`). |
| **Readings** | `POST /api/readings` | Inserts new telemetry reading with validation and automatic health classification. |
| **Incidents** | `GET /api/incidents` | Lists recorded incidents (supports `?status=`, `?building=`, `?search=`). |
| **Incidents** | `GET /api/incidents/:id` | Returns incident details and correlated telemetry evidence ($\pm 2\text{h}$ window). |
| **Incidents** | `POST /api/incidents` | Registers a new incident with auto-generated sequential ID (`INC-021`, etc.). |
| **Incidents** | `PATCH /api/incidents/:id`| Updates incident status (`Open` &rarr; `Investigating` &rarr; `Resolved`) and resolution. |
| **Analytics** | `GET /api/analytics/summary`| Aggregated metrics, health distributions, and building averages for charts. |

---

## 9. CSV Dataset Explanation

The initial dataset is located in `database/csv/` and was synthesized to model a 14-day operational monitoring window (November 1–14, 2026):
- **`access_points.csv`**: 12 access points distributed across 6 campus facilities (Library, Computer Lab, Academic Block, Administration, Hostel, Seminar Hall).
- **`network_readings.csv`**: 4,032 hourly network telemetry samples (336 samples per access point across 14 days) capturing realistic diurnal load fluctuations, peak study hour latency spikes, and intermittent outages.
- **`incidents.csv`**: 20 historical operational incidents (18 resolved, 2 ongoing: `INC-019` investigating and `INC-020` open).

---

## 10. Local Setup Instructions

### Prerequisites
- Node.js (v18.0.0 or higher)
- PostgreSQL 14+ running locally on port `5432`

### Step-by-Step Setup
1. **Clone Repository**:
   ```bash
   git clone https://github.com/HarshPatil725/campus-finder.git
   cd campus-finder
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and configure your local PostgreSQL credentials:
   ```bash
   cp .env.example .env
   ```
4. **Initialize Database Schema & Seed Data**:
   ```bash
   npm run db:init
   npm run db:seed
   npm run db:validate
   ```
5. **Start Development Server**:
   ```bash
   npm run dev
   # Server runs on http://localhost:3000
   ```

---

## 11. Docker Instructions

The entire system is containerized with Docker Compose using a non-root `node:20-alpine` image and a persistent named PostgreSQL volume.

### Start the Stack
```bash
docker compose up -d --build
```
This command automatically:
1. Builds the Node.js application image using `Dockerfile`.
2. Starts PostgreSQL 16 Alpine with native health checks.
3. Attaches to persistent volume `campus-wifi-tracker_pgdata`.
4. Waits for PostgreSQL to become healthy before launching Express.
5. Exposes the website on `http://localhost:3000`.

### Operational Commands
- **View Container Status**: `docker compose ps`
- **Stream Logs**: `docker compose logs -f`
- **Stop Containers (Data Preserved)**: `docker compose down`
- **Restart Application**: `docker compose restart app`
- **Interactive Database Shell**: `docker exec -it campus_wifi_db psql -U postgres -d campus_wifi_db`

See [DOCKER_GUIDE.md](DOCKER_GUIDE.md) for full commands.

---

## 12. Cloud Deployment Guide

The containerized application is cloud-agnostic and ready for deployment on any Docker-compatible PaaS or CaaS provider.

### Recommended Platform: Render.com (Blueprint IaC)
A turnkey `render.yaml` specification is included in the project root:
1. Connect your GitHub repository (`campus-finder`) to Render.
2. Select **New > Blueprint**.
3. Render reads `render.yaml` and provisions:
   - A Docker Web Service running the Express application with automatic SSL (`https://...`).
   - A fully managed PostgreSQL database instance connected via internal private networking.
4. Database data persists on managed cloud SSDs with automated daily backups.

### Production Environment Variables
Refer to `.env.production.example` for required configuration:
- `NODE_ENV=production`
- `REQUIRE_AUTH=true`
- `DATABASE_URL=postgresql://user:pass@host:5432/campus_wifi_db?sslmode=require`
- `ADMIN_USERNAME=...`
- `ADMIN_PASSWORD=...`

---

## 13. Testing Results

The test harness uses Node.js's native test runner (`node --test 'tests/*.test.js'`):
- **Total Test Suites**: 7
- **Total Executed Tests**: **99**
- **Passing**: **99**
- **Failing**: **0**

### Test Suites Covered
1. `tests/db.test.js`: Schema structure, foreign key enforcement, view calculations.
2. `tests/server.test.js`: Express initialization, health endpoints, graceful failure handling.
3. `tests/api.test.js`: All read-only REST endpoints and building filters.
4. `tests/frontend.test.js`: Seven HTML views and static asset availability.
5. `tests/integration.test.js`: Frontend script bindings and live database API queries.
6. `tests/write_ops.test.js`: Write validation, status lifecycle, sequence assignment.
7. `tests/system_and_security.test.js`: SQL injection neutralization, request size limits, secure HTTP headers, admin authentication, and full end-to-end workflows.

Full test cases and assertions are documented in [TEST_RESULTS.md](TEST_RESULTS.md).

---

## 14. Known Limitations

- **Simulated Polling**: Metrics are derived from the 14-day synthetic dataset rather than live hardware telemetry protocols (SNMP / NetFlow / gNMI).
- **In-Memory Session Store**: Administrator sessions are stored in a server-side memory map with TTL expiration. For multi-instance clustered deployments, an external session cache (e.g. Redis) is recommended.
- **Client Polling**: Frontend updates require manual user refresh or form submission rather than WebSockets or Server-Sent Events (SSE).

---

## 15. Future Improvements

- **Live SNMP / Syslog Ingestion**: Integration with campus Cisco/Aruba WLCs to ingest live telemetry.
- **Automated Anomaly Detection**: Statistical anomaly detection algorithms to flag latency spikes automatically before user reports.
- **Role-Based Access Control (RBAC)**: Distinct permissions for Read-Only Technicians, Incident Handlers, and System Administrators.
- **Automated Webhook Alerts**: Dispatching real-time notifications to Slack, Microsoft Teams, or PagerDuty when critical APs transition to *Down*.
