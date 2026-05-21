/**
 * Release Blocklist Utilities
 *
 * Helper functions for release blocklist operations.
 *
 * Extracted from: releaseBlocklistService.ts (lines 549-566)
 */

/**
 * Extract release group from release title
 *
 * Attempts to extract the release group name from common patterns:
 * - [GroupName] - Square brackets
 * - {GroupName} - Curly braces
 * - -GroupName - Dash at end
 * - .GroupName - Dot at end
 *
 * @param releaseTitle - The release title to parse
 * @returns The extracted group name or null if not found
 *
 * @example
 * extractReleaseGroup('[GroupA] Manga Title') // => 'GroupA'
 * extractReleaseGroup('Manga Title-GroupB') // => 'GroupB'
 * extractReleaseGroup('Manga Title') // => null
 */
export function extractReleaseGroup(releaseTitle: string): string | null {
  // Common patterns for release groups
  const patterns = [
    /\[([^\]]+)\]/, // [GroupName]
    /\{([^}]+)\}/, // {GroupName}
    /-([A-Za-z0-9]+)$/, // -GroupName at end
    /\.([A-Za-z0-9]+)$/, // .GroupName at end
  ];

  for (const pattern of patterns) {
    const match = releaseTitle.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}
