/**
 * Zod schema for Manga Monitoring Configuration
 *
 * Used when parsing manga.monitoringConfig from database
 * Validates monitoring settings for automatic chapter updates
 */

import { z } from 'zod';

/**
 * Monitoring interval options
 */
export const MonitoringIntervalSchema = z.enum(['daily', 'weekly', 'monthly', 'custom']);

export type MonitoringInterval = z.infer<typeof MonitoringIntervalSchema>;

/**
 * Complete monitoring configuration schema
 */
export const MonitoringConfigSchema = z.object({
  isMonitored: z.boolean().default(false),
  interval: MonitoringIntervalSchema.default('daily'),
  notifyOnNew: z.boolean().default(false),
  autoDownload: z.boolean().default(false),
  customIntervalDays: z.number().int().positive().optional(),
  lastChecked: z.string().datetime().optional(),
}).strict();

export type MonitoringConfig = z.infer<typeof MonitoringConfigSchema>;

/**
 * Partial schema for updates (all fields optional)
 */
export const MonitoringConfigUpdateSchema = MonitoringConfigSchema.partial();

export type MonitoringConfigUpdate = z.infer<typeof MonitoringConfigUpdateSchema>;

/**
 * Safe parser with error handling
 *
 * @param data - Unknown data to parse
 * @returns Parsed config or null on error
 */
export function parseMonitoringConfig(data: unknown): MonitoringConfig | null {
  const result = MonitoringConfigSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  console.error('MonitoringConfig validation failed:', result.error.issues);
  return null;
}

/**
 * Type guard for MonitoringConfig
 */
export function isMonitoringConfig(value: unknown): value is MonitoringConfig {
  return MonitoringConfigSchema.safeParse(value).success;
}
