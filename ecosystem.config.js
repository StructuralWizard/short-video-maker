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
    kill_timeout: 3000,
    wait_ready: true,
    env: {
      NODE_ENV: "production",
      PORT: 3123,
      PATH: '/Users/nino/.pyenv/versions/3.10.17/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/System/Cryptexes/App/usr/bin:/usr/bin:/bin:/usr/sbin:/sbin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/local/bin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/bin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/appleinternal/bin',
      PYTHONPATH: '/Users/nino/.pyenv/versions/3.10.17/lib/python3.10/site-packages',
      PYTHONHOME: '/Users/nino/.pyenv/versions/3.10.17',
      LD_LIBRARY_PATH: '/Users/nino/.pyenv/versions/3.10.17/lib'
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