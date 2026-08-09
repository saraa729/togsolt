module.exports = {
  apps: [
    {
      name: 'expocraft-backend',
      script: './app.js',
      cwd: __dirname,
      instances: process.env.WEB_CONCURRENCY || 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 4000
      },
      max_memory_restart: '512M',
      time: true
    }
  ]
};
