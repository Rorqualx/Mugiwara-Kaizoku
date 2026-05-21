/**
 * TypeScript definitions for Chapters Table CSS Module
 * 
 * Provides type definitions for the CSS classes used in the chapters table component.
 * Documents performance optimizations and animation strategies used in the styles.
 *
 * @module components/chaptersTable.module.css
 */

/**
 * Style definitions for the Chapters Table component
 *
 * @property {string} table - Root container with performance optimizations
 * @property {string} header - Sticky header with theme-aware colors
 * @property {string} row - Table row with hover animations
 * @property {string} fileName - Filename cell with text truncation
 * @property {string} size - Size cell with monospace alignment
 * @property {string} statusBadge - Status indicator with hover animation
 * @property {string} volumeHeader - Volume section header with transitions
 * @property {string} volumeContent - Expandable content with animations
 * @property {string} volumeContainer - Container with performance optimizations
 * @property {string} actionIcon - Interactive icon with hardware acceleration
 * @property {string} headerRight - Right-aligned header cell with minimal padding
 * @property {string} headerStatus - Status column header with custom padding
 *
 * Performance optimizations include:
 * - CSS containment for better rendering
 * - Hardware acceleration via transform: translateZ(0)
 * - will-change hints for animations
 * - backface-visibility for flicker prevention
 */
declare const styles: {
  readonly table: string;
  readonly header: string;
  readonly row: string;
  readonly fileName: string;
  readonly size: string;
  readonly statusBadge: string;
  readonly volumeHeader: string;
  readonly volumeContent: string;
  readonly volumeContainer: string;
  readonly actionIcon: string;
  readonly headerRight: string;
  readonly headerStatus: string;
};

export default styles;
