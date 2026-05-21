/**
 * System Process Router
 *
 * Provides Node.js process information for monitoring.
 *
 * Procedures:
 * - getProcessInfo: Get current process metrics
 *
 * Extracted from: system.ts (lines 373-388)
 */

import { adminProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';

// Define return type interface
interface ProcessInfo {
  pid: number;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
  resourceUsage: NodeJS.ResourceUsage | null;
  versions: NodeJS.ProcessVersions;
}

export const systemProcessRouter = router({
  /**
   * Retrieves detailed information about the current Node.js process
   *
   * This endpoint returns various metrics and details about the running
   * Node.js process, including memory usage, uptime, and version information.
   * Useful for debugging and monitoring.
   *
   * @returns Process information including memory usage and uptime
   */
  getProcessInfo: adminProcedure.query((): ProcessInfo => {
    return {
      pid: process.pid,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      resourceUsage:
        typeof process.resourceUsage === 'function'
          ? process.resourceUsage()
          : null,
      versions: process.versions,
    };
  }),
});
