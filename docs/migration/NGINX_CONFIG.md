# NGINX Configuration Guide for Bun Runtime

*Status: Active*
*Author: Development Team*
*Last Updated: 2025-10-15*

---

## Overview

This guide provides production-ready NGINX configurations for deploying Mugiwara Kaizoku with Bun 1.3 runtime. It covers reverse proxy setup, SSL/TLS configuration, caching strategies, load balancing, and security hardening.

---

## Table of Contents

1. [Basic Reverse Proxy Setup](#basic-reverse-proxy-setup)
2. [Production Configuration](#production-configuration)
3. [SSL/TLS Configuration](#ssltls-configuration)
4. [Caching Strategy](#caching-strategy)
5. [Load Balancing](#load-balancing)
6. [Security Hardening](#security-hardening)
7. [WebSocket Support](#websocket-support)
8. [Monitoring & Logging](#monitoring--logging)
9. [Troubleshooting](#troubleshooting)

---

## Basic Reverse Proxy Setup

### Minimal Configuration

```nginx
# /etc/nginx/sites-available/kaizoku-basic
server {
    listen 80;
    server_name kaizoku.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Enable Configuration

```bash
# Link configuration
sudo ln -s /etc/nginx/sites-available/kaizoku-basic /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload NGINX
sudo systemctl reload nginx
```

---

## Production Configuration

### Full-Featured Configuration

```nginx
# /etc/nginx/sites-available/kaizoku-production

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;

# Connection limiting
limit_conn_zone $binary_remote_addr zone=addr:10m;

# Upstream configuration for Bun application
upstream kaizoku_bun {
    # Single instance
    server localhost:3000 max_fails=3 fail_timeout=30s;

    # Multiple instances (if using PM2 or similar)
    # server localhost:3000 weight=1;
    # server localhost:3001 weight=1;
    # server localhost:3002 weight=1;

    # Health check (requires nginx-plus or custom module)
    # health_check interval=10s fails=3 passes=2;

    # Keep-alive connections
    keepalive 32;
}

# Main server block
server {
    listen 80;
    listen [::]:80;
    server_name kaizoku.example.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name kaizoku.example.com;

    # Root directory (for static assets)
    root /var/www/kaizoku/public;

    # SSL Configuration (see SSL section below)
    ssl_certificate /etc/letsencrypt/live/kaizoku.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kaizoku.example.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Content Security Policy (adjust as needed)
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'self';" always;

    # Logging
    access_log /var/log/nginx/kaizoku-access.log combined buffer=32k flush=5s;
    error_log /var/log/nginx/kaizoku-error.log warn;

    # Client settings
    client_max_body_size 100M;
    client_body_buffer_size 128k;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 8k;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    send_timeout 60s;

    # Connection limiting
    limit_conn addr 10;

    # Static assets with aggressive caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
        try_files $uri @proxy;
    }

    # Next.js static files
    location /_next/static/ {
        proxy_pass http://kaizoku_bun;
        proxy_cache kaizoku_cache;
        proxy_cache_valid 200 1y;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        add_header Cache-Control "public, immutable";
        add_header X-Cache-Status $upstream_cache_status;
    }

    # API routes with rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;

        proxy_pass http://kaizoku_bun;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # No caching for API routes
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate";
    }

    # Authentication routes with stricter rate limiting
    location /api/auth/ {
        limit_req zone=auth burst=5 nodelay;

        proxy_pass http://kaizoku_bun;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check endpoint (no rate limiting)
    location /api/health {
        proxy_pass http://kaizoku_bun;
        access_log off;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://kaizoku_bun;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # Main application proxy
    location @proxy {
        limit_req zone=general burst=50 nodelay;

        proxy_pass http://kaizoku_bun;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Default location
    location / {
        try_files $uri @proxy;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}

# Cache configuration
proxy_cache_path /var/cache/nginx/kaizoku levels=1:2 keys_zone=kaizoku_cache:10m max_size=1g inactive=60m use_temp_path=off;
```

---

## SSL/TLS Configuration

### Let's Encrypt Setup

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d kaizoku.example.com

# Auto-renewal is configured automatically
# Test renewal:
sudo certbot renew --dry-run
```

### SSL Best Practices

```nginx
# Modern SSL configuration (Mozilla recommended)
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
ssl_prefer_server_ciphers off;

# SSL session caching
ssl_session_cache shared:SSL:50m;
ssl_session_timeout 1d;
ssl_session_tickets off;

# OCSP stapling
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/letsencrypt/live/kaizoku.example.com/chain.pem;

# DNS resolver for OCSP
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;

# HSTS (6 months)
add_header Strict-Transport-Security "max-age=15768000; includeSubDomains; preload" always;
```

---

## Caching Strategy

### Static Asset Caching

```nginx
# Cache levels:
# - Immutable assets: 1 year
# - Versioned assets: 30 days
# - Dynamic pages: No cache or short TTL

location ~* \.(jpg|jpeg|png|gif|ico)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location ~* \.(css|js)$ {
    expires 30d;
    add_header Cache-Control "public, must-revalidate";
}

# Next.js build artifacts
location /_next/static/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Proxy Caching

```nginx
# Enable proxy cache for specific routes
location /api/manga/list {
    proxy_pass http://kaizoku_bun;
    proxy_cache kaizoku_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_key "$scheme$request_method$host$request_uri";
    add_header X-Cache-Status $upstream_cache_status;
}
```

---

## Load Balancing

### Multiple Bun Instances

```nginx
upstream kaizoku_bun {
    least_conn;  # Use least connections algorithm

    server localhost:3000 weight=1 max_fails=3 fail_timeout=30s;
    server localhost:3001 weight=1 max_fails=3 fail_timeout=30s;
    server localhost:3002 weight=1 max_fails=3 fail_timeout=30s;

    keepalive 32;
}
```

### PM2 Setup for Multiple Instances

```bash
# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'kaizoku-bun',
    script: 'bun',
    args: '.next/standalone/server.js',
    instances: 3,
    exec_mode: 'cluster',
    env: {
      PORT: 3000,
      NODE_ENV: 'production'
    }
  }]
}
```

---

## Security Hardening

### Rate Limiting

```nginx
# Define zones at http level
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;
limit_req_zone $binary_remote_addr zone=download:10m rate=2r/s;

# Apply to specific locations
location /api/auth/ {
    limit_req zone=auth burst=5 nodelay;
    # ...
}
```

### DDoS Protection

```nginx
# Connection limits
limit_conn_zone $binary_remote_addr zone=addr:10m;
limit_conn addr 10;

# Request body size limits
client_max_body_size 10M;
client_body_buffer_size 128k;

# Timeout protection
client_body_timeout 12;
client_header_timeout 12;
keepalive_timeout 15;
send_timeout 10;
```

### Blocking Bad Bots

```nginx
# Block bad user agents
map $http_user_agent $bad_bot {
    default 0;
    ~*bot 1;
    ~*spider 1;
    ~*crawler 1;
    ~*scraper 1;
}

server {
    if ($bad_bot) {
        return 403;
    }
}
```

---

## WebSocket Support

```nginx
# WebSocket configuration
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

location /socket.io/ {
    proxy_pass http://kaizoku_bun;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 86400;  # 24 hours
}
```

---

## Monitoring & Logging

### Access Logs with Custom Format

```nginx
# Custom log format with timing
log_format timing '$remote_addr - $remote_user [$time_local] '
                  '"$request" $status $body_bytes_sent '
                  '"$http_referer" "$http_user_agent" '
                  'rt=$request_time uct="$upstream_connect_time" '
                  'uht="$upstream_header_time" urt="$upstream_response_time"';

access_log /var/log/nginx/kaizoku-timing.log timing;
```

### NGINX Status Endpoint

```nginx
# Status monitoring (internal only)
server {
    listen 127.0.0.1:8080;
    server_name localhost;

    location /nginx_status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        deny all;
    }
}
```

### Log Rotation

```bash
# /etc/logrotate.d/nginx-kaizoku
/var/log/nginx/kaizoku-*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 `cat /var/run/nginx.pid`
        fi
    endscript
}
```

---

## Troubleshooting

### Check Configuration

```bash
# Test configuration
sudo nginx -t

# Show compiled modules
nginx -V

# Check error logs
sudo tail -f /var/log/nginx/error.log
```

### Common Issues

#### 502 Bad Gateway

**Cause:** Bun app not running or not accessible

**Solution:**
```bash
# Check if app is running
lsof -i :3000

# Check app logs
pm2 logs kaizoku-bun

# Restart app
pm2 restart kaizoku-bun
```

#### 504 Gateway Timeout

**Cause:** Request taking too long

**Solution:**
```nginx
# Increase timeouts in NGINX config
proxy_connect_timeout 120s;
proxy_send_timeout 120s;
proxy_read_timeout 120s;
```

#### Connection Reset

**Cause:** WebSocket upgrade issues

**Solution:**
```nginx
# Ensure WebSocket headers are set
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

---

## Performance Tuning

### Worker Processes

```nginx
# nginx.conf
user www-data;
worker_processes auto;  # One per CPU core
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}
```

### Buffer Tuning

```nginx
http {
    # Buffer sizes
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;

    # FastCGI buffer (if using PHP)
    fastcgi_buffer_size 128k;
    fastcgi_buffers 4 256k;
    fastcgi_busy_buffers_size 256k;
}
```

---

## Testing Configuration

### Load Testing with k6

```bash
# Test through NGINX
k6 run --vus 50 --duration 60s \
  -e BASE_URL=https://kaizoku.example.com \
  scripts/loadtest.js
```

### SSL Testing

```bash
# Test SSL configuration
openssl s_client -connect kaizoku.example.com:443 -tls1_2

# Check SSL grade
# Visit: https://www.ssllabs.com/ssltest/
```

---

## Quick Reference Commands

```bash
# Reload configuration
sudo nginx -s reload

# Test configuration
sudo nginx -t

# View error log
sudo tail -f /var/log/nginx/error.log

# View access log
sudo tail -f /var/log/nginx/access.log

# Check NGINX status
sudo systemctl status nginx

# Restart NGINX
sudo systemctl restart nginx
```

---

*Last updated: October 15, 2025*
*For Bun runtime specific issues, see: DEVELOPER_GUIDE.md*
