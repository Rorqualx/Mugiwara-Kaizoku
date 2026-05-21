/**
 * TypeScript definitions for Integration Settings CSS Module
 * 
 * Provides type definitions for the CSS classes used in integration settings components.
 * Ensures type safety when using CSS module class names in TypeScript/React components.
 *
 * @module components/settings/integration.module.css
 */

/**
 * Style definitions for Integration Settings components
 * 
 * @property {string} item - Class for individual settings item with consistent padding
 * @property {string} groupSpacing - Class for adding extra spacing between grouped items
 * @property {string} breadcrumbRoot - Class for breadcrumb container with bottom margin
 * @property {string} separator - Class for spacing between breadcrumb items
 * @property {string} breadcrumb - Class for individual breadcrumb text styling
 * @property {string} divider - Class for section dividers with theme-aware borders
 * @property {string} accordionItem - Class for styling accordion items with consistent spacing
 * 
 * The styles use Mantine theme variables for:
 * - Spacing (--mantine-spacing-xs, --mantine-spacing-md, --mantine-spacing-xl)
 * - Font sizes (--mantine-font-size-sm)
 * - Colors (--mantine-color-default-border)
 * - Border radius (--mantine-radius-md)
 */
declare const styles: {
  readonly item: string;
  readonly groupSpacing: string;
  readonly breadcrumbRoot: string;
  readonly separator: string;
  readonly breadcrumb: string;
  readonly divider: string;
  readonly accordionItem: string;
};

export default styles;
