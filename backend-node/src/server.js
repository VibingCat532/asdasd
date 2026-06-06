/**
 * Express server setup for HoodStories Rekrutacje
 */
require('express-async-errors');
require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { initPool, closePool } = require('./db');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/auth');
const recruitmentRoutes = require('./routes/recruitments');
const applicationRoutes = require('./routes/applications');
const staffRoutes = require('./routes/staff');

const app = express();
const PORT = process.env.PORT || 3001;
let initPromise = null;

// ────────── Middleware ──────────

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS
const corsOrigins = process.env.CORS_ORIGINS || '*';
app.use(cors({
  origin: corsOrigins === '*' ? '*' : corsOrigins.split(','),
  credentials: true,
}));

async function ensureAppReady() {
  if (!process.env.DATABASE_URL) {
    return;
  }

  if (!initPromise) {
    initPromise = initPool().catch((err) => {
      initPromise = null;
      throw err;
    });
  }

  await initPromise;
}

app.use(async (req, res, next) => {
  try {
    await ensureAppReady();
    next();
  } catch (err) {
    next(err);
  }
});

// ────────── Routes ──────────

app.use('/api/auth', authRoutes);
app.use('/api/recruitments', recruitmentRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/staff', staffRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root API info
app.get('/api', (req, res) => {
  res.json({
    message: 'HoodStories Rekrutacje API',
    version: '1.0.0',
    docs: '/api/docs',
  });
});

// ────────── Error Handling ──────────

app.use((err, req, res, next) => {
  logger.error('Request error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
  });

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    status: statusCode,
  });
});

// ────────── Server Startup ──────────

async function startServer() {
  try {
    await ensureAppReady();

    // Start listening
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
}

// ────────── Graceful Shutdown ──────────

if (require.main === module) {
  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully...');
    await closePool();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    await closePool();
    process.exit(0);
  });

  startServer();
}

module.exports = app;
