/**
 * Mantine Type Extensions
 * 
 * This module extends Mantine's type system to add custom theme properties
 * and component interfaces specific to the application. It provides:
 * - Custom theme property definitions
 * - DataTable component type extensions
 * - Theme utility types and helpers
 * 
 * @module mantine
 */
import type { MantineThemeOverride, MantineTheme } from '@mantine/core';
import type { CssVariable } from '@mantine/core';

/**
 * Extends Mantine's core theme type system
 * Adds custom theme properties for application-specific styling
 */
declare module '@mantine/core' {
  export interface MantineThemeOther {
    fontFamilyNaruto: string;
    borderRadius: {
      sm: string;
      md: string;
      lg: string;
    };
    transitionTimings: {
      fast: string;
      normal: string;
      slow: string;
    };
  }
}

/**
 * Extends Mantine's DataTable component types
 * Adds strongly-typed props for table configuration
 * 
 * @template T - The type of data records displayed in the table
 */
declare module '@mantine/datatable' {
  export interface DataTableProps<T> {
    records: T[];
    columns: {
      accessor: keyof T | ((record: T) => string);
      title: string;
      render?: (record: T) => React.ReactNode;
    }[];
    totalRecords?: number;
    recordsPerPage?: number;
    page?: number;
    onPageChange?: (page: number) => void;
  }
}

/**
 * Theme function type helper
 * Used for creating theme-aware style functions
 * 
 * @param {MantineTheme} theme - The current Mantine theme object
 * @returns {Record<string, unknown>} Style object based on theme
 */
export type ThemeFunction = (theme: MantineTheme) => Record<string, unknown>;

/**
 * Helper type for theme-based CSS variables
 * Provides type safety for CSS variable definitions
 */
export type ThemeStyles = Record<string, CssVariable>;

/**
 * Type definition for button style properties
 * Defines CSS variables and hover states for buttons
 */
export type ButtonStyleProps = {
  '--mantine-color-primary': string;
  '--mantine-color-text': string;
  '&:hover': {
    '--mantine-color-primary': string;
  };
};
