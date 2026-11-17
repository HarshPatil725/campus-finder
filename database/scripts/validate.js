const { pool } = require('../../backend/config/db');

async function validateDatabase() {
    const client = await pool.connect();
    try {
        console.log('====================================================');
        console.log('DATABASE VALIDATION & VERIFICATION REPORT');
        console.log('====================================================\n');

        let allPassed = true;

        // 1. Table Row Counts
        const countsRes = await client.query(`
            SELECT
                (SELECT COUNT(*) FROM access_points) AS ap_count,
                (SELECT COUNT(*) FROM network_readings) AS nr_count,
                (SELECT COUNT(*) FROM incidents) AS inc_count
        `);
        const counts = countsRes.rows[0];
        console.log(`[1] Row Counts:`);
        console.log(`    - access_points:    ${counts.ap_count} (Expected: 12)`);
        console.log(`    - network_readings: ${counts.nr_count} (Expected: 4032)`);
        console.log(`    - incidents:        ${counts.inc_count} (Expected: 20)`);
        if (parseInt(counts.ap_count) !== 12 || parseInt(counts.nr_count) !== 4032 || parseInt(counts.inc_count) !== 20) {
            console.error('    FAIL: Row counts mismatch!');
            allPassed = false;
        } else {
            console.log('    PASS: All table row counts match expected values.');
        }

        // 2. Unique Primary Keys
        const uniqueRes = await client.query(`
            SELECT
                (SELECT COUNT(DISTINCT access_point_id) FROM access_points) AS unique_aps,
                (SELECT COUNT(DISTINCT reading_id) FROM network_readings) AS unique_readings,
                (SELECT COUNT(DISTINCT incident_id) FROM incidents) AS unique_incidents
        `);
        const uniques = uniqueRes.rows[0];
        console.log(`\n[2] Unique Identifiers:`);
        console.log(`    - Unique AP IDs:       ${uniques.unique_aps} (Expected: 12)`);
        console.log(`    - Unique Reading IDs:  ${uniques.unique_readings} (Expected: 4032)`);
        console.log(`    - Unique Incident IDs: ${uniques.unique_incidents} (Expected: 20)`);
        if (parseInt(uniques.unique_aps) !== 12 || parseInt(uniques.unique_readings) !== 4032 || parseInt(uniques.unique_incidents) !== 20) {
            console.error('    FAIL: Unique ID counts mismatch!');
            allPassed = false;
        } else {
            console.log('    PASS: Primary keys are strictly unique with zero duplicates.');
        }

        // 3. Foreign Key Integrity
        const orphanRes = await client.query(`
            SELECT
                (SELECT COUNT(*) FROM network_readings r LEFT JOIN access_points ap ON r.access_point_id = ap.access_point_id WHERE ap.access_point_id IS NULL) AS orphan_readings,
                (SELECT COUNT(*) FROM incidents i LEFT JOIN access_points ap ON i.access_point_id = ap.access_point_id WHERE ap.access_point_id IS NULL) AS orphan_incidents
        `);
        const orphans = orphanRes.rows[0];
        console.log(`\n[3] Foreign Key Integrity:`);
        console.log(`    - Orphan Readings:  ${orphans.orphan_readings} (Expected: 0)`);
        console.log(`    - Orphan Incidents: ${orphans.orphan_incidents} (Expected: 0)`);
        if (parseInt(orphans.orphan_readings) !== 0 || parseInt(orphans.orphan_incidents) !== 0) {
            console.error('    FAIL: Orphan records found with invalid foreign key references!');
            allPassed = false;
        } else {
            console.log('    PASS: All foreign keys reference valid access points.');
        }

        // 4. Health Classification Distribution (v_network_readings_with_health)
        const healthRes = await client.query(`
            SELECT health_status, COUNT(*)::int AS count
            FROM v_network_readings_with_health
            GROUP BY health_status
            ORDER BY health_status
        `);
        console.log(`\n[4] Network Health Classification Distribution (v_network_readings_with_health):`);
        const healthMap = {};
        healthRes.rows.forEach(r => {
            healthMap[r.health_status] = r.count;
            console.log(`    - ${r.health_status.padEnd(10)}: ${r.count}`);
        });

        const healthyCount = healthMap['Healthy'] || 0;
        const degradedCount = healthMap['Degraded'] || 0;
        const downCount = healthMap['Down'] || 0;

        console.log(`    Checks: Healthy=3966 (Got ${healthyCount}), Degraded=45 (Got ${degradedCount}), Down=21 (Got ${downCount})`);
        if (healthyCount !== 3966 || degradedCount !== 45 || downCount !== 21) {
            console.error('    FAIL: Health classification distribution mismatch!');
            allPassed = false;
        } else {
            console.log('    PASS: Exact health status counts match expected requirements (3966 Healthy, 45 Degraded, 21 Down).');
        }

        // 5. Incident Status Breakdown
        const incidentRes = await client.query(`
            SELECT
                COUNT(*) FILTER (WHERE status = 'Resolved')::int AS resolved_count,
                COUNT(*) FILTER (WHERE status != 'Resolved')::int AS unresolved_count
            FROM incidents
        `);
        const incStats = incidentRes.rows[0];
        console.log(`\n[5] Incident Status Breakdown:`);
        console.log(`    - Resolved Incidents:   ${incStats.resolved_count} (Expected: 18)`);
        console.log(`    - Unresolved Incidents: ${incStats.unresolved_count} (Expected: 2)`);
        if (parseInt(incStats.resolved_count) !== 18 || parseInt(incStats.unresolved_count) !== 2) {
            console.error('    FAIL: Incident status breakdown mismatch!');
            allPassed = false;
        } else {
            console.log('    PASS: Exactly 18 resolved and 2 unresolved incidents.');
        }

        // 6. View: v_latest_access_point_status
        const latestViewRes = await client.query(`
            SELECT COUNT(*)::int AS total_aps,
                   COUNT(current_status)::int AS populated_statuses
            FROM v_latest_access_point_status
        `);
        const viewStats = latestViewRes.rows[0];
        console.log(`\n[6] View v_latest_access_point_status Verification:`);
        console.log(`    - Total Access Points in view: ${viewStats.total_aps} (Expected: 12)`);
        console.log(`    - APs with recorded status:    ${viewStats.populated_statuses} (Expected: 12)`);
        if (viewStats.total_aps !== 12 || viewStats.populated_statuses !== 12) {
            console.error('    FAIL: v_latest_access_point_status count mismatch!');
            allPassed = false;
        } else {
            console.log('    PASS: View returns latest recorded status for all 12 devices.');
        }

        // 7. Identity Sequence Reset Verification
        const seqRes = await client.query(`
            SELECT last_value FROM pg_sequences WHERE sequencename = 'network_readings_reading_id_seq'
        `);
        if (seqRes.rows.length > 0) {
            const lastVal = parseInt(seqRes.rows[0].last_value);
            console.log(`\n[7] Identity Sequence Check:`);
            console.log(`    - network_readings_reading_id_seq last_value: ${lastVal} (Expected: >= 4032)`);
            if (lastVal < 4032) {
                console.error('    FAIL: Sequence not properly reset!');
                allPassed = false;
            } else {
                console.log('    PASS: Sequence properly aligned with maximum reading_id.');
            }
        }

        console.log('\n====================================================');
        if (allPassed) {
            console.log('ALL PHASE 1 VALIDATIONS PASSED SUCCESSFULLY!');
        } else {
            console.error('SOME VALIDATIONS FAILED. SEE DETAILS ABOVE.');
            process.exit(1);
        }
        console.log('====================================================\n');

    } catch (err) {
        console.error('Validation error:', err);
        process.exit(1);
    } finally {
        client.release();
    }
}

if (require.main === module) {
    validateDatabase()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = validateDatabase;
