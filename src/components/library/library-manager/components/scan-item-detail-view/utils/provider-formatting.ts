/**
 * Get provider badge color based on provider name
 */
export function getProviderColor(provider: string): string {
  switch (provider.toLowerCase()) {
    case 'anilist':
      return 'blue';
    case 'comicvine':
      return 'orange';
    case 'fandom':
      return 'grape';
    case 'wikipedia':
      return 'gray';
    default:
      return 'gray';
  }
}
