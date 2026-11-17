# Final Project Report & Academic Demonstration Guide

**Project Title**: Campus Wi-Fi Monitoring and Incident Management System  
**Repository**: `https://github.com/HarshPatil725/campus-finder`  
**Author**: Harsh Patil  
**Engineering Stack**: HTML5, CSS3, Vanilla JavaScript, Bootstrap 5, Chart.js, Node.js, Express.js, PostgreSQL 16, Docker  
**Status**: Production-Ready / Final Verification Complete  

---

## 1. Executive Summary

The **Campus Wi-Fi Monitoring and Incident Management System** is a full-stack web application designed for campus network engineers, university IT operators, and facility administrators. The system centralizes network availability monitoring across six campus facilities, analyzes historical time-series performance telemetry, and streamlines the lifecycle of network incidents from initial detection to root-cause investigation and formal resolution.

The application adheres to a unique **editorial visual design identity** (warm ivory tones, deep black typography, vibrant orange accents, sharp rectangular geometry, and architectural grid structures) while strictly avoiding modern client-side framework bloat. It runs entirely on vanilla web standards, Express.js, and PostgreSQL.

---

## 2. Problem Statement & Key Challenges

### Problem Statement
University campus networks host thousands of concurrent client connections across lecture halls, laboratories, dormitories, and libraries. In academic settings, network operators face three primary operational hurdles:
1. **Lack of Unified Facility Telemetry**: Diagnostic data is fragmented across network controller command lines, making it difficult to assess building-by-building performance at a glance.
2. **Delayed Evidence Correlation**: When an incident is reported, correlating user complaints with historical latency and packet loss metrics requires tedious manual log cross-referencing.
3. **Disjointed Incident Lifecycles**: Incident investigations, suspected causes, and remediation notes are often poorly documented or separated from the underlying telemetry history.

### Solution Delivered
This project resolves these challenges through:
- A responsive, 7-page editorial web portal.
- Dynamic health classification logic ($Healthy$, $Degraded$, $Down$).
- An interactive investigation workbench correlating telemetry within a $\pm 2\text{ hour}$ window of any incident.
- Full write capabilities for logging telemetry readings, registering incidents, and tracking resolutions.
- Robust containerization using multi-stage Docker builds and Docker Compose with persistent data volumes.

---

## 3. System Architecture & Engineering Specifications

```
               [ CLIENT / BROWSER ]
       HTML5 • CSS3 • Vanilla JS • Bootstrap 5 • Chart.js
                        |
                        | HTTP / REST (JSON)
                        v
          [ EXPRESS.JS BACKEND (Node.js 20 LTS) ]
  ├── Security Layer (CSP, Frameguard, nosniff, Payload Limits)
  ├── Static Frontend Asset Delivery (/public)
  ├── Session & Administrator Authentication Service
  ├── Centralized Error Boundary & Parameterized Query Handlers
  └── Routes:
      ├── /api/overview
      ├── /api/access-points
      ├── /api/readings
      ├── /api/incidents
      ├── /api/analytics
      └── /api/auth
                        |
                        | Connection Pool (pg Pool)
                        v
          [ POSTGRESQL 16 RELATIONAL DATABASE ]
  ├── access_points (Hardware inventory: 12 APs across 6 buildings)
  ├── network_readings (Time-series telemetry: 4,033 records)
  ├── incidents (Operational incident logs: 21 records)
  ├── Analytical Views:
  │   ├── v_network_readings_with_health
  │   └── v_latest_access_point_status
  └── Persistent Docker Named Volume: campus-wifi-tracker_pgdata
```

---

## 4. Visual Design Identity

The user interface follows an editorial, print-inspired design language specified in the design reference:

| Visual Element | Specification | Rationale |
| :--- | :--- | :--- |
| **Warm Canvas** | `#F2EDDF` (`--bg`) | High-legibility editorial paper feel, reduces screen fatigue. |
| **Surface Card** | `#F8F5EB` (`--surface`) | Subtle elevation contrast without heavy shadows. |
| **Deep Ink** | `#111111` (`--ink`) | Razor-sharp editorial contrast for typography. |
| **Accent Orange** | `#FF3D0A` (`--accent`) | High-visibility action cues, active tabs, and primary CTAs. |
| **Sharp Geometry** | `border-radius: 0px` | Strict rectangular borders reflecting architectural precision. |
| **Grid Lines** | Thin `1px` subtle vertical rules | Emphasizes structured data organization. |
| **Typography** | Serif Headings + Monospace Navigation | Editorial authority paired with technical clarity. |

---

## 5. Overview of the Seven Application Views

1. **Page 01: Overview (`/index.html`)**
   - Executive KPIs: Total APs (12), Healthy (10), Degraded (1), Down (1), Total Incidents (21).
   - Global campus building filter dynamically recalculating metrics.
   - Latest reading status table for each physical access point.
   - Recent operational incidents roster.

2. **Page 02: Access Point Directory (`/access-points.html`)**
   - Complete hardware directory covering 6 campus buildings.
   - Instant search filter by Access Point ID or room description.
   - Filter pills by health status (*Healthy*, *Degraded*, *Down*).
   - Offcanvas device inspection drawer showing recent readings and device incidents.

3. **Page 03: Performance Telemetry (`/performance.html`)**
   - Interactive Chart.js time-series charts for Latency (ms) and Packet Loss (%).
   - Dropdown selectors to isolate individual access points.
   - Date range filtering controls.
   - Tabular historical reading inspection.

4. **Page 04: Incident Management (`/incidents.html`)**
   - Master incident roster with status tags (*Open*, *Investigating*, *Resolved*).
   - Building and status filter buttons.
   - Register New Incident modal with client and server-side validation.
   - Direct deep-links to the investigation workbench.

5. **Page 05: Incident Investigation (`/investigation.html`)**
   - Root-cause analysis workbench.
   - Incident summary card with affected device details.
   - Correlated telemetry evidence panel querying readings in the $\pm 2\text{ hour}$ window.
   - Status transition form allowing operators to update suspected causes and submit resolutions.

6. **Page 06: Network Analytics (`/analytics.html`)**
   - Doughnut visualization of overall health distribution across all readings.
   - Building-by-building performance breakdown table (average latency, packet loss, outage count).
   - Incident severity analysis.

7. **Page 07: System Administration (`/admin.html`)**
   - Form 1: Add Simulated Telemetry Reading with availability toggle and latency rules.
   - Form 2: Register / Update Access Point Hardware in PostgreSQL.
   - Live system audit counters displaying verified database row counts.

---

## 6. Step-by-Step Final Demonstration Script

Follow this 10-step sequence during project evaluation or viva demonstration:

| Step | Action | Page / Interface | Expected Demonstration Output |
| :---: | :--- | :--- | :--- |
| **1** | **Open Network Overview** | Navigate to `/index.html` | Dashboard loads with 12 APs, health summary cards, and active incidents. |
| **2** | **Select an Access Point** | Go to `/access-points.html` & click **AP-02** | Offcanvas drawer opens showing AP-02 location (Library First Floor) and latest metrics. |
| **3** | **Show Historical Readings** | Navigate to `/performance.html` & select **AP-02** | Chart.js renders chronological latency and packet loss trends over the 14-day baseline. |
| **4** | **Enter Simulated Network Problem** | Open `/admin.html` and submit form: AP `AP-02`, Latency `295.4ms`, Packet Loss `28.5%` | Feedback alert confirms reading inserted into PostgreSQL; status evaluates to **Degraded**. |
| **5** | **Register a New Incident** | Open `/incidents.html`, click **+ REGISTER INCIDENT**, select `AP-02`, cause `"Optic transceiver degradation"` | Incident `INC-022` created with status **Open**; roster auto-refreshes. |
| **6** | **Investigate Metric Evidence** | Navigate to `/investigation.html?id=INC-022` | Workbench shows incident details and tabular telemetry evidence around the outage window. |
| **7** | **Record Suspected Cause** | In the Update card, set status to **Investigating** & update cause to `"Transceiver optical attenuation on port Gi1/0/2"` | Success alert confirms update; status pill updates to yellow *Investigating*. |
| **8** | **Resolve the Incident** | Set status to **Resolved**, provide end time and notes: `"Replaced SFP+ optical module; signal restored to -3.2 dBm"` | Incident transitions to green *Resolved*; resolution notes are saved to PostgreSQL. |
| **9** | **Restart the Application** | Execute `docker compose restart app` in terminal | Express server restarts cleanly; database container remains healthy and unmolested. |
| **10**| **Verify Database Persistence** | Refresh `/investigation.html?id=INC-022` in browser | All recorded data, status (*Resolved*), and resolution notes remain 100% intact. |

---

## 7. PPT Slide Outline & Screenshot Capture Guide

Prepare your presentation slides using the following structure. Each slide specifies the exact screenshot to capture:

### Slide 1: Title & Academic Introduction
- **Title**: Campus Wi-Fi Monitoring and Incident Management System
- **Subtitle**: Full-Stack Network Telemetry and Incident Lifecycle Web Platform
- **Presenter**: Harsh Patil
- **Key Details**: Semester Project, Tech Stack Overview (Vanilla JS, Express, PostgreSQL, Docker).

### Slide 2: Problem Statement & Motivation
- **Content**: Challenges of fragmented campus telemetry, unlinked trouble tickets, and delayed MTTR (Mean Time to Resolution).
- **Screenshot**: `design-reference/website-reference.png` showing the design inspiration.

### Slide 3: System Architecture & Technical Stack
- **Content**: Monolithic single-origin architecture, PostgreSQL schema with ACID transactions, Docker Compose orchestration.
- **Graphic**: Architecture diagram from Section 3 of this report.

### Slide 4: Page 01 — Network Overview Dashboard
- **Content**: High-level KPIs, health status distribution, campus building filters.
- **Screenshot 1**: Capture `http://localhost:3000/index.html` showing the top navigation, simulated data indicator, KPI cards, and latest device table.
- **Talking Points**: Highlight the warm ivory palette, monospaced navigation, and real-time aggregate SQL calculations.

### Slide 5: Page 02 — Access Point Hardware Directory
- **Content**: Device inventory across 6 campus facilities, live search, and offcanvas device drawers.
- **Screenshot 2**: Capture `http://localhost:3000/access-points.html` with an offcanvas detail drawer open for `AP-01` or `AP-03`.
- **Talking Points**: Search-as-you-type and filter pills showing device health states.

### Slide 6: Page 03 — Historical Performance Telemetry
- **Content**: Interactive Chart.js visualizations tracking latency and packet loss trends.
- **Screenshot 3**: Capture `http://localhost:3000/performance.html` displaying the dual line charts for an active access point.
- **Talking Points**: 4,032 hourly samples capturing peak academic hours and diurnal usage cycles.

### Slide 7: Page 04 — Incident Management & Registration
- **Content**: Centralized incident tracking, status badges, and registration modal.
- **Screenshot 4**: Capture `http://localhost:3000/incidents.html` with the **Register Incident Modal** open.
- **Talking Points**: Strict validation, automated sequential incident ID generation (`INC-021`).

### Slide 8: Page 05 — Incident Investigation Workbench
- **Content**: Root-cause analysis, chronological evidence correlation, and resolution controls.
- **Screenshot 5**: Capture `http://localhost:3000/investigation.html?id=INC-021` showing correlated readings in the $\pm 2\text{ hour}$ window and resolution form.
- **Talking Points**: Direct linkage between trouble tickets and empirical network readings.

### Slide 9: Page 06 & 07 — Analytics & System Administration
- **Content**: Global health doughnut charts, building aggregation matrix, and telemetry entry forms.
- **Screenshot 6**: Capture `http://localhost:3000/analytics.html` (charts) or `http://localhost:3000/admin.html` (data entry form).
- **Talking Points**: Analytical views in SQL (`v_network_readings_with_health`) computing distribution metrics on demand.

### Slide 10: Security Hardening & SQL Injection Defense
- **Content**: HTTP response headers (CSP, nosniff, frameguard), payload limits (100kb), scrypt password hashing, and parameterized query immunity.
- **Graphic/Table**: Table summarizing the security test suite and attack payload neutralization.

### Slide 11: Docker Containerization & Deployment
- **Content**: Multi-stage `Dockerfile`, Docker Compose orchestration, persistent named volume, and Render.com Blueprint.
- **Screenshot 7**: Terminal screenshot of `docker compose ps` showing healthy containers and volume retention.

### Slide 12: Conclusion & Future Scope
- **Content**: Summary of achievements, 99/99 passing tests, academic synthetic data statement, future live SNMP/WLC integration.

---

## 8. Academic Compliance & Ethical Data Declaration

1. **Synthetic Data Disclosure**: All historical readings (November 1–14, 2026) were synthesized using Python scripts to model realistic academic traffic patterns, diurnal load variations, and equipment faults. No proprietary router logs or real student personal data were harvested.
2. **Framework Restrictions Met**: The frontend was constructed strictly using HTML5, CSS3, Vanilla JavaScript, Bootstrap 5, and Chart.js. No prohibited frameworks (React, Next.js, TypeScript, Kubernetes, or microservice meshes) were utilized.
3. **Database Relational Integrity**: All entity references are guaranteed by PostgreSQL foreign keys with zero orphan records.
