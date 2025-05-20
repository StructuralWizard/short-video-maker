module.exports = {
  apps: [{
    name: "short-video-maker",
    script: "./dist/index.js",
    watch: false,
    env: {
      NODE_ENV: "production",
      PATH: '/Users/nino/.pyenv/versions/3.10.17/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/System/Cryptexes/App/usr/bin:/usr/bin:/bin:/usr/sbin:/sbin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/local/bin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/bin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/appleinternal/bin'
    },
    env_development: {
      NODE_ENV: "development"
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: "1G",
    error_file: "logs/err.log",
    out_file: "logs/out.log",
    log_file: "logs/combined.log",
    time: true
  }]
}; 