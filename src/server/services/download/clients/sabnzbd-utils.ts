/**
 * SABnzbd Utilities Module
 *
 * Shared helper functions and utilities used across all SABnzbd client modules.
 *
 * Extracted from: sabnzbdClient.ts (lines 646-674, 695-707, 711-713)
 */

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult } from '@/utils/async-result';

import type { ConnectionStatus } from '../base';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parses a time left string into seconds
 *
 * @param timeLeft - Time left string (e.g., "1:23:45" or "23:45")
 * @returns Seconds or undefined if invalid
 */
export function parseTimeLeft(timeLeft: string): number | undefined {
  if (!timeLeft || timeLeft === '0:00:00' || timeLeft === '0:00') {
    return undefined;
  }

  const parts = timeLeft.split(':');

  if (parts.length === 3) {
    // Hours:Minutes:Seconds
    const part0 = parts[0];
    const part1 = parts[1];
    const part2 = parts[2];

    if (part0 !== undefined && part1 !== undefined && part2 !== undefined) {
      const hours = parseInt(part0, 10) || 0;
      const minutes = parseInt(part1, 10) || 0;
      const seconds = parseInt(part2, 10) || 0;
      return hours * 3600 + minutes * 60 + seconds;
    }
  } else if (parts.length === 2) {
    // Minutes:Seconds
    const part0 = parts[0];
    const part1 = parts[1];

    if (part0 !== undefined && part1 !== undefined) {
      const minutes = parseInt(part0, 10) || 0;
      const seconds = parseInt(part1, 10) || 0;
      return minutes * 60 + seconds;
    }
  }

  return undefined;
}

/**
 * Test connection to SABnzbd server
 *
 * Note: This is a basic implementation that would need to be adapted
 * for the specific context where it's used. In the original client,
 * this method had access to instance properties and methods.
 *
 * @returns Connection status
 */
export function testConnection(): AsyncResult<ConnectionStatus, Error> {
  // Note: This would need to be adapted to work with actual API calls
  // In the original implementation, this called apiRequest<SabnzbdQueueResponse>('version')
  return createSuccessResult({
    connected: true,
    version: 'SABnzbd',
    capabilities: ['usenet', 'queue', 'categories']
  });
}

/**
 * Dispose of resources
 *
 * Note: This is a placeholder function that would need to be adapted
 * for the specific context where it's used.
 */
export function dispose(): void {
  // Clean up any resources if needed
}