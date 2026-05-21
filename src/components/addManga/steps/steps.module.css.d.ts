/**
 * TypeScript definitions for Add Manga Steps CSS Module
 * 
 * Provides type definitions for the CSS classes used in the multi-step manga addition form.
 * Documents layout structure and theme integration with Mantine.
 *
 * @module components/addManga/steps/steps.module.css
 */

/**
 * Style definitions for the Add Manga Steps component
 * 
 * @property {string} wrapper - Outer container with consistent margins
 * @property {string} root - Root element with flex growth behavior
 * @property {string} content - Main content area with vertical spacing
 * @property {string} buttonGroup - Fixed position container for navigation buttons
 * 
 * Layout Features:
 * - Consistent spacing using Mantine's scale
 * - Flexible content growth
 * - Fixed positioning for navigation
 * - Theme-aware colors
 * 
 * Spacing:
 * - Uses Mantine's spacing variables (--mantine-spacing-xl)
 * - Maintains visual rhythm between sections
 * - Ensures proper button placement
 */
declare const styles: {
  readonly wrapper: string;
  readonly root: string;
  readonly content: string;
  readonly buttonGroup: string;
};

export default styles;
