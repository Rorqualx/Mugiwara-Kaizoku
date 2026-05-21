/**
 * Theme Defaults Constants
 *
 * Centralized theme configuration defaults used across the application.
 * This file provides a single source of truth for theme colors and configuration.
 *
 * @module constants/theme-defaults
 */

import { z } from 'zod';

/**
 * Schema for a single color theme (light or dark mode)
 */
export const ColorThemeSchema = z.object({
  primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
  secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
  background: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
  card: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
  text: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
  surface: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').default('#ffffff'),
  border: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
  error: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
  success: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
  warning: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color'),
});

/**
 * Schema for theme configuration with documentation
 */
export const ThemeConfigSchema = z.object({
  documentation: z.object({
    description: z.string(),
    usage: z.string(),
    format: z.string(),
  }).optional(),
  themes: z.object({
    light: ColorThemeSchema,
    dark: ColorThemeSchema,
  }),
});

/**
 * Type for a single color theme
 */
export type ColorTheme = z.infer<typeof ColorThemeSchema>;

/**
 * Type for the complete theme configuration
 */
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;

/**
 * Default light theme colors
 * Mugiwara (Straw Hat) themed colors
 */
export const DEFAULT_LIGHT_THEME: ColorTheme = {
  primary: '#d32f2f',
  secondary: '#ff9800',
  accent: '#1976d2',
  background: '#f8f9fa',
  card: '#ffffff',
  surface: '#ffffff',
  text: '#212529',
  border: '#dee2e6',
  error: '#c62828',
  success: '#388e3c',
  warning: '#f57c00',
};

/**
 * Default dark theme colors
 * Muted grey tones for dark mode
 */
export const DEFAULT_DARK_THEME: ColorTheme = {
  primary: '#868e96',
  secondary: '#555555',
  accent: '#6c757d',
  background: '#333333',
  card: '#3a3a3a',
  surface: '#4a4a4a',
  text: '#e9ecef',
  border: '#373a40',
  error: '#fa5252',
  success: '#51cf66',
  warning: '#ffd43b',
};

/**
 * Default theme configuration
 * Used as fallback when no custom theme is configured
 */
export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  documentation: {
    description: "Mugiwara (Straw Hat) themed colors for the application",
    usage: "Customize the application's visual appearance",
    format: 'Hex color codes',
  },
  themes: {
    light: DEFAULT_LIGHT_THEME,
    dark: DEFAULT_DARK_THEME,
  },
};

/**
 * Configuration key used for storing theme in the config system
 */
export const THEME_CONFIG_KEY = 'theme';

/**
 * Validates and parses theme configuration data
 *
 * @param data - Unknown data to validate
 * @returns Parsed ThemeConfig if valid, null otherwise
 */
export function parseThemeConfig(data: unknown): ThemeConfig | null {
  const result = ThemeConfigSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  return null;
}

/**
 * Validates a hex color string
 *
 * @param color - Color string to validate
 * @returns True if valid hex color
 */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}
