/**
 * Database connection pool and schema initialization for NeonDB (PostgreSQL)
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

let pool = null;

/**
 * Initialize the database connection pool
 */
async function initPool() {
  if (pool) {
    logger.info('Database pool already initialized');
    return pool;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn('DATABASE_URL not set — database features will be unavailable');
    return null;
  }

  try {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    logger.info('Database connection successful');

    // Initialize schema
    await initSchema();

    return pool;
  } catch (err) {
    logger.error('Database initialization failed', err);
    pool = null;
    throw err;
  }
}

/**
 * Initialize database schema
 */
async function initSchema() {
  if (!pool) return;

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  try {
    await pool.query(schemaSql);
    logger.info('Database schema initialized');
  } catch (err) {
    logger.error('Schema initialization failed', err);
    throw err;
  }
}

/**
 * Get the database pool
 */
function getPool() {
  return pool;
}

/**
 * Close the database connection pool
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}

/**
 * Execute a query
 */
async function query(text, params) {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  return pool.query(text, params);
}

module.exports = {
  initPool,
  getPool,
  closePool,
  query,
};
