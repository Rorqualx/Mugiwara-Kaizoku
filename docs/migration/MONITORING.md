# Monitoring Guide for Bun Runtime

*Status: Active*
*Author: Development Team*
*Last Updated: 2025-10-15*

---

## Overview

This guide covers comprehensive monitoring strategies for Mugiwara Kaizoku running on Bun 1.3 runtime. It includes application metrics, infrastructure monitoring, log aggregation, alerting, and performance tracking.

---

## Table of Contents

1. [Key Metrics to Monitor](#key-metrics-to-monitor)
2. [Application Monitoring](#application-monitoring)
3. [Infrastructure Monitoring](#infrastructure-monitoring)
4. [Log Management](#log-management)
5. [Alerting Strategy](#alerting-strategy)
6. [Performance Monitoring](#performance-monitoring)
7. [Health Checks](#health-checks)
8. [Dashboards](#dashboards)
9. [Troubleshooting Guide](#troubleshooting-guide)

---

## Key Metrics to Monitor

### Application Metrics

| Metric | Target | Alert Threshold | Critical Threshold |
|--------|--------|-----------------|-------------------|
| Response Time (p50) | < 200ms | > 500ms | > 1000ms |
| Response Time (p95) | < 500ms | > 1000ms | > 2000ms |
| Response Time (p99) | < 1000ms | > 2000ms | > 5000ms |
| Error Rate | < 0.1% | > 1% | > 5% |
| Requests/Second | Varies | N/A | N/A |
| Active Users | Varies | N/A | N/A |

### Infrastructure Metrics

| Metric | Target | Alert Threshold | Critical Threshold |
|--------|--------|-----------------|-------------------|
| CPU Usage | < 70% | > 80% | > 90% |
| Memory Usage | < 70% | > 80% | > 90% |
| Disk Usage | < 70% | > 80% | > 90% |
| Network I/O | < 70% | > 80% | > 90% |
| Container Restarts | 0 | > 3/hour | > 10/hour |

### Business Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Manga Download Success Rate | > 95% | < 90% |
| Metadata Fetch Success Rate | > 98% | < 95% |
| Job Queue Length | < 100 | > 500 |
| Failed Jobs | < 5% | > 10% |

---

## Application Monitoring

### Prometheus + Grafana Setup

#### Install Prometheus

```bash
# Docker Compose addition
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
    restart: unless-stopped
```

#### Prometheus Configuration

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # Kaizoku application metrics
  - job_name: 'kaizoku-bun'
    static_configs:
      - targets: ['kaizoku-bun:3000']
    metrics_path: '/api/metrics'

  # Node exporter (system metrics)
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  # PostgreSQL exporter
  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

#### Grafana Setup

```bash
# Docker Compose addition
services:
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_INSTALL_PLUGINS=redis-datasource
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    restart: unless-stopped
```

### Expose Metrics in Application

```typescript
// src/pages/api/metrics.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { register } from 'prom-client';

// Metrics are collected automatically via prom-client
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
}
```

### Custom Metrics

```typescript
// src/lib/metrics.ts
import { Counter, Histogram, Gauge } from 'prom-client';

// Request metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

// Error tracking
export const errorCounter = new Counter({
  name: 'app_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'severity']
});

// Job queue metrics
export const jobQueueLength = new Gauge({
  name: 'job_queue_length',
  help: 'Number of jobs in queue',
  labelNames: ['status']
});

// Download metrics
export const downloadCounter = new Counter({
  name: 'downloads_total',
  help: 'Total number of downloads',
  labelNames: ['source', 'status']
});
```

---

## Infrastructure Monitoring

### Node Exporter (System Metrics)

```bash
# Docker Compose addition
services:
  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    restart: unless-stopped
```

### PostgreSQL Exporter

```bash
# Docker Compose addition
services:
  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:latest
    container_name: postgres-exporter
    ports:
      - "9187:9187"
    environment:
      DATA_SOURCE_NAME: "postgresql://kaizoku:kaizoku@postgres:5432/kaizoku?sslmode=disable"
    restart: unless-stopped
```

### Docker Stats Monitoring

```bash
# Monitor Docker container stats
docker stats kaizoku-bun --no-stream

# Continuous monitoring
watch -n 5 'docker stats kaizoku-bun --no-stream'
```

---

## Log Management

### Structured Logging with Pino

```typescript
// src/lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
});

// Usage
logger.info({ userId: 123, action: 'download' }, 'User started download');
logger.error({ err, mangaId: 456 }, 'Failed to fetch manga');
```

### Log Aggregation with Loki

```bash
# Docker Compose addition
services:
  loki:
    image: grafana/loki:latest
    container_name: loki
    ports:
      - "3100:3100"
    volumes:
      - ./monitoring/loki-config.yml:/etc/loki/local-config.yaml
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    restart: unless-stopped

  promtail:
    image: grafana/promtail:latest
    container_name: promtail
    volumes:
      - /var/log:/var/log:ro
      - ./monitoring/promtail-config.yml:/etc/promtail/config.yml
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    command: -config.file=/etc/promtail/config.yml
    restart: unless-stopped
```

### Loki Configuration

```yaml
# monitoring/loki-config.yml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
  chunk_idle_period: 5m
  chunk_retain_period: 30s

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 168h

storage_config:
  boltdb:
    directory: /loki/index
  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h
```

### Log Rotation

```bash
# /etc/logrotate.d/kaizoku
/var/log/kaizoku/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 kaizoku kaizoku
    sharedscripts
    postrotate
        # Signal application to reopen log files
        docker kill -s HUP kaizoku-bun || true
    endscript
}
```

---

## Alerting Strategy

### Prometheus Alerting Rules

```yaml
# monitoring/alerts.yml
groups:
  - name: kaizoku_alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(app_errors_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/sec"

      # Slow response time
      - alert: SlowResponseTime
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow response time detected"
          description: "P95 response time is {{ $value }}s"

      # High memory usage
      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes{name="kaizoku-bun"} / container_spec_memory_limit_bytes{name="kaizoku-bun"} > 0.85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value | humanizePercentage }}"

      # Container restart
      - alert: ContainerRestarting
        expr: rate(container_last_seen{name="kaizoku-bun"}[5m]) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Container is restarting"
          description: "Container has restarted {{ $value }} times"

      # Database connection issues
      - alert: DatabaseConnectionFailure
        expr: pg_up{job="postgres-exporter"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection failed"
          description: "PostgreSQL is down or unreachable"
```

### Alertmanager Configuration

```yaml
# monitoring/alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 12h
  receiver: 'slack'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'
      continue: true

receivers:
  - name: 'slack'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_KEY'
```

---

## Performance Monitoring

### APM with OpenTelemetry

```typescript
// src/lib/telemetry.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

const sdk = new NodeSDK({
  metricReader: new PrometheusExporter({ port: 9464 }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Telemetry terminated'))
    .catch((error) => console.error('Error terminating telemetry', error));
});
```

### Real User Monitoring (RUM)

```typescript
// components/RumProvider.tsx
import { useEffect } from 'react';

export function RumProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Track page views
    const handleRouteChange = (url: string) => {
      // Send to analytics service
      fetch('/api/analytics/pageview', {
        method: 'POST',
        body: JSON.stringify({ url, timestamp: Date.now() })
      });
    };

    // Track performance metrics
    if (typeof window !== 'undefined') {
      const perfData = window.performance.timing;
      const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;

      fetch('/api/analytics/performance', {
        method: 'POST',
        body: JSON.stringify({
          pageLoadTime,
          dnsTime: perfData.domainLookupEnd - perfData.domainLookupStart,
          tcpTime: perfData.connectEnd - perfData.connectStart,
          ttfb: perfData.responseStart - perfData.navigationStart,
        })
      });
    }
  }, []);

  return <>{children}</>;
}
```

---

## Health Checks

### Application Health Endpoint

```typescript
// src/pages/api/health.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    // Check external services (optional)
    // const anilistStatus = await checkAniListAPI();
    // const mangadexStatus = await checkMangaDexAPI();

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      runtime: 'bun',
      version: process.env.npm_package_version,
      checks: {
        database: 'ok',
        // anilist: anilistStatus,
        // mangadex: mangadexStatus,
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
```

### Readiness and Liveness Probes

```yaml
# Kubernetes deployment example
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kaizoku-bun
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: kaizoku-bun
          image: mugiwara-kaizoku:bun-latest
          ports:
            - containerPort: 3000
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
```

---

## Dashboards

### Grafana Dashboard JSON

Create dashboards for:

1. **Application Overview**
   - Request rate
   - Response times (p50, p95, p99)
   - Error rate
   - Active users

2. **Infrastructure**
   - CPU usage
   - Memory usage
   - Disk I/O
   - Network I/O

3. **Business Metrics**
   - Manga downloads per hour
   - Failed downloads
   - Job queue length
   - Metadata fetch success rate

4. **Database**
   - Connection pool usage
   - Query performance
   - Slow queries
   - Database size

---

## Troubleshooting Guide

### High Memory Usage

```bash
# Check container memory
docker stats kaizoku-bun --no-stream

# Inspect Node/Bun memory
docker exec kaizoku-bun bun --print-memory-usage

# Heap snapshot (if supported)
docker exec kaizoku-bun bun --snapshot heap.heapsnapshot
```

### Slow Queries

```sql
-- Enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- 1 second
SELECT pg_reload_conf();

-- View slow queries
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### High Error Rate

```bash
# Check recent error logs
docker logs kaizoku-bun --tail 100 | grep ERROR

# Check error distribution
curl http://localhost:3000/api/metrics | grep app_errors_total
```

### Container Crashes

```bash
# View crash logs
docker logs kaizoku-bun --tail 500

# Check exit code
docker inspect kaizoku-bun --format='{{.State.ExitCode}}'

# Review system events
docker events --filter container=kaizoku-bun --since 1h
```

---

## Quick Reference Commands

```bash
# View live metrics
curl http://localhost:3000/api/metrics

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Query Prometheus
curl 'http://localhost:9090/api/v1/query?query=http_request_duration_seconds'

# View Grafana dashboards
open http://localhost:3001  # Default: admin/admin

# Check logs in Loki
curl -G -s "http://localhost:3100/loki/api/v1/query_range" \
  --data-urlencode 'query={job="kaizoku-bun"}' \
  --data-urlencode 'limit=100'
```

---

## Monitoring Checklist

- [ ] Prometheus installed and scraping metrics
- [ ] Grafana dashboards created
- [ ] Alertmanager configured with notification channels
- [ ] Log aggregation (Loki) configured
- [ ] Health checks implemented
- [ ] APM/tracing enabled (optional)
- [ ] Database monitoring configured
- [ ] NGINX access logs analyzed
- [ ] Slack/PagerDuty alerts tested
- [ ] Runbooks created for common issues

---

*Last updated: October 15, 2025*
*For deployment guides, see: deploy-bun.sh and NGINX_CONFIG.md*
