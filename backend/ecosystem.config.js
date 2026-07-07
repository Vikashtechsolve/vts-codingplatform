module.exports = {
  apps: [
    {
      name: 'backend-server',
      script: './server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 5500
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 5500,
        CODE_WORKER_STANDALONE: 'true',
        MAX_QUEUE_WAITING_SINGLE: '200',
        MAX_QUEUE_WAITING_BATCH: '400',
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000
    },
    {
      name: 'code-execution-worker',
      script: './workers/codeExecutionWorker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production',
        CODE_WORKER_SINGLE_CONCURRENCY: '12',
        CODE_WORKER_BATCH_CONCURRENCY: '10',
        CODE_BATCH_CASE_PARALLELISM: '4',
        CODE_EXECUTION_TIMEOUT: '5000',
      },
      error_file: './logs/code-worker-error.log',
      out_file: './logs/code-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '768M',
      restart_delay: 2000,
      max_restarts: 15,
      min_uptime: '10s',
      kill_timeout: 10000
    },
    {
      name: 'evaluation-worker',
      script: './workers/evaluationWorker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,
      cron_restart: '0 3 * * *'
    }
  ]
};
