/**
 * Monitoring Dashboard for Unified Parser
 * 
 * React component for visualizing parser metrics and health status
 */

import React, { useState, useEffect, useCallback } from 'react';

import type { MetricsCollector, AggregatedMetrics, Alert } from './MetricsCollector';

// ============================================================================
// Types
// ============================================================================

interface DashboardProps {
  metricsCollector: MetricsCollector;
  refreshInterval?: number;
  showAlerts?: boolean;
  showCharts?: boolean;
  compact?: boolean;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, boolean>;
  metrics: AggregatedMetrics;
  alerts: Alert[];
}

// ============================================================================
// Dashboard Component
// ============================================================================

export const MonitoringDashboard: React.FC<DashboardProps> = ({
  metricsCollector,
  refreshInterval = 5000,
  showAlerts = true,
  showCharts = true,
  compact = false
}) => {
  const [metrics, setMetrics] = useState<AggregatedMetrics | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'1m' | '5m' | '15m' | '1h' | '24h'>('5m');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch metrics
  const fetchMetrics = useCallback(() => {
    try {
      const aggregated = metricsCollector.getAggregatedMetrics(selectedPeriod);
      const healthStatus = metricsCollector.getHealthStatus();
      const activeAlerts = metricsCollector.getAlerts({ resolved: false });

      setMetrics(aggregated);
      setHealth(healthStatus);
      setAlerts(activeAlerts);
      setIsLoading(false);
    } catch (error: unknown) {
      console.error('Failed to fetch metrics:', error);
    }
  }, [metricsCollector, selectedPeriod]);

  // Auto-refresh
  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchMetrics, refreshInterval]);

  if (isLoading) {
    return <div className="dashboard-loading">Loading metrics...</div>;
  }

  if (!metrics || !health) {
    return <div className="dashboard-error">No metrics available</div>;
  }

  return (
    <div className={`monitoring-dashboard ${compact ? 'compact' : ''}`}>
      {/* Header */}
      <div className="dashboard-header">
        <h2>Parser Monitoring Dashboard</h2>
        <div className="period-selector">
          {(['1m', '5m', '15m', '1h', '24h'] as const).map((period) =>
          <button
            key={period}
            className={selectedPeriod === period ? 'active' : ''}
            onClick={() => setSelectedPeriod(period)}>

              {period}
            </button>
          )}
        </div>
      </div>

      {/* Health Status */}
      <HealthStatusCard health={health} />

      {/* Key Metrics */}
      <div className="metrics-grid">
        <MetricCard
          title="Total Requests"
          value={metrics.metrics.requests.total}
          subtitle={`${metrics.metrics.requests.successful} successful`}
          trend={calculateTrend(metrics.metrics.requests.total)} />

        
        <MetricCard
          title="Success Rate"
          value={`${calculateSuccessRate(metrics.metrics.requests)}%`}
          status={getSuccessRateStatus(metrics.metrics.requests)} />

        
        <MetricCard
          title="Avg Response Time"
          value={`${metrics.metrics.performance.avgResponseTime.toFixed(0)}ms`}
          subtitle={`P95: ${metrics.metrics.performance.p95ResponseTime.toFixed(0)}ms`} />

        
        <MetricCard
          title="Cache Hit Rate"
          value={`${(metrics.metrics.cache.hitRate * 100).toFixed(1)}%`}
          subtitle={`${metrics.metrics.cache.hits} hits / ${metrics.metrics.cache.misses} misses`} />

      </div>

      {/* Source Breakdown */}
      <div className="source-breakdown">
        <h3>Source Performance</h3>
        <table className="metrics-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Requests</th>
              <th>Errors</th>
              <th>Avg Time</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(metrics.metrics.sources).map(([source, data]) =>
            <tr key={source}>
                <td>{source}</td>
                <td>{data.requests}</td>
                <td className={data.errors > 0 ? 'error' : ''}>{data.errors}</td>
                <td>{data.avgResponseTime.toFixed(0)}ms</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Error Summary */}
      <div className="error-summary">
        <h3>Errors ({metrics.metrics.errors.total})</h3>
        {metrics.metrics.errors.total > 0 &&
        <div className="error-breakdown">
            <div className="error-types">
              <h4>By Type</h4>
              {Object.entries(metrics.metrics.errors.byType).map(([type, count]) =>
            <div key={type} className="error-item">
                  <span>{type}:</span>
                  <span>{count}</span>
                </div>
            )}
            </div>
            <div className="error-sources">
              <h4>By Source</h4>
              {Object.entries(metrics.metrics.errors.bySource).map(([source, count]) =>
            <div key={source} className="error-item">
                  <span>{source}:</span>
                  <span>{count}</span>
                </div>
            )}
            </div>
          </div>
        }
      </div>

      {/* Resilience Metrics */}
      <div className="resilience-metrics">
        <h3>Resilience</h3>
        <div className="resilience-grid">
          <div className="resilience-item">
            <span>Retries:</span>
            <span>{metrics.metrics.resilience.retries}</span>
          </div>
          <div className="resilience-item">
            <span>Circuit Breaker Trips:</span>
            <span className={metrics.metrics.resilience.circuitBreakerTrips > 0 ? 'warning' : ''}>
              {metrics.metrics.resilience.circuitBreakerTrips}
            </span>
          </div>
          <div className="resilience-item">
            <span>Rate Limit Hits:</span>
            <span>{metrics.metrics.resilience.rateLimitHits}</span>
          </div>
          <div className="resilience-item">
            <span>Queue Size:</span>
            <span>{metrics.metrics.resilience.queueSize.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {showAlerts && alerts.length > 0 &&
      <div className="alerts-section">
          <h3>Active Alerts ({alerts.length})</h3>
          <div className="alerts-list">
            {alerts.map((alert) =>
          <AlertCard key={alert["id"]} alert={alert} />
          )}
          </div>
        </div>
      }

      {/* Performance Chart (placeholder) */}
      {showCharts && !compact &&
      <div className="performance-chart">
          <h3>Response Time Trend</h3>
          <div className="chart-placeholder">
            <ResponseTimeChart metrics={metrics} />
          </div>
        </div>
      }
    </div>);

};

// ============================================================================
// Sub-components
// ============================================================================

const HealthStatusCard: React.FC<{health: HealthStatus;}> = ({ health }) => {
  const statusClass = health["status"].toLowerCase();
  const statusIcon = {
    healthy: '✅',
    degraded: '⚠️',
    unhealthy: '❌'
  }[health["status"]];

  return (
    <div className={`health-status ${statusClass}`}>
      <div className="status-header">
        <span className="status-icon">{statusIcon}</span>
        <span className="status-text">System {health["status"]}</span>
      </div>
      <div className="health-checks">
        {Object.entries(health.checks).map(([check, passing]) =>
        <div key={check} className={`check-item ${passing ? 'passing' : 'failing'}`}>
            <span className="check-icon">{passing ? '✓' : '✗'}</span>
            <span className="check-name">{check}</span>
          </div>
        )}
      </div>
    </div>);

};

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  status?: 'good' | 'warning' | 'error';
  trend?: 'up' | 'down' | 'stable';
}> = ({ title, value, subtitle, status, trend }) => {
  return (
    <div className={`metric-card ${status ?? ''}`}>
      <div className="metric-header">
        <span className="metric-title">{title}</span>
        {trend && <span className={`trend ${trend}`}>{getTrendIcon(trend)}</span>}
      </div>
      <div className="metric-value">{value}</div>
      {subtitle && <div className="metric-subtitle">{subtitle}</div>}
    </div>);

};

const AlertCard: React.FC<{alert: Alert;}> = ({ alert }) => {
  const levelClass = alert.level.toLowerCase();
  const levelIcon = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    critical: '🚨'
  }[alert.level];

  return (
    <div className={`alert-card ${levelClass}`}>
      <div className="alert-header">
        <span className="alert-icon">{levelIcon}</span>
        <span className="alert-time">{new Date(alert.timestamp).toLocaleTimeString()}</span>
      </div>
      <div className="alert-message">{alert.message}</div>
      {alert.metric &&
      <div className="alert-details">
          {alert.metric}: {alert.value} (threshold: {alert.threshold})
        </div>
      }
    </div>);

};

const ResponseTimeChart: React.FC<{metrics: AggregatedMetrics;}> = ({ metrics }) => {
  // Simplified chart representation
  const data = [
  { label: 'Min', value: metrics.metrics.performance.minResponseTime },
  { label: 'Avg', value: metrics.metrics.performance.avgResponseTime },
  { label: 'P50', value: metrics.metrics.performance.p50ResponseTime },
  { label: 'P95', value: metrics.metrics.performance.p95ResponseTime },
  { label: 'P99', value: metrics.metrics.performance.p99ResponseTime },
  { label: 'Max', value: metrics.metrics.performance.maxResponseTime }];

  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <div className="simple-chart">
      {data.map((item) =>
      <div key={item.label} className="chart-bar">
          <div className="bar-label">{item.label}</div>
          <div className="bar-container">
            <div
            className="bar-fill"
            style={{ width: `${item.value / maxValue * 100}%` }} />

            <span className="bar-value">{item.value.toFixed(0)}ms</span>
          </div>
        </div>
      )}
    </div>);

};

// ============================================================================
// Helper Functions
// ============================================================================

function calculateSuccessRate(requests: AggregatedMetrics['metrics']['requests']): number {
  if (requests.total === 0) return 100;
  return requests.successful / requests.total * 100;
}

function getSuccessRateStatus(requests: AggregatedMetrics['metrics']['requests']): 'good' | 'warning' | 'error' {
  const rate = calculateSuccessRate(requests);
  if (rate >= 95) return 'good';
  if (rate >= 90) return 'warning';
  return 'error';
}

function calculateTrend(_value: number): 'up' | 'down' | 'stable' {
  // Simplified trend calculation
  return 'stable';
}

function getTrendIcon(trend: 'up' | 'down' | 'stable'): string {
  return {
    up: '↑',
    down: '↓',
    stable: '→'
  }[trend];
}

// ============================================================================
// Styles (CSS-in-JS)
// ============================================================================

export const dashboardStyles = `
.monitoring-dashboard {
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  border-radius: 8px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.period-selector button {
  margin-left: 10px;
  padding: 5px 10px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  border-radius: 4px;
}

.period-selector button.active {
  background: #007bff;
  color: white;
}

.health-status {
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.health-status.healthy {
  background: #d4edda;
  border: 1px solid #c3e6cb;
}

.health-status.degraded {
  background: #fff3cd;
  border: 1px solid #ffeeba;
}

.health-status.unhealthy {
  background: #f8d7da;
  border: 1px solid #f5c6cb;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.metric-card {
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.metric-value {
  font-size: 24px;
  font-weight: bold;
  margin: 10px 0;
}

.metrics-table {
  width: 100%;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.metrics-table th {
  background: #f8f9fa;
  padding: 10px;
  text-align: left;
  font-weight: 600;
}

.metrics-table td {
  padding: 10px;
  border-top: 1px solid #dee2e6;
}

.alert-card {
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 6px;
  border-left: 4px solid;
}

.alert-card.warning {
  background: #fff3cd;
  border-color: #ffc107;
}

.alert-card.error {
  background: #f8d7da;
  border-color: #dc3545;
}

.alert-card.critical {
  background: #721c24;
  color: white;
  border-color: #f5c6cb;
}

.simple-chart {
  padding: 20px;
  background: white;
  border-radius: 8px;
}

.chart-bar {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.bar-label {
  width: 50px;
  font-size: 12px;
}

.bar-container {
  flex: 1;
  height: 20px;
  background: #e9ecef;
  border-radius: 4px;
  position: relative;
  margin: 0 10px;
}

.bar-fill {
  height: 100%;
  background: #007bff;
  border-radius: 4px;
}

.bar-value {
  position: absolute;
  right: 5px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 11px;
}
`;

export default MonitoringDashboard;