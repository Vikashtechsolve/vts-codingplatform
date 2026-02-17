const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

// Prevent Redis connection errors from crashing the process (register before any Redis usage)
process.on('unhandledRejection', (reason) => {
  const isRedisError = reason && typeof reason === 'object' && (
    (reason.code === 'ECONNREFUSED' && reason.port === 6379) ||
    (reason.message && (String(reason.message).includes('ECONNREFUSED') || String(reason.message).includes('6379')))
  );
  if (isRedisError) {
    console.warn('⚠️ Redis connection refused. Ensure REDIS_URL is set (Railway public URL in .env or Variables).');
    return;
  }
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

const app = express();

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Middleware
// app.use(cors({
//   origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002','https://vts-codingplatform.vercel.app/login'],
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
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

// Evaluation queue health (for debugging AI project evaluation)
app.get('/api/health/evaluation', async (req, res) => {
  try {
    const { getQueueStats } = require('./workers/evaluationWorker');
    const stats = await getQueueStats();
    res.json({
      status: 'OK',
      evaluation: {
        queueConnected: true,
        waiting: stats.waiting,
        active: stats.active,
        completed: stats.completed,
        failed: stats.failed
      }
    });
  } catch (err) {
    res.status(503).json({
      status: 'ERROR',
      evaluation: { queueConnected: false, error: err.message }
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
app.use('/api/questions', require('./routes/questions'));
app.use('/api/interview-questions', require('./routes/interviewQuestions'));
app.use('/api/tests', require('./routes/tests'));
app.use('/api/interviews', require('./routes/interviews'));
app.use('/api/interview-sessions', require('./routes/interviewSessions'));
app.use('/api/students', require('./routes/students'));
app.use('/api/results', require('./routes/results'));
app.use('/api/code-execution', require('./routes/codeExecution'));
app.use('/api/dataset-templates', require('./routes/datasetTemplates'));
app.use('/api/sql-questions', require('./routes/sqlQuestions'));
app.use('/api/sql-execution', require('./routes/sqlExecution'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/topics', require('./routes/topics'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/project-submissions', require('./routes/projectSubmissions'));

// Load evaluation worker and test Redis connection on startup
const { testRedisConnection } = require('./config/redis');
const loadEvaluationWorker = async () => {
  const connected = await testRedisConnection();
  if (connected) {
    try {
      require('./workers/evaluationWorker');
    } catch (err) {
      console.warn('⚠️ Evaluation worker failed to load:', err.message);
    }
  } else {
    console.warn('⚠️ Redis not connected. AI project evaluation will not work.');
  }
};
setImmediate(loadEvaluationWorker);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/coding-platform';
console.log('Attempting to connect to MongoDB...');
console.log('MongoDB URI:', mongoURI.replace(/\/\/.*@/, '//***:***@')); // Hide credentials

mongoose.connect(mongoURI)
.then(() => {
  console.log('✅ MongoDB Connected Successfully');
  // Initialize super admin
  require('./utils/initSuperAdmin')();
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🚀 Server Started Successfully!');
  console.log('='.repeat(50));
  console.log(`📍 Server running on: http://localhost:${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔐 Auth endpoint: http://localhost:${PORT}/api/auth/login`);
  console.log('='.repeat(50));
  console.log('📝 Waiting for requests...\n');
});

