/**
 * Artist data extraction utilities for Fandom provider
 */

/**
 * Extract artist data from various sources
 */
export function extractArtists(resultMetadata: Record<string, unknown>, result: Record<string, unknown>): string[] {
  const artistFromMetadataArray = resultMetadata['artists'];
  const artistFromMetadataSingular = resultMetadata['artist'];
  const artistFromRootArray = result['artists'];
  const artistFromRootSingular = result['artist'];

  return (artistFromMetadataArray ??
    artistFromRootArray ??
    (artistFromMetadataSingular ? [artistFromMetadataSingular] :
      (artistFromRootSingular ? [artistFromRootSingular] : []))) as string[];
}
