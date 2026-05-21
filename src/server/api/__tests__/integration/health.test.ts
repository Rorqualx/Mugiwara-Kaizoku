/**
 * Health Endpoint Integration Tests
 *
 * Tests for the /api/v1/health endpoint that provides system health status.
 */

import { monitoringService } from '@/server/api/services/monitoringService';

describe('/api/v1/health', () => {
  afterAll(() => {
    // Clean up monitoring service intervals
    monitoringService.shutdown();
  });

  it('should return health status from monitoring service', () => {
    const healthStatus = monitoringService.getHealthStatus();

    expect(healthStatus).toBeDefined();
    expect(healthStatus.status).toBeDefined();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(healthStatus.status);
    expect(healthStatus.checks).toBeDefined();
    expect(Array.isArray(healthStatus.checks)).toBe(true);
    expect(healthStatus.timestamp).toBeInstanceOf(Date);
  });

  it('should include various health checks', () => {
    const healthStatus = monitoringService.getHealthStatus();

    expect(healthStatus.checks.length).toBeGreaterThan(0);

    // Check that each health check has required fields
    for (const check of healthStatus.checks) {
      expect(check.name).toBeDefined();
      expect(check.status).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(check.status);
      expect(check.lastCheck).toBeInstanceOf(Date);
    }
  });

  it('should support getting active alerts', () => {
    const alerts = monitoringService.getActiveAlerts();

    expect(Array.isArray(alerts)).toBe(true);
  });

  it('should support getting metric history', () => {
    const history = monitoringService.getMetricHistory('cpu.usage');

    expect(Array.isArray(history)).toBe(true);
  });

  it('should support updating thresholds', () => {
    expect(() => {
      monitoringService.updateThreshold('test.metric', 50, 80);
    }).not.toThrow();
  });
});
