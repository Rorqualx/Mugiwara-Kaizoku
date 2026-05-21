/**
 * Mantine Theme Utilities
 * 
 * This module provides utility functions and patterns for working with Mantine themes.
 * It includes:
 * - Theme function type definitions
 * - Style creation helpers
 * - Common component style patterns
 * 
 * @module mantine-utils
 */
import type { MantineTheme } from '@mantine/core';

/**
 * Theme function type definition
 * Used for creating theme-aware style functions
 * 
 * @param {MantineTheme} theme - The current Mantine theme object
 * @returns {Record<string, unknown>} Style object based on theme
 */
export type ThemeFunction = (theme: MantineTheme) => Record<string, unknown>;

/**
 * Helper function to create theme-aware styles
 * Provides type safety and intellisense for theme functions
 * 
 * @param {ThemeFunction} fn - Theme function that generates styles
 * @returns {ThemeFunction} Type-safe theme function
 * 
 * @example
 * ```ts
 * const buttonStyles = createThemeStyles((theme) => ({
 *   backgroundColor: theme.colors?.blue[6],
 *   color: theme.white
 * }));
 * ```
 */
export const createThemeStyles = (fn: ThemeFunction): ThemeFunction => fn;

/**
 * Common button style pattern
 * Provides consistent button styling across the application
 * 
 * @param {MantineTheme} theme - The current Mantine theme object
 * @returns {Record<string, unknown>} Button style object
 * 
 * @example
 * ```tsx
 * <Button sx={commonButtonStyles}>Click Me</Button>
 * ```
 */
export const commonButtonStyles = (theme: MantineTheme): Record<string, unknown> => ({
  backgroundColor: theme.white,
  color: theme.black,
  '&:hover': {
    backgroundColor: theme.colors.gray[0],
  },
});
