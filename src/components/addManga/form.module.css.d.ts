/**
 * TypeScript definitions for Add Manga Form CSS Module
 * 
 * Provides type definitions for the CSS classes used in the manga addition form.
 * Documents layout structure and theme integration with Mantine.
 *
 * @module components/addManga/form.module.css
 */

/**
 * Style definitions for the Add Manga Form component
 * 
 * @property {string} form - Main form container with flex column layout
 * @property {string} buttonGroup - Fixed position container for form buttons
 * 
 * Layout Features:
 * - Flex column organization for form elements
 * - Minimum height constraints
 * - Consistent padding using Mantine spacing
 * 
 * Button Group Features:
 * - Fixed positioning at form bottom
 * - Theme-aware background colors
 * - Proper spacing and width calculations
 * - Ensures button accessibility during scroll
 */
declare const styles: {
  readonly form: string;
  readonly buttonGroup: string;
};

export default styles;
