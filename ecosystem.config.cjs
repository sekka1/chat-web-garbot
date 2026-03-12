/**
 * PM2 Ecosystem Configuration
 * https://pm2.keymetrics.io/docs/usage/application-declaration/
 */
module.exports = {
  apps: [
    {
      name: 'garbot-chat',
      script: 'dist/server.js',
      cwd: '/opt/bitnami/apps/garbot-chat',
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // GitHub Copilot SDK authentication
        // Set this on the server: pm2 env 0 will show current env vars
        // To set: create a .env file at /opt/bitnami/apps/garbot-chat/.env
        // with COPILOT_GITHUB_TOKEN=ghp_xxxxx
        // Or export it before pm2 start
        COPILOT_GITHUB_TOKEN: process.env.COPILOT_GITHUB_TOKEN || '',
        // Auth: JWT signing secret (required — generate with: openssl rand -hex 32)
        SESSION_SECRET: process.env.SESSION_SECRET || '',
        // Auth: SQLite database path
        AUTH_DB_PATH: '/opt/bitnami/apps/garbot-chat/data/auth.db',
      },
      // Logging
      error_file: '/opt/bitnami/apps/garbot-chat/logs/error.log',
      out_file: '/opt/bitnami/apps/garbot-chat/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Restart settings
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      restart_delay: 1000,
    },
  ],
};
