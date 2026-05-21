/**
 * TypeScript definitions for Navigation Bar CSS Module
 * 
 * Provides type definitions for the CSS classes used in the navigation bar component.
 * Documents interactive behaviors and theme integration with Mantine.
 *
 * @module components/navbar.module.css
 */

/**
 * Style definitions for the Navigation Bar component
 * 
 * @property {string} navItem - Base navigation item with hover effects
 * @property {string} navItemDisabled - Non-interactive navigation item
 * @property {string} navItemNested - Indented sub-navigation item
 * @property {string} menuContainer - Container for dropdown functionality
 * @property {string} submenu - Flyout menu with absolute positioning
 * 
 * The styles use Mantine theme variables for:
 * - Spacing (--mantine-spacing-xs, --mantine-spacing-sm)
 * - Colors (--mantine-color-default-hover)
 * - Border radius (--mantine-radius-sm)
 * - Font sizes (--mantine-font-size-xs)
 * 
 * Interactive features include:
 * - Hover transitions with transform effects
 * - Nested menu indentation
 * - Flyout submenu behavior
 */
declare const styles: {
  readonly navItem: string;
  readonly navItemDisabled: string;
  readonly navItemNested: string;
  readonly menuContainer: string;
  readonly submenu: string;
};

export default styles;
