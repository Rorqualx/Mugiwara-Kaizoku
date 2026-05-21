import { logger } from '@/utils/logger';

/**
 * Client Theme Service Module
 *
 * This module provides client-side theme management functionality for Kaizoku.
 * It handles theme configuration storage, retrieval, and updates using localStorage.
 * The service supports both light and dark themes with customizable color schemes.
 * 
 * @module clientThemeService
 */

/**
 * Theme color configuration interface
 * 
 * Defines the color palette for a theme variant (light/dark)
 * 
 * @property {string} primary - Main brand color
 * @property {string} secondary - Secondary brand color
 * @property {string} background - Page background color
 * @property {string} card - Card/container background color
 * @property {string} text - Primary text color
 * @property {string} border - Border color for elements
 * @property {string} accent - Accent color for highlights
 * @property {string} error - Color for error states/messages
 * @property {string} success - Color for success states/messages
 * @property {string} warning - Color for warning states/messages
 */
export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  card: string;
  text: string;
  border: string;
  accent: string;
  error: string;
  success: string;
  warning: string;
}

/**
 * Complete theme configuration interface
 * 
 * Defines the structure for the entire theme configuration,
 * including documentation and color schemes for both light and dark modes
 * 
 * @property {Object} documentation - Theme configuration documentation
 * @property {string} documentation["description"] - Brief description of the configuration
 * @property {string} documentation.usage - Instructions for using the configuration
 * @property {string} documentation.format - Color format specification
 * @property {Object} themes - Theme variant configurations
 * @property {ThemeColors} themes.light - Light theme color scheme
 * @property {ThemeColors} themes.dark - Dark theme color scheme
 */
export interface ThemeConfig {
  documentation: {
    description: string;
    usage: string;
    format: string;
  };
  themes: {
    light: ThemeColors;
    dark: ThemeColors;
  };
}

/**
 * Default theme configuration
 * 
 * Provides a baseline theme configuration with Mugiwara (Straw Hat) themed colors
 * for both light and dark modes. These colors are chosen to ensure:
 * - Proper contrast ratios for accessibility
 * - Consistent visual hierarchy
 * - Brand identity aligned with One Piece/manga theme
 */
const DEFAULT_CONFIG: ThemeConfig = {
  documentation: {
    description: "This file contains custom theme configurations for Mugiwara-Kaizoku",
    usage: "Edit the color values below to customize the application's appearance",
    format: "Use standard hex color codes (#RRGGBB)"
  },
  themes: {
    light: {
      primary: "#d32f2f", // Red - Luffy's signature color
      secondary: "#ff9800", // Orange/Gold - Straw hat color
      accent: "#1976d2", // Blue - Ocean/adventure theme
      background: "#f8f9fa", // Light Gray
      card: "#ffffff", // White
      text: "#212529", // Dark Gray
      border: "#dee2e6", // Light Border
      error: "#c62828", // Darker red for errors
      success: "#388e3c", // Green for success
      warning: "#f57c00" // Orange for warnings
    },
    dark: {
      primary: "#e53935", // Brighter red for dark mode
      secondary: "#ffa726", // Brighter orange/gold for dark mode
      accent: "#2196f3", // Brighter blue for dark mode
      background: "#1a1b1e", // Dark Gray
      card: "#25262b", // Slightly Lighter Dark Gray
      text: "#e9ecef", // Light Gray
      border: "#373a40", // Medium Gray
      error: "#d32f2f", // Red for errors
      success: "#4caf50", // Green for success
      warning: "#ff9800" // Orange for warnings
    }
  }
};
// Storage key for theme configuration
const STORAGE_KEY = 'kaizoku-theme-config';

/**
 * Type guard to check if parsed JSON is a valid ThemeConfig
 */
function isThemeConfig(value: unknown): value is ThemeConfig {
  if (typeof value !== 'object' || value === null) return false;
  const config = value as Record<string, unknown>;

  // Check themes property exists and is an object
  if (typeof config['themes'] !== 'object' || config['themes'] === null) return false;
  const themes = config['themes'] as Record<string, unknown>;

  // Check light and dark themes exist
  if (typeof themes['light'] !== 'object' || themes['light'] === null) return false;
  if (typeof themes['dark'] !== 'object' || themes['dark'] === null) return false;

  return true;
}

/**
 * Client-side theme service class
 * 
 * Manages theme configuration persistence and updates in the browser.
 * Uses localStorage for configuration storage and provides methods
 * for loading, saving, and modifying theme settings.
 * 
 * @example
 * // Update primary color for light theme
 * clientThemeService.updateThemeColors('light', {
 *   primary: '#ff0000'
 * });
 * 
 * // Load current configuration
 * const config = clientThemeService.loadConfig();
 */
class ClientThemeService {
  /**
   * Check if localStorage is available
   * 
   * Tests if localStorage can be accessed and used.
   * Helps prevent errors in environments where localStorage is disabled or unavailable.
   * 
   * @returns {boolean} True if localStorage is available, false otherwise
   */
  private isLocalStorageAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      // Try to set and get a test item
      const testKey = '__test_storage__';
      localStorage.setItem(testKey, 'test');
      const testValue = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      // Check if the test was successful
      return testValue === 'test';
    } catch (error: unknown) {
      logger.error('localStorage is not available:', error);
      return false;
    }
  }

  /**
   * Load the theme configuration from localStorage
   * 
   * Retrieves saved theme configuration or returns defaults if:
   * - No configuration is saved
   * - Saved configuration is invalid
   * - Running in non-browser environment
   * - localStorage is unavailable
   * 
   * @returns {ThemeConfig} The current theme configuration
   */
  loadConfig(): ThemeConfig {
    if (!this.isLocalStorageAvailable()) {
      logger.warn('Loading default theme config because localStorage is unavailable');
      return DEFAULT_CONFIG;
    }

    try {
      const savedConfig = localStorage.getItem(STORAGE_KEY);
      logger.info('Loaded saved config from localStorage:', savedConfig);
      if (!savedConfig) {
        logger.info('No saved theme config found, using defaults');
        return DEFAULT_CONFIG;
      }

      const parsedConfig: unknown = JSON.parse(savedConfig);

      // Validate the parsed config has required structure
      if (!isThemeConfig(parsedConfig)) {
        logger.warn('Saved theme config is invalid, using defaults');
        return DEFAULT_CONFIG;
      }

      // Ensure all required color properties exist
      const requiredColors: (keyof ThemeColors)[] = [
      'primary', 'secondary', 'background', 'card', 'text',
      'border', 'accent', 'error', 'success', 'warning'];

      // Check if any colors are missing in light theme
      const missingLightColors = requiredColors.filter(
        (color) => !parsedConfig.themes.light[color]
      );
      // Check if any colors are missing in dark theme
      const missingDarkColors = requiredColors.filter(
        (color) => !parsedConfig.themes.dark[color]
      );
      // If any colors are missing, use defaults
      if (missingLightColors.length > 0 || missingDarkColors.length > 0) {
        logger.warn('Saved theme config is missing some colors, using defaults');
        return DEFAULT_CONFIG;
      }

      logger.info('Successfully loaded theme config from localStorage');
      return parsedConfig;
    } catch (error: unknown) {
      logger.error('Failed to load theme configuration:', error);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Save the theme configuration to localStorage
   * 
   * Persists the current theme configuration to browser storage.
   * No-op if running in non-browser environment or localStorage is unavailable.
   * 
   * @param {ThemeConfig} config - The configuration to save
   * @returns {boolean} True if save was successful, false otherwise
   */
  saveConfig(config: ThemeConfig): boolean {
    if (!this.isLocalStorageAvailable()) {
      logger.warn('Cannot save theme config because localStorage is unavailable');
      return false;
    }

    try {
      const configString = JSON.stringify(config);
      localStorage.setItem(STORAGE_KEY, configString);
      logger.info('Theme configuration saved successfully');
      // Verify save was successful
      const savedConfig = localStorage.getItem(STORAGE_KEY);
      if (savedConfig !== configString) {
        logger.error('Save verification failed: stored value does not match input');
        return false;
      }

      return true;
    } catch (error: unknown) {
      logger.error('Failed to save theme configuration:', error);
      return false;
    }
  }

  /**
   * Update colors for a specific theme variant
   * 
   * Allows partial updates to either light or dark theme colors.
   * Preserves existing colors not included in the update.
   * 
   * @param {'light' | 'dark'} theme - Which theme variant to update
   * @param {Partial<ThemeColors>} colors - Color values to update
   * @returns {ThemeConfig} Updated theme configuration
   * 
   * @example
   * // Update just the primary and accent colors
   * service.updateThemeColors('dark', {
   *   primary: '#0000ff',
   *   accent: '#ff00ff'
   * });
   */
  updateThemeColors(
  theme: 'light' | 'dark',
  colors: Partial<ThemeColors>)
  : ThemeConfig {
    const config = this.loadConfig();
    // Create a new object with updated colors
    config.themes[theme] = {
      ...config.themes[theme],
      ...colors
    };
    // Save and apply the updated configuration
    const saveSuccess = this.saveConfig(config);
    logger.info(`Theme colors updated for ${theme} theme, save ${saveSuccess ? 'successful' : 'failed'}`);
    // Apply the updated colors immediately
    this.applyThemeColors(config.themes[theme]);
    return config;
  }

  /**
   * Reset theme configuration to defaults
   * 
   * Restores all theme settings to their default values.
   * Useful for recovering from misconfiguration or starting fresh.
   * 
   * @returns {ThemeConfig} The default theme configuration
   */
  resetToDefaults(): ThemeConfig {
    logger.info('Resetting theme configuration to defaults');
    this.saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  /**
   * Apply theme colors to CSS custom properties
   * 
   * Immediately updates CSS variables with the specified colors.
   * This is useful for previewing theme changes before saving.
   * 
   * @param {ThemeColors} colors - Theme colors to apply
   * @returns {boolean} True if colors were applied successfully, false otherwise
   */
  applyThemeColors(colors: ThemeColors): boolean {
    if (typeof document === 'undefined') return false;
    try {
      document.documentElement.style.setProperty('--theme-primary', colors.primary);
      document.documentElement.style.setProperty('--theme-secondary', colors.secondary);
      document.documentElement.style.setProperty('--theme-background', colors.background);
      document.documentElement.style.setProperty('--theme-card', colors.card);
      document.documentElement.style.setProperty('--theme-text', colors.text);
      document.documentElement.style.setProperty('--theme-border', colors.border);
      document.documentElement.style.setProperty('--theme-accent', colors.accent);
      document.documentElement.style.setProperty('--theme-error', colors.error);
      document.documentElement.style.setProperty('--theme-success', colors.success);
      document.documentElement.style.setProperty('--theme-warning', colors.warning);
      logger.info('Theme colors applied successfully to CSS variables');
      return true;
    } catch (error: unknown) {
      logger.error('Error applying theme colors:', error);
      return false;
    }
  }
}

// Export a singleton instance
export const clientThemeService = new ClientThemeService();