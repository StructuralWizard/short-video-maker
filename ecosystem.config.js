module.exports = {
  apps: [{
    name: "short-video-maker",
    script: "dist/index.js",
    exec_mode: "fork",
    instances: 1,
    watch: false,
    max_memory_restart: "20G",
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    min_uptime: "30s",
    kill_timeout: 30000,
    wait_ready: true,
    env: {
      NODE_ENV: "production",
      PORT: 3123,
      PATH: process.env.PATH,
      PYTHONPATH: process.env.PYTHONPATH,
      PYTHONHOME: process.env.PYTHONHOME,
      LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH
    },
    env_development: {
      NODE_ENV: "development"
    },
    autorestart: true,
    error_file: "logs/err.log",
    out_file: "logs/out.log",
    log_file: "logs/combined.log",
    time: true
  }]
}; 