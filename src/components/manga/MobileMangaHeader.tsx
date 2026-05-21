/**
 * Mobile Manga Header Component
 *
 * Re-exports the decomposed mobile manga header module.
 * The actual implementation is in ./mobile-manga-header/
 *
 * @module MobileMangaHeader
 */

// Re-export main component and all sub-components
export {
  MobileMangaHeader,
  InfoItem,
  HeroSection,
  MonitoringToggle,
  MangaInfoGrid,
  DescriptionSection,
  ActionButtons
} from './mobile-manga-header';

// Re-export types
export type {
  MobileMangaHeaderProps,
  InfoItemProps,
  HeroSectionProps,
  MonitoringToggleProps,
  MangaInfoGridProps,
  DescriptionSectionProps,
  ActionButtonsProps
} from './mobile-manga-header';
