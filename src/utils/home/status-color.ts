/**
 * Manga publication status → Mantine color mapping for home page components.
 *
 * Shared between TrendingBanner and MangaRowCard to avoid duplication.
 */
export function getMangaStatusColor(status?: string): string {
  if (!status) return 'gray';

  const lowerStatus = status.toLowerCase();

  if (lowerStatus.includes('releasing') || lowerStatus.includes('ongoing')) {
    return 'green';
  }
  if (lowerStatus.includes('finished') || lowerStatus.includes('completed')) {
    return 'blue';
  }
  if (lowerStatus.includes('hiatus')) {
    return 'yellow';
  }
  if (lowerStatus.includes('cancelled')) {
    return 'red';
  }

  return 'gray';
}
