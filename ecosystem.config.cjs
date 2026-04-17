module.exports = {
  apps: [
    {
      name: 'patience-ai',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
      },
      // Auto-restart on crash
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      // Logging
      out_file: '/tmp/patience-ai-out.log',
      error_file: '/tmp/patience-ai-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
