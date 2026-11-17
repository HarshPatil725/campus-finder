# Docker & Docker Compose Operations Guide

**Application**: Campus Wi-Fi Monitoring and Incident Management System  
**Stack**: Node.js 20 LTS Alpine (Express), PostgreSQL 16 Alpine, Docker Compose  
**Compose Specification**: `compose.yaml`  

---

## 1. Quick Start

### Start the Application Stack
Builds images if necessary and starts all containers in detached mode:
```bash
docker compose up -d --build
```

### Check Service Status & Health
View the live state, health status, and port bindings of all containers:
```bash
docker compose ps
```

### Tail Container Logs
View real-time aggregated logs from both `app` and `db` services:
```bash
docker compose logs -f
```
Or for a specific service:
```bash
docker compose logs -f app
docker compose logs -f db
```

---

## 2. Stopping & Restarting

### Stop Containers (Preserving Data Volume)
Stops and removes containers and internal bridge network, while **retaining all PostgreSQL database records** in the named volume `campus-wifi-tracker_pgdata`:
```bash
docker compose down
```

### Restart a Specific Service
To restart the Node.js application without touching the database:
```bash
docker compose restart app
```

### Recreate Containers without Losing Data
```bash
docker compose down && docker compose up -d
```

---

## 3. Database Administration & Operations

### Access PostgreSQL Interactive Shell (`psql`)
Connect directly to the database inside the container:
```bash
docker exec -it campus_wifi_db psql -U postgres -d campus_wifi_db
```

### Verify Table Record Counts
```bash
docker exec -it campus_wifi_db psql -U postgres -d campus_wifi_db -c "
SELECT 
  (SELECT COUNT(*) FROM access_points) as ap_count,
  (SELECT COUNT(*) FROM network_readings) as reading_count,
  (SELECT COUNT(*) FROM incidents) as incident_count,
  (SELECT COUNT(*) FROM incidents WHERE status = 'Resolved') as resolved_incidents;
"
```

### One-Time Database Seeding (Fresh Installation)
If spinning up a fresh database volume from scratch, run the schema initialization and CSV seed scripts via a one-off container:
```bash
# 1. Apply Schema and Analytical Views
docker compose run --rm app node database/scripts/init_db.js

# 2. Import CSV Datasets (Idempotent seed)
docker compose run --rm app node database/scripts/seed.js

# 3. Validate Integrity
docker compose run --rm app node database/scripts/validate.js
```

### Local Development Database Connection
The PostgreSQL database is bound exclusively to the loopback interface (`127.0.0.1:5432`) to satisfy security isolation while permitting local developer debugging:
- **Host**: `127.0.0.1` (or `localhost`)
- **Port**: `5432`
- **Database**: `campus_wifi_db`
- **Username**: `postgres`
- **Password**: `postgres`

---

## 4. Container Health & Maintenance

### Inspect Health Check Status
```bash
# App container health:
docker inspect campus_wifi_app --format '{{json .State.Health}}' | jq

# DB container health:
docker inspect campus_wifi_db --format '{{json .State.Health}}' | jq
```

### Clean Rebuild of Images
Force a fresh build without using cached layers:
```bash
docker compose build --no-cache
docker compose up -d
```
