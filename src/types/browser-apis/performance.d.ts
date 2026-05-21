/**
 * Chrome Performance Memory API
 *
 * Type definitions for Chrome-specific performance.memory API.
 * @see https://developer.chrome.com/docs/devtools/memory-problems/
 */

interface MemoryInfo {
  /** Maximum heap size limit in bytes */
  jsHeapSizeLimit: number;
  /** Total allocated heap size in bytes */
  totalJSHeapSize: number;
  /** Currently used heap size in bytes */
  usedJSHeapSize: number;
}

interface PerformanceWithMemory extends Performance {
  /** Chrome-specific memory information (non-standard) */
  memory?: MemoryInfo;
}

declare global {
  interface Performance extends PerformanceWithMemory {}
}

export {};
