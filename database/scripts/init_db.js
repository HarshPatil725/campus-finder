const fs = require('fs');
const path = require('path');
const { pool } = require('../../backend/config/db');

async function initSchema() {
    console.log('[DB Init] Applying schema from database/schema/01_schema.sql...');
    const schemaSql = fs.readFileSync(
        path.join(__dirname, '../schema/01_schema.sql'),
        'utf8'
    );

    const client = await pool.connect();
    try {
        await client.query(schemaSql);
        console.log('[DB Init] Schema and views applied successfully.');
    } catch (err) {
        console.error('[DB Init] Error applying schema:', err);
        throw err;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    initSchema()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = initSchema;
