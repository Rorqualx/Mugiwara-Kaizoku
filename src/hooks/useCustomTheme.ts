import { useEffect, useState } from 'react';

import type { ColorTheme } from '@/constants/theme-defaults';
import { logger } from '@/utils/logger';

import { useColorSchemeContext } from '../styles/ColorSchemeProvider';

/**
 * Return type for useCustomTheme hook
 */
interface UseCustomThemeReturn {
  isCustomTheme: boolean;
  customColors: ColorTheme | null;
  applyThemeColors: (colors: ColorTheme) => void;
}

/**
 * Hook for managing and applying custom theme colors
 * 
 * This hook handles the application of custom theme colors to CSS variables,
 * providing dynamic theming capabilities. It automatically manages the lifecycle
 * of theme colors, including cleanup when a custom theme is disabled.
 * 
 * @returns {Object} Theme management functions and state
 * @returns {boolean} .isCustomTheme - Whether a custom theme is active
 * @returns {ColorTheme | null} .customColors - Current custom theme colors
 * @returns {Function} .applyThemeColors - Function to apply theme colors
 * 
 * @example
 * ```tsx
 * const { isCustomTheme, customColors } = useCustomTheme();
 * 
 * return (
 *   <div className={isCustomTheme ? 'custom-theme' : 'default-theme'}>
 *     {customColors && (
 *       <div style={{ color: customColors.primary }}>
 *         Custom themed content
 *       </div>
 *     )}
 *   </div>
 * );
 * ```
 */
export function useCustomTheme(): UseCustomThemeReturn {
  const { customColors, isCustomTheme, colorScheme } = useColorSchemeContext();
  const [mounted, setMounted] = useState(false);

  // Set mounted state after component is mounted
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Apply custom theme colors to CSS variables after component is mounted
  useEffect(() => {
    // Only apply theme after component is mounted to prevent hydration issues
    if (!mounted) return;

    logger.info('Applying theme colors', { isCustomTheme, customColors });

    if (!isCustomTheme || !customColors) {
      // Reset custom theme variables if no custom theme is active
      document.documentElement.style.setProperty('--theme-primary', '');
      document.documentElement.style.setProperty('--theme-secondary', '');
      document.documentElement.style.setProperty('--theme-background', '');
      document.documentElement.style.setProperty('--theme-card', '');
      document.documentElement.style.setProperty('--theme-surface', '');
      document.documentElement.style.setProperty('--theme-text', '');
      document.documentElement.style.setProperty('--theme-border', '');
      document.documentElement.style.setProperty('--theme-accent', '');
      document.documentElement.style.setProperty('--theme-error', '');
      document.documentElement.style.setProperty('--theme-success', '');
      document.documentElement.style.setProperty('--theme-warning', '');
      logger.info('Theme variables reset');
      return;
    }

    // Apply custom theme colors to CSS variables
    applyThemeColors(customColors);
    logger.info('Theme colors applied successfully');
  }, [customColors, isCustomTheme, colorScheme, mounted]);

  return {
    isCustomTheme,
    customColors,
    applyThemeColors
  };
}

/**
 * Apply theme colors to CSS custom properties (variables)
 * 
 * This function sets CSS custom properties on the document root element,
 * allowing theme colors to be used throughout the application via var() function.
 * 
 * @param {ColorTheme} colors - Theme colors to apply
 * @property {string} colors.primary - Primary theme color
 * @property {string} colors.secondary - Secondary theme color
 * @property {string} colors.background - Background color
 * @property {string} colors.card - Card/surface color
 * @property {string} colors.text - Text color
 * @property {string} colors.border - Border color
 * @property {string} colors.accent - Accent color
 * @property {string} colors.error - Error state color
 * @property {string} colors.success - Success state color
 * @property {string} colors.warning - Warning state color
 * 
 * @example
 * ```tsx
 * applyThemeColors({
 *   primary: '#007bff',
 *   secondary: '#6c757d',
 *   background: '#ffffff',
 *   card: '#f8f9fa',
 *   text: '#212529',
 *   border: '#dee2e6',
 *   accent: '#17a2b8',
 *   error: '#dc3545',
 *   success: '#28a745',
 *   warning: '#ffc107'
 * });
 * ```
 */
export function applyThemeColors(colors: ColorTheme): void {
  try {
    document.documentElement.style.setProperty('--theme-primary', colors.primary);
    document.documentElement.style.setProperty('--theme-secondary', colors.secondary);
    document.documentElement.style.setProperty('--theme-background', colors.background);
    document.documentElement.style.setProperty('--theme-card', colors.card);
    document.documentElement.style.setProperty('--theme-surface', colors.surface);
    document.documentElement.style.setProperty('--theme-text', colors.text);
    document.documentElement.style.setProperty('--theme-border', colors.border);
    document.documentElement.style.setProperty('--theme-accent', colors.accent);
    document.documentElement.style.setProperty('--theme-error', colors.error);
    document.documentElement.style.setProperty('--theme-success', colors.success);
    document.documentElement.style.setProperty('--theme-warning', colors.warning);
  } catch (error: unknown) {
    logger.error('Error applying theme colors', { error });
  }
}