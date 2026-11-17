# Campus Wi-Fi Monitoring and Incident Management System

A web application designed for campus network administrators to monitor access point health, analyze historical performance metrics, and track network incident lifecycles across campus buildings.

---

## 1. Overview & Architecture

This application processes historical simulated telemetry across campus access points (monitoring period: November 1–14, 2026) and provides operational workflows for incident logging, root-cause investigation, and performance analytics.

### Tech Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript, Bootstrap 5, Bootstrap Icons, Chart.js
- **Backend**: Node.js, Express.js (Modular REST API & Static Asset Serving)
- **Database**: PostgreSQL (Relational schema with primary/foreign keys)
- **Deployment & Containerization**: Docker, Docker Compose, GitHub

> **Note**: This system processes historical simulated data for academic demonstration and prototype operations. All health assessments reflect the latest recorded metric timestamps.

---

## 2. Visual Design System

The user interface follows an editorial design language inspired by high-contrast typography, warm print tones, and architectural grid structures:

- **Warm Background**: `#F2EDDF` (`--bg`)
- **Surface Elevation**: `#F8F5EB` (`--surface`)
- **Primary Ink**: `#111111` (`--ink`)
- **Accent**: `#FF3D0A` (`--accent`)
- **Structural Border**: `#D9D2C2` (`--border`)
- **Muted Text**: `#77736B` (`--muted`)
- **Network Health Tokens**:
  - Healthy: `#247A52` (`--healthy`)
  - Degraded: `#C58A20` (`--degraded`)
  - Down: `#C83225` (`--down`)

Key stylistic elements: Sharp rectangular edges (`border-radius: 0px`), large serif editorial headings, monospaced navigation labels, and thin grid lines.

---

## 3. Directory Structure

```text
campus-wifi-tracker/
|-- public/               # Static frontend served by Express
|   |-- css/              # Custom design system styles & Bootstrap overrides
|   |-- js/               # Vanilla JS controllers and Chart.js integration
|   |-- assets/           # Icons, images, and brand assets
|   |-- partials/         # Reusable navigation, header, and footer partials
|   |-- pages/            # 7 application HTML views
|-- backend/              # Node.js + Express backend
|   |-- routes/           # REST API routes
|   |-- controllers/      # Route request/response handlers
|   |-- middleware/       # Input validation, logger, error handling
|   |-- services/         # Business logic and SQL data access
|   |-- config/           # Database pool and environment configuration
|-- database/             # PostgreSQL migrations, schema, and CSV datasets
|   |-- csv/              # Original synthetic CSV datasets (12 APs, 4032 readings, 20 incidents)
|   |-- schema/           # DDL SQL table definitions and indexes
|   |-- scripts/          # Database seeding and migration scripts
|-- tests/                # Test suites for APIs and health classification logic
|-- design-reference/     # Visual design mockups and UI guidelines
|-- package.json          # Node.js project manifest & scripts
|-- .env.example          # Environment variable template
|-- .gitignore            # Git exclusion rules
|-- Dockerfile            # Container build specification
|-- compose.yaml          # Multi-container orchestration (App + PostgreSQL)
|-- PHASE_STATUS.md       # Phase-by-phase implementation log
`-- README.md             # Project documentation
```

---

## 4. Network Health Classification Logic

The application classifies access point status strictly according to:

- **HEALTHY**: `is_up = true` AND `latency_ms < 250` AND `packet_loss_pct < 20`
- **DEGRADED**: `is_up = true` AND (`latency_ms >= 250` OR `packet_loss_pct >= 20`)
- **DOWN**: `is_up = false`

*Current status is evaluated strictly using the latest recorded reading timestamp for each access point.*

---

## 5. Getting Started

### Prerequisites
- Node.js (v18+ or v22+)
- PostgreSQL 14+ (or Docker)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/HarshPatil725/campus-finder.git
   cd campus-wifi-tracker
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment:
   ```bash
   cp .env.example .env
   ```
4. Run locally:
   ```bash
   npm run dev
   ```
5. Or run with Docker Compose:
   ```bash
   docker compose up -d
   ```
