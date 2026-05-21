/**
 * Theme Initializer Script
 *
 * This script ensures that theme settings are applied immediately on page load,
 * before React hydration occurs. This prevents flashes of unstyled content
 * and ensures a smooth user experience.
 *
 * It runs as early as possible in the page lifecycle to:
 * 1. Determine user's color scheme preference
 * 2. Load stored theme configuration
 * 3. Apply appropriate theme colors to CSS variables
 */

import { logger } from '@/utils/logger';

// Storage key for color scheme preference
const COLOR_SCHEME_KEY = 'mantine-color-scheme';

// Storage key for theme configuration
const THEME_CONFIG_KEY = 'kaizoku-theme-config';

// Theme colors structure
interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  card: string;
  text: string;
  border: string;
  error: string;
  success: string;
  warning: string;
}

// Theme configuration structure
interface ThemeConfig {
  themes: {
    light: ThemeColors;
    dark: ThemeColors;
  };
}

// Type guard to validate theme config structure
function isValidThemeConfig(value: unknown): value is ThemeConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const config = value as Record<string, unknown>;

  if (typeof config['themes'] !== 'object' || config['themes'] === null) {
    return false;
  }

  const themes = config['themes'] as Record<string, unknown>;

  return (
    typeof themes['light'] === 'object' &&
    themes['light'] !== null &&
    typeof themes['dark'] === 'object' &&
    themes['dark'] !== null
  );
}

// Default theme colors for light and dark modes - Mugiwara themed
const DEFAULT_COLORS: { light: ThemeColors; dark: ThemeColors } = {
  light: {
    primary: '#d32f2f', // Red - Luffy's signature color
    secondary: '#ff9800', // Orange/Gold - Straw hat color
    accent: '#1976d2', // Blue - Ocean/adventure theme
    background: '#f8f9fa',
    card: '#ffffff',
    text: '#212529',
    border: '#dee2e6',
    error: '#c62828', // Darker red for errors
    success: '#388e3c', // Green for success
    warning: '#f57c00' // Orange for warnings
  },
  dark: {
    primary: '#e53935', // Brighter red for dark mode
    secondary: '#ffa726', // Brighter orange/gold for dark mode
    accent: '#2196f3', // Brighter blue for dark mode
    background: '#1a1b1e',
    card: '#25262b',
    text: '#e9ecef',
    border: '#373a40',
    error: '#d32f2f', // Red for errors
    success: '#4caf50', // Green for success
    warning: '#ff9800' // Orange for warnings
  }
};

/**
 * Immediately invoke this function to apply theme as early as possible
 */
(function initializeTheme() {
  try {
    // Run this only in browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    logger.info('Theme initializer running...');

    // Determine the effective color scheme
    let colorScheme = 'light';
    try {
      // Get stored preference
      const storedScheme = localStorage.getItem(COLOR_SCHEME_KEY);
      if (storedScheme && ['light', 'dark', 'system'].includes(storedScheme)) {
        if (storedScheme === 'system') {
          // Check system preference
          const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          colorScheme = systemPrefersDark ? 'dark' : 'light';
        } else {
          colorScheme = storedScheme;
        }
      }
    } catch (error: unknown) {
      logger.warn('Error reading color scheme from localStorage:', error);
    }

    // Initialize default colors based on color scheme
    let themeColors: ThemeColors = DEFAULT_COLORS[colorScheme as 'light' | 'dark'];

    // Try to load custom theme configuration
    try {
      const storedConfig = localStorage.getItem(THEME_CONFIG_KEY);
      if (storedConfig) {
        const parsedConfig: unknown = JSON.parse(storedConfig);

        // Check if config has required structure using type guard
        if (isValidThemeConfig(parsedConfig)) {
          // Use custom colors for the current color scheme
          themeColors = parsedConfig.themes[colorScheme as 'light' | 'dark'];
        }
      }
    } catch (error: unknown) {
      logger.warn('Error loading theme config from localStorage:', error);
    }

    // Add a theme-initializing class to help prevent FOUC
    document.documentElement.classList.add('theme-initializing');

    // Apply theme colors to CSS variables
    document.documentElement.style.setProperty('--theme-primary', themeColors.primary);
    document.documentElement.style.setProperty('--theme-secondary', themeColors.secondary);
    document.documentElement.style.setProperty('--theme-background', themeColors.background);
    document.documentElement.style.setProperty('--theme-card', themeColors.card);
    document.documentElement.style.setProperty('--theme-text', themeColors.text);
    document.documentElement.style.setProperty('--theme-border', themeColors.border);
    document.documentElement.style.setProperty('--theme-accent', themeColors.accent);
    document.documentElement.style.setProperty('--theme-error', themeColors.error);
    document.documentElement.style.setProperty('--theme-success', themeColors.success);
    document.documentElement.style.setProperty('--theme-warning', themeColors.warning);

    // Set the data-mantine-color-scheme attribute for Mantine components
    document.documentElement.setAttribute('data-mantine-color-scheme', colorScheme);

    // Remove the initializing class after a short delay
    setTimeout(() => {
      document.documentElement.classList.remove('theme-initializing');
    }, 100);

    logger.info('Theme initialized with scheme:', colorScheme);
  } catch (error: unknown) {
    console.error('Error initializing theme:', error);
  }
})();

// Export an empty object to make this a valid module
export {};