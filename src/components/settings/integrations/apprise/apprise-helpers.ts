/**
 * Helper functions for Apprise integration
 */

/**
 * Parse services text into array
 */
export function parseServicesText(servicesText: string): string[] {
  return servicesText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Extract protocol from service URL
 */
export function extractProtocol(url: string): string {
  return url.split('://')[0] ?? 'unknown';
}

/**
 * Format test notification message
 */
export function formatTestMessage(
  successCount: number | null | undefined,
  failureCount: number | null | undefined
): string {
  if (successCount !== null && successCount !== undefined && failureCount !== undefined && failureCount !== null) {
    return `Sent ${successCount}/${successCount + failureCount} notifications successfully`;
  }
  return 'Test notifications sent!';
}

/**
 * Determine notification color based on failure count
 */
export function getNotificationColor(failureCount: number | null | undefined): string {
  return (failureCount ?? 0) > 0 ? 'orange' : 'green';
}
