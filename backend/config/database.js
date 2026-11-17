require('dotenv').config();
const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';
const useSSL = process.env.DB_SSL === 'true' || 
    (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')) ||
    (isProduction && process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== 'db');

const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ...(useSSL && { ssl: { rejectUnauthorized: false } }),
    }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'campus_wifi_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        ...(useSSL && { ssl: { rejectUnauthorized: false } }),
    };

const pool = new Pool(poolConfig);

// Handle idle connection errors gracefully without crashing the server process
pool.on('error', (err) => {
    console.error('[PostgreSQL Pool Error] Unexpected error on idle client:', err.message);
});

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
};
