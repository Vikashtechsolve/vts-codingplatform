const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

function isProbablyContainer() {
  try {
    return fs.existsSync('/.dockerenv') || fs.existsSync('/run/.containerenv');
  } catch {
    return false;
  }
}

/** Persists across `podman logs` scroll-off; copy out with `podman cp api:/app/logs/shutdown-audit.log .` */
function appendShutdownAudit(line) {
  const logPath = path.join(__dirname, 'logs', 'shutdown-audit.log');
  try {
    if (!fs.existsSync(path.dirname(logPath))) {
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
    }
    fs.appendFileSync(logPath, `${line}\n`);
  } catch {
    /* ignore */
  }
  try {
    process.stderr.write(`[shutdown-audit] ${line}\n`);
  } catch {
    /* ignore */
  }
}

// Log infra flakiness without taking down the whole API (Podman would otherwise restart constantly).
function isLikelyRedisInfrastructureError(reason) {
  if (!reason || typeof reason !== 'object') return false;
  const code = reason.code;
  const msg = String(reason.message || '');
  if (code === 'ECONNREFUSED' && reason.port === 6379) return true;
  if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'EAI_AGAIN'].includes(code)) {
    if (msg.includes('6379') || /redis|cache\.amazonaws/i.test(msg)) return true;
  }
  return false;
}

process.on('unhandledRejection', (reason) => {
  if (isLikelyRedisInfrastructureError(reason)) {
    console.warn('⚠️ Redis connection issue (ignored for process lifetime):', reason.message || reason);
    return;
  }
  console.error('Unhandled Rejection:', reason);
  // Previously this always called process.exit(1), which stopped the container and took down the site
  // on any stray async error. Prefer staying up; set EXIT_ON_UNHANDLED_REJECTION=true for fail-fast.
  if (process.env.EXIT_ON_UNHANDLED_REJECTION === 'true') {
    process.exit(1);
  }
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

/** SIGTERM/SIGINT: drain HTTP, close Bull queues, then Mongo (single handler — workers do not exit the process when embedded). */
function installApiGracefulShutdown(httpServer) {
  const graceMs = parseInt(process.env.SHUTDOWN_GRACE_MS || '28000', 10);
  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    const auditLine = `${new Date().toISOString()} signal=${signal} pid=${process.pid} uptimeSec=${Math.floor(process.uptime())} GRACEFUL_SHUTDOWN`;
    appendShutdownAudit(auditLine);
    console.log(`📴 ${signal} — API graceful shutdown (HTTP → queues → Mongo)...`);
    console.log(
      '[hint] Exit 0 after this line means the process received SIGTERM or SIGINT (e.g. podman/docker stop, systemd, or SSH user session end with rootless Podman). Fix host: loginctl enable-linger + systemd user unit; do not rely on manual podman run alone.'
    );

    const forceTimer = setTimeout(() => {
      console.error('⚠️ Shutdown grace period elapsed; exiting.');
      process.exit(1);
    }, graceMs);

    try {
      await new Promise((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()));
      });
    } catch (e) {
      console.error('httpServer.close:', e.message || e);
    }

    try {
      const ew = require('./workers/evaluationWorker');
      if (typeof ew.closeEvaluationQueue === 'function') {
        await ew.closeEvaluationQueue();
      }
    } catch (e) {
      console.warn('Evaluation queue close skipped:', e.message || e);
    }

    try {
      const resolved = require.resolve('./workers/codeExecutionWorker');
      const cached = require.cache[resolved];
      if (cached && typeof cached.exports.closeCodeExecutionQueues === 'function') {
        await cached.exports.closeCodeExecutionQueues();
      }
    } catch (_) {
      /* code worker not loaded (standalone worker or Redis skipped load) */
    }

    try {
      await mongoose.connection.close();
    } catch (e) {
      console.error('mongoose.close:', e.message || e);
    }

    clearTimeout(forceTimer);
    process.exit(0);
  }

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM').catch((e) => {
      console.error('SIGTERM shutdown error:', e);
      process.exit(1);
    });
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT').catch((e) => {
      console.error('SIGINT shutdown error:', e);
      process.exit(1);
    });
  });
}

const app = express();
app.set('trust proxy', 1);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// CORS: default reflects the request Origin (works for any frontend domain + Authorization header).
// Optional lockdown: set ALLOWED_ORIGINS="https://app.vercel.app,https://www.example.com" (comma-separated, no paths).
const parseAllowedOrigins = () => {
  const raw = process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
};
const allowedOrigins = parseAllowedOrigins();
const corsOptions =
  allowedOrigins.length > 0
    ? {
        origin(origin, callback) {
          if (!origin) return callback(null, true);
          if (allowedOrigins.includes(origin)) return callback(null, true);
          console.warn(`[CORS] Blocked origin: ${origin}`);
          return callback(null, false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      }
    : {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      };

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve legacy uploaded files from disk (fallback for files not yet migrated to R2)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('Health check endpoint called');
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 5000
  });
});

// Diagnostic echo — reveals what the API actually saw from the client (origin, ip, headers).
app.all('/api/_diag', (req, res) => {
  res.json({
    ok: true,
    method: req.method,
    receivedAt: new Date().toISOString(),
    origin: req.headers.origin || null,
    referer: req.headers.referer || null,
    userAgent: req.headers['user-agent'] || null,
    forwardedFor: req.headers['x-forwarded-for'] || null,
    clientIp: req.ip,
    allowedOriginsConfigured: allowedOrigins.length > 0 ? allowedOrigins : '(open: any origin reflected)',
  });
});

// Evaluation queue health (for debugging AI project evaluation)
app.get('/api/health/evaluation', async (req, res) => {
  try {
    const { getQueueStats, getRecentFailedQueueJobs } = require('./workers/evaluationWorker');
    const stats = await getQueueStats();
    const recentFailed = await getRecentFailedQueueJobs(5);
    res.json({
      status: 'OK',
      evaluation: {
        queueConnected: true,
        waiting: stats.waiting,
        delayed: stats.delayed,
        active: stats.active,
        completed: stats.completed,
        failed: stats.failed,
        recentFailedJobs: recentFailed
      }
    });
  } catch (err) {
    res.status(503).json({
      status: 'ERROR',
      evaluation: { queueConnected: false, error: err.message }
    });
  }
});

// Code execution queue health (use API queue clients only — never require codeExecutionWorker here
// or the API process would register Bull processors and steal jobs without compilers when CODE_WORKER_STANDALONE=true)
const codeExecutionRoutes = require('./routes/codeExecution');
app.get('/api/health/code-execution', async (req, res) => {
  try {
    const stats = await codeExecutionRoutes.getCodeQueueStats();
    res.json({
      status: 'OK',
      codeExecution: {
        queueConnected: true,
        ...stats
      }
    });
  } catch (err) {
    res.status(503).json({
      status: 'ERROR',
      codeExecution: { queueConnected: false, error: err.message }
    });
  }
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/super-admin', require('./routes/superAdmin'));
app.use('/api/super-admin/global-questions', require('./routes/globalQuestions'));
app.use('/api/super-admin/interview-questions', require('./routes/superAdminInterviewQuestions'));
// Register classrooms route BEFORE vendor-admin to ensure proper matching
app.use('/api/vendor-admin/classrooms', require('./routes/classrooms'));
app.use('/api/vendor-admin', require('./routes/vendorAdmin'));
app.use('/api/question-tags', require('./routes/questionTags'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/questions/english', require('./routes/englishQuestions'));
app.use('/api/interview-questions', require('./routes/interviewQuestions'));
app.use('/api/tests', require('./routes/tests'));
app.use('/api/interviews', require('./routes/interviews'));
app.use('/api/interview-sessions', require('./routes/interviewSessions'));
app.use('/api/students', require('./routes/students'));
app.use('/api/results', require('./routes/results'));
app.use('/api/code-execution', codeExecutionRoutes);
app.use('/api/dataset-templates', require('./routes/datasetTemplates'));
app.use('/api/sql-questions', require('./routes/sqlQuestions'));
app.use('/api/sql-execution', require('./routes/sqlExecution'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/topics', require('./routes/topics'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/project-submissions', require('./routes/projectSubmissions'));
app.use('/api/system-design-problems', require('./routes/systemDesignProblems'));
app.use('/api/system-design-submissions', require('./routes/systemDesignSubmissions'));
app.use('/api/contests', require('./routes/contests'));

// Load workers and test Redis connection on startup
const { testRedisConnection } = require('./config/redis');

/** Ownkube/UI sometimes stores True / "true" / 1 — only exact 'true' used to match. */
function isCodeWorkerStandalone() {
  const raw = process.env.CODE_WORKER_STANDALONE;
  if (raw === undefined || raw === null) return false;
  const v = String(raw).trim().replace(/^["']|["']$/g, '').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

const loadWorkers = async () => {
  const connected = await testRedisConnection();
  if (connected) {
    try {
      require('./workers/evaluationWorker');
    } catch (err) {
      console.warn('⚠️ Evaluation worker failed to load:', err.message);
    }
    // Start code execution worker in-process when not running as separate service
    const standalone = isCodeWorkerStandalone();
    console.log(
      `ℹ️  CODE_WORKER_STANDALONE raw=${JSON.stringify(process.env.CODE_WORKER_STANDALONE)} → standalone=${standalone}`
    );
    if (!standalone) {
      try {
        require('./workers/codeExecutionWorker');
        console.log('✅ Code execution worker loaded (in-process mode)');
      } catch (err) {
        console.warn('⚠️ Code execution worker failed to load:', err.message);
      }
    } else {
      console.log('ℹ️  Code execution worker running as separate process');
    }
  } else {
    console.warn('⚠️ Redis not connected. AI evaluation and code execution queues will not work.');
  }
};
setImmediate(loadWorkers);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/coding-platform';
console.log('Attempting to connect to MongoDB...');
console.log('MongoDB URI:', mongoURI.replace(/\/\/.*@/, '//***:***@')); // Hide credentials

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB driver error:', err.message);
});
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected — driver will retry; requests may fail until reconnected.');
});

mongoose.connect(mongoURI)
.then(() => {
  console.log('✅ MongoDB Connected Successfully');
  // Initialize super admin
  require('./utils/initSuperAdmin')();

  const { sweepExpiredContestTestAttempts } = require('./utils/contestService');
  const { sweepExpiredScheduledTestAttempts } = require('./utils/testSchedule');
  const sweepMs = parseInt(process.env.CONTEST_AUTO_SUBMIT_SWEEP_MS || '60000', 10);
  setInterval(() => {
    sweepExpiredContestTestAttempts().catch((err) => {
      console.error('Contest auto-submit sweep error:', err.message || err);
    });
    sweepExpiredScheduledTestAttempts().catch((err) => {
      console.error('Scheduled test auto-submit sweep error:', err.message || err);
    });
  }, sweepMs);
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;

const httpServer = app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 Server Started Successfully!');
  console.log('='.repeat(50));
  console.log(`📍 Server running on: http://localhost:${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth endpoint: http://localhost:${PORT}/api/auth/login`);
  console.log('='.repeat(50));
  console.log('📝 Waiting for requests...\n');
  if (isProbablyContainer()) {
    console.log(
      '[deploy] Running in a container. If the container stops with Exited (0) while idle, the host sent SIGTERM/SIGINT or ended your user session (common with rootless Podman over SSH). Run: sudo loginctl enable-linger ubuntu && manage the container with a systemd user unit (see backend/deploy/systemd/). Shutdown evidence: /app/logs/shutdown-audit.log'
    );
  }
});

installApiGracefulShutdown(httpServer);

