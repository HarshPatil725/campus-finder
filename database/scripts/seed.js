const fs = require('fs');
const path = require('path');
const { pool } = require('../../backend/config/db');

function parseCSV(content) {
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return [];
    
    // Parse header
    const header = parseCSVLine(lines[0]);
    const records = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const record = {};
        header.forEach((key, index) => {
            const rawVal = values[index] !== undefined ? values[index].trim() : '';
            record[key.trim()] = rawVal;
        });
        records.push(record);
    }
    return records;
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);
    return values;
}

async function seedDatabase() {
    const client = await pool.connect();
    try {
        console.log('[Seed] Checking current database row counts...');
        const apCountRes = await client.query('SELECT COUNT(*)::int AS count FROM access_points');
        const nrCountRes = await client.query('SELECT COUNT(*)::int AS count FROM network_readings');
        const incCountRes = await client.query('SELECT COUNT(*)::int AS count FROM incidents');

        const apCount = apCountRes.rows[0].count;
        const nrCount = nrCountRes.rows[0].count;
        const incCount = incCountRes.rows[0].count;

        console.log(`[Seed] Existing counts: access_points=${apCount}, network_readings=${nrCount}, incidents=${incCount}`);

        // Check if fully seeded
        if (apCount === 12 && nrCount === 4032 && incCount === 20) {
            console.log('[Seed] Database is already fully seeded. Safe to skip.');
            return;
        }

        // Check if partially populated
        if (apCount > 0 || nrCount > 0 || incCount > 0) {
            throw new Error(
                `[Seed] Database is in a partially populated state (access_points=${apCount}, network_readings=${nrCount}, incidents=${incCount}). ` +
                'Aborting import to prevent data corruption or duplicates.'
            );
        }

        console.log('[Seed] Reading CSV files from database/csv/...');
        const apCsvPath = path.join(__dirname, '../csv/access_points.csv');
        const nrCsvPath = path.join(__dirname, '../csv/network_readings.csv');
        const incCsvPath = path.join(__dirname, '../csv/incidents.csv');

        const apRecords = parseCSV(fs.readFileSync(apCsvPath, 'utf8'));
        const nrRecords = parseCSV(fs.readFileSync(nrCsvPath, 'utf8'));
        const incRecords = parseCSV(fs.readFileSync(incCsvPath, 'utf8'));

        console.log(`[Seed] Parsed: ${apRecords.length} APs, ${nrRecords.length} readings, ${incRecords.length} incidents.`);

        if (apRecords.length !== 12 || nrRecords.length !== 4032 || incRecords.length !== 20) {
            throw new Error(
                `[Seed] CSV record count mismatch! Expected 12 APs, 4032 readings, 20 incidents. ` +
                `Found: ${apRecords.length} APs, ${nrRecords.length} readings, ${incRecords.length} incidents.`
            );
        }

        // Begin Transaction
        console.log('[Seed] Starting database transaction...');
        await client.query('BEGIN');

        // 1. Insert access_points
        console.log('[Seed] Inserting 12 access points...');
        for (const ap of apRecords) {
            await client.query(
                `INSERT INTO access_points (access_point_id, building, location) VALUES ($1, $2, $3)`,
                [ap.access_point_id, ap.building, ap.location]
            );
        }

        // 2. Insert network_readings (in chunks of 500 for performance and reliability)
        console.log('[Seed] Inserting 4032 network readings in chunks...');
        const CHUNK_SIZE = 500;
        for (let i = 0; i < nrRecords.length; i += CHUNK_SIZE) {
            const chunk = nrRecords.slice(i, i + CHUNK_SIZE);
            const valueClauses = [];
            const params = [];
            let pIdx = 1;

            for (const r of chunk) {
                const readingId = parseInt(r.reading_id, 10);
                const apId = r.access_point_id;
                const timestamp = r.timestamp;
                const latency = r.latency_ms === '' ? null : parseFloat(r.latency_ms);
                const packetLoss = parseFloat(r.packet_loss_pct);
                const isUp = String(r.is_up).trim().toUpperCase() === 'TRUE';

                valueClauses.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5})`);
                params.push(readingId, apId, timestamp, latency, packetLoss, isUp);
                pIdx += 6;
            }

            const insertQuery = `
                INSERT INTO network_readings (reading_id, access_point_id, timestamp, latency_ms, packet_loss_pct, is_up)
                VALUES ${valueClauses.join(', ')}
            `;
            await client.query(insertQuery, params);
        }

        // 3. Insert incidents
        console.log('[Seed] Inserting 20 incidents...');
        for (const inc of incRecords) {
            const incId = inc.incident_id;
            const apId = inc.access_point_id;
            const startTime = inc.start_time;
            const endTime = inc.end_time === '' ? null : inc.end_time;
            const status = inc.status;
            const cause = inc.suspected_cause;
            const resolution = inc.resolution === '' ? null : inc.resolution;

            await client.query(
                `INSERT INTO incidents (incident_id, access_point_id, start_time, end_time, status, suspected_cause, resolution)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [incId, apId, startTime, endTime, status, cause, resolution]
            );
        }

        // 4. Reset Identity Sequence for network_readings.reading_id
        console.log('[Seed] Resetting network_readings identity sequence...');
        await client.query(`
            SELECT setval(
                pg_get_serial_sequence('network_readings', 'reading_id'),
                COALESCE(MAX(reading_id), 1)
            ) FROM network_readings
        `);

        // Commit Transaction
        await client.query('COMMIT');
        console.log('[Seed] Transaction committed successfully! All rows imported.');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[Seed] Transaction rolled back due to error:', err);
        throw err;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    seedDatabase()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = seedDatabase;
