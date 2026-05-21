/**
 * Download Components
 *
 * Unified download components for consistent download experience across the app.
 *
 * @module download
 */

export { DownloadButton } from './DownloadButton';
export type { DownloadButtonProps, DownloadContext } from './DownloadButton';

export { UnifiedSearchModal } from './UnifiedSearchModal';
export type { UnifiedSearchModalProps } from './search-modal-types';

export { DirectUrlModal } from './DirectUrlModal';
export type { DirectUrlModalProps } from './DirectUrlModal';

export { useSearchResultsColumns } from './SearchResultsColumns';
export type { UseSearchResultsColumnsProps } from './SearchResultsColumns';

export type {
  SortStatus,
  SettingsData,
  BackendSearchResult,
  EnrichedSearchResult,
} from './search-modal-types';

// Direct URL utilities
export {
  detectUrlType,
  validateUrl,
  parseMultipleUrls,
  getCompatibleClients,
  getUrlTypeLabel,
  getUrlTypeColor,
  getProtocolForUrlType,
  extractFilename,
  requiresUsenetClient,
  requiresTorrentClient,
  TORRENT_CLIENTS,
  USENET_CLIENTS,
} from './direct-url-utils';
export type { UrlType, ProtocolType, ParsedUrl, ClientCompatibility } from './direct-url-utils';
