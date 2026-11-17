# System Testing and Security Verification Report

**Project**: Campus Wi-Fi Monitoring and Incident Management System  
**Test Harness**: Node.js Native Test Runner (`node --test 'tests/*.test.js'`)  
**Database**: PostgreSQL 16 (`campus_wifi_db`)  
**Backend**: Express.js REST API on Node.js  
**Total Tests Executed**: 99  
**Passing Assertions**: 99  
**Failing Assertions**: 0  
**Test Suites**: 7 suites  
**Execution Timestamp**: 2026-11-18  

---

## 1. Database Constraint & Integrity Test Results

| Test Case | Input | Expected Output | Actual Output | Pass/Fail Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-DB-01: Primary Key Uniqueness** | `INSERT INTO access_points (access_point_id, building, location) VALUES ('AP-01', 'Library', 'Duplicate')` | Rejection with `23505 duplicate key value violates unique constraint "access_points_pkey"` | Error thrown matching `/duplicate key value violates unique constraint/i` | **PASS** |
| **TC-DB-02: Foreign Key in Readings** | `INSERT INTO network_readings (access_point_id, timestamp, latency_ms, packet_loss_pct, is_up) VALUES ('AP-NONEXISTENT', ...)` | Rejection with `23503 foreign key constraint violation` referencing `access_points` | Error thrown matching `/violates foreign key constraint/i` | **PASS** |
| **TC-DB-03: Foreign Key in Incidents** | `INSERT INTO incidents (incident_id, access_point_id, start_time, status, suspected_cause) VALUES ('INC-FAKE', 'AP-NONEXISTENT', ...)` | Rejection with `23503 foreign key constraint violation` referencing `access_points` | Error thrown matching `/violates foreign key constraint/i` | **PASS** |
| **TC-DB-04: NOT NULL Building Constraint** | `INSERT INTO access_points (access_point_id, building, location) VALUES ('AP-NULL', NULL, 'Room 101')` | Rejection with `23502 null value in column "building" violates not-null constraint` | Error thrown matching `/null value in column "building".*violates not-null constraint/i` | **PASS** |
| **TC-DB-05: NOT NULL Packet Loss Constraint** | `INSERT INTO network_readings (access_point_id, timestamp, latency_ms, packet_loss_pct, is_up) VALUES ('AP-01', ..., NULL, true)` | Rejection with `23502 null value in column "packet_loss_pct" violates not-null constraint` | Error thrown matching `/null value in column "packet_loss_pct".*violates not-null constraint/i` | **PASS** |
| **TC-DB-06: Latency Non-Negative Check** | `INSERT INTO network_readings (..., latency_ms = -5.0, ...)` | Rejection with check constraint violation `chk_latency_non_negative` | Error thrown matching `/chk_latency_non_negative/i` | **PASS** |
| **TC-DB-07: Packet Loss Range Check** | `INSERT INTO network_readings (..., packet_loss_pct = 105.0, ...)` | Rejection with check constraint violation `chk_packet_loss_range` | Error thrown matching `/chk_packet_loss_range/i` | **PASS** |

---

## 2. Backend API & Resilience Test Results

| Test Case | Input | Expected Output | Actual Output | Pass/Fail Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-API-01: Health Check Endpoint** | `GET /api/health` | HTTP `200 OK`, JSON `{ status: 'ok', database: 'connected' }` | HTTP `200 OK`, `{ status: 'ok', database: 'connected' }` | **PASS** |
| **TC-API-02: Overview Baseline Aggregations** | `GET /api/overview` | HTTP `200 OK`, 12 APs, 21 incidents, 19 resolved, 2 unresolved | HTTP `200 OK`, counts match exact database state | **PASS** |
| **TC-API-03: Overview Building Filter** | `GET /api/overview?building=Library` | HTTP `200 OK`, exactly 2 APs, filtered incidents and readings | HTTP `200 OK`, 2 APs returned for Library | **PASS** |
| **TC-API-04: Access Point Directory** | `GET /api/access-points` | HTTP `200 OK`, array of 12 access points with telemetry | HTTP `200 OK`, 12 records returned | **PASS** |
| **TC-API-05: Single Access Point Detail** | `GET /api/access-points/AP-01` | HTTP `200 OK`, AP record, recent readings, and incident history | HTTP `200 OK`, AP-01 details returned | **PASS** |
| **TC-API-06: Non-Existent Access Point** | `GET /api/access-points/NONEXISTENT-99` | HTTP `404 Not Found`, JSON `{ status: 'error', message: '...' }` | HTTP `404 Not Found`, structured error returned | **PASS** |
| **TC-API-07: Telemetry Readings Pagination** | `GET /api/readings?page=1&limit=50` | HTTP `200 OK`, total >= 4032, page 1 with 50 records | HTTP `200 OK`, total 4033, 50 rows returned | **PASS** |
| **TC-API-08: Readings Building Filter** | `GET /api/readings?building=Library` | HTTP `200 OK`, >= 672 readings for Library APs | HTTP `200 OK`, 672 readings returned | **PASS** |
| **TC-API-09: Incident Roster Retrieval** | `GET /api/incidents` | HTTP `200 OK`, >= 20 incidents sorted chronologically | HTTP `200 OK`, 21 incidents returned | **PASS** |
| **TC-API-10: Incident Status Filter** | `GET /api/incidents?status=unresolved` | HTTP `200 OK`, exactly 2 active incidents (INC-019, INC-020) | HTTP `200 OK`, 2 unresolved incidents returned | **PASS** |
| **TC-API-11: Incident Telemetry Correlation** | `GET /api/incidents/INC-001` | HTTP `200 OK`, incident metadata plus correlated readings within ±2h window | HTTP `200 OK`, incident returned with related readings | **PASS** |
| **TC-API-12: Non-Existent Incident ID** | `GET /api/incidents/INC-NONEXISTENT` | HTTP `404 Not Found`, JSON `{ status: 'error', message: '...' }` | HTTP `404 Not Found`, error returned | **PASS** |
| **TC-API-13: Analytics Aggregated Summary** | `GET /api/analytics/summary` | HTTP `200 OK`, reading health map, device status map, building breakdown | HTTP `200 OK`, aggregated analytics payload returned | **PASS** |
| **TC-API-14: Malformed JSON Syntax** | `POST /api/readings` with broken JSON body `{"access_point_id": "AP-01", ...` | HTTP `400 Bad Request`, JSON `{ status: 'error', message: 'Malformed JSON syntax...' }` | HTTP `400 Bad Request`, malformed syntax message | **PASS** |
| **TC-API-15: Oversized Request Body** | `POST /api/readings` with 120KB payload | HTTP `413 Payload Too Large`, body rejected before processing | HTTP `413 Payload Too Large`, payload limit enforced | **PASS** |

---

## 3. Security Hardening & SQL Injection Test Results

| Test Case | Input | Expected Output | Actual Output | Pass/Fail Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-SEC-01: X-Content-Type-Options** | `GET /api/health` response headers | Header `X-Content-Type-Options: nosniff` | `nosniff` present | **PASS** |
| **TC-SEC-02: X-Frame-Options** | `GET /api/health` response headers | Header `X-Frame-Options: DENY` | `DENY` present | **PASS** |
| **TC-SEC-03: X-XSS-Protection** | `GET /api/health` response headers | Header `X-XSS-Protection: 1; mode=block` | `1; mode=block` present | **PASS** |
| **TC-SEC-04: Referrer-Policy** | `GET /api/health` response headers | Header `Referrer-Policy: strict-origin-when-cross-origin` | `strict-origin-when-cross-origin` present | **PASS** |
| **TC-SEC-05: Content-Security-Policy** | `GET /api/health` response headers | Header `Content-Security-Policy` restricting script, style, font, connect origins | CSP header present and valid | **PASS** |
| **TC-SEC-06: SQL Injection in Overview** | `GET /api/overview?building=' OR '1'='1` | SQL treated as literal string; 0 matching records; no database syntax error or leak | HTTP `200 OK`, 0 matching records, table intact | **PASS** |
| **TC-SEC-07: SQL Injection DROP TABLE** | `GET /api/access-points?search=AP-01'; DROP TABLE access_points; --` | Parameterized query treats input as search literal; table remains untouched | HTTP `200 OK`, 0 records, table access_points has 12 rows | **PASS** |
| **TC-SEC-08: SQL Injection in Incidents** | `GET /api/incidents?status=1; SELECT * FROM pg_user; --` | Parameterized query handles status safely without query stacking | HTTP `200 OK`, 0 records, database untouched | **PASS** |
| **TC-SEC-09: SQL Injection in Readings** | `GET /api/readings?access_point_id=' UNION SELECT NULL --` | Parameterized query handles AP filter safely without UNION reflection | HTTP `200 OK`, 0 records, query executed safely | **PASS** |
| **TC-SEC-10: Admin Authentication (Invalid)**| `POST /api/auth/login` with wrong password | HTTP `401 Unauthorized`, JSON `{ status: 'error', message: 'Invalid administrative credentials' }` | HTTP `401 Unauthorized`, authentication rejected | **PASS** |
| **TC-SEC-11: Admin Authentication (Valid)**  | `POST /api/auth/login` with valid credentials | HTTP `200 OK`, cryptographic session token, `Set-Cookie: session_id=...; HttpOnly; SameSite=Strict` | HTTP `200 OK`, session created, cookie set | **PASS** |
| **TC-SEC-12: Session Verification**         | `GET /api/auth/session` with `Bearer <token>` | HTTP `200 OK`, JSON `{ authenticated: true, user: { username: 'admin' } }` | HTTP `200 OK`, authenticated: true | **PASS** |
| **TC-SEC-13: Admin Session Logout**         | `POST /api/auth/logout` with active session | HTTP `200 OK`, session destroyed from server-side store, expired cookie sent | HTTP `200 OK`, subsequent session check returns `false` | **PASS** |

---

## 4. Frontend Navigation, UI & Responsiveness Test Results

| Test Case | Input | Expected Output | Actual Output | Pass/Fail Status |
| :--- | :--- | :--- | :--- | :---: |
| **TC-FE-01: Page 01 Navigation & Layout** | `GET /index.html` | Brand `CAMPUS / WI-FI`, 7 nav links, active class on Overview, responsive toggler | Verified present in HTML DOM | **PASS** |
| **TC-FE-02: Page 02 Navigation & Layout** | `GET /access-points.html` | Brand, 7 nav links, active class on Access Points, search bar, building filter | Verified present in HTML DOM | **PASS** |
| **TC-FE-03: Page 03 Navigation & Layout** | `GET /performance.html` | Brand, 7 nav links, active class on Performance, Chart.js canvas elements | Verified present in HTML DOM | **PASS** |
| **TC-FE-04: Page 04 Navigation & Layout** | `GET /incidents.html` | Brand, 7 nav links, active class on Incidents, Register Incident modal | Verified present in HTML DOM | **PASS** |
| **TC-FE-05: Page 05 Navigation & Layout** | `GET /investigation.html` | Brand, 7 nav links, active class on Investigation, incident update form | Verified present in HTML DOM | **PASS** |
| **TC-FE-06: Page 06 Navigation & Layout** | `GET /analytics.html` | Brand, 7 nav links, active class on Analytics, Chart.js canvases | Verified present in HTML DOM | **PASS** |
| **TC-FE-07: Page 07 Navigation & Layout** | `GET /admin.html` | Brand, 7 nav links, active class on Admin, `#addReadingForm`, `#manageApForm` | Verified present in HTML DOM | **PASS** |
| **TC-FE-08: Data Indicator Across Pages** | `GET /*.html` | Badge text: `SIMULATED NETWORK DATA — NOV 1–14, 2026` across all pages | Indicator badge confirmed on all 7 views | **PASS** |
| **TC-FE-09: Responsive Viewport Grid** | `GET /*.html` | Bootstrap 5 grid layout (`container-fluid`, `col-md-`, `col-lg-`, navbar collapse) | Confirmed on all 7 views | **PASS** |

---

## 5. End-to-End (E2E) Workflow Test Results

| Step | Workflow Stage | Input | Expected Output | Actual Output | Pass/Fail Status |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | **Add Degraded Reading** | `POST /api/readings` (`AP-04`, latency 125.4ms, loss 7.8%, online) | HTTP `201 Created`, new `reading_id` returned | HTTP `201 Created`, reading created | **PASS** |
| **2** | **Register Incident** | `POST /api/incidents` (`AP-04`, status `'Open'`, cause `'Buffer queue overflow'`) | HTTP `201 Created`, sequential incident ID assigned | HTTP `201 Created`, incident assigned | **PASS** |
| **3** | **Open Investigation** | `GET /api/incidents/:id` | HTTP `200 OK`, incident details and correlated telemetry readings array | HTTP `200 OK`, telemetry correlation array populated | **PASS** |
| **4** | **Update Incident** | `PATCH /api/incidents/:id` (`status: 'Investigating'`, cause refined) | HTTP `200 OK`, status updated to `'Investigating'` | HTTP `200 OK`, status transitioned | **PASS** |
| **5** | **Resolve Incident** | `PATCH /api/incidents/:id` (`status: 'Resolved'`, `end_time`, `resolution`) | HTTP `200 OK`, status updated to `'Resolved'`, resolution notes recorded | HTTP `200 OK`, resolution persisted | **PASS** |
| **6** | **Verify Persistence** | `GET /api/incidents/:id` fresh query from database | Data remains `'Resolved'` with resolution notes intact | Status `'Resolved'` and resolution notes verified | **PASS** |
| **7** | **Ephemeral Teardown** | SQL delete executed inside `try ... finally` block | Clean removal of temporary E2E test rows | Database row count restored to exact 12 / 4,033 / 21 | **PASS** |

---

## 6. Summary Conclusion

1. **Security Hardening**: Secure HTTP headers (`nosniff`, `DENY`, `1; mode=block`, CSP), request payload size limits (`100kb`), timing-safe scrypt password authentication, and cryptographically secure server-side session management verified.
2. **SQL Injection Defense**: 100% of API endpoints use parameterized SQL queries (`$1, $2, ...`) or static SQL views; malicious SQL injection strings are safely neutralized without data compromise or syntax errors.
3. **Database Constraints**: Primary keys, foreign keys, not-null constraints, and numeric check constraints strictly protect relational integrity.
4. **End-to-End Reliability**: Full data lifecycle (create reading &rarr; create incident &rarr; investigate &rarr; transition &rarr; resolve &rarr; persist) verified end-to-end against live PostgreSQL.
