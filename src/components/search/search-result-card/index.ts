/**
 * Search Result Card Components
 *
 * Modular components for rendering search result cards.
 */

export { CardHeader, getProviderColor } from './CardHeader';
export type { CardHeaderProps } from './CardHeader';

export { CardMetadata } from './CardMetadata';
export type { CardMetadataProps } from './CardMetadata';

export { CardContent } from './CardContent';
export type { CardContentProps } from './CardContent';

export { CardActions } from './CardActions';
export type { CardActionsProps } from './CardActions';

export { LoadingCard } from './LoadingCard';
export type { LoadingCardProps } from './LoadingCard';

export { ErrorCard } from './ErrorCard';
export type { ErrorCardProps } from './ErrorCard';

export {
  isAniListResult,
  isComicVineResult,
  isKapowarrResult,
  getExternalLink,
  getExternalLinkSafe,
  getCoverUrl,
  handleImageError
} from './helpers';
