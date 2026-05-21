import { useState, useEffect } from 'react';

import { useColorScheme } from '@mantine/hooks';

import { useUIStore } from '../store/uiSlice';

/**
 * Types for theme settings
 */
export type ColorScheme = 'light' | 'dark' | 'system';
export type EffectiveColorScheme = 'light' | 'dark';
export type FontSize = 'sm' | 'md' | 'lg';
export type Spacing = 'compact' | 'normal' | 'relaxed';

/**
 * Return type for the useTheme hook
 */
export interface UseThemeResult {
  rawColorScheme?: ColorScheme;
  colorScheme: EffectiveColorScheme;
  isDark: boolean;
  isLight: boolean;
  isSystem: boolean;
  fontSize: FontSize;
  spacing: Spacing;
}

/**
 * Hook for managing theme settings and color scheme preferences
 * 
 * This hook provides access to the application's theme settings, including
 * color scheme (light/dark/system), font size, and spacing. It handles SSR
 * and hydration appropriately, and resolves the 'system' color scheme
 * preference to the actual light/dark value based on system settings.
 * 
 * @returns {UseThemeResult} Theme settings and derived values
 */
export function useTheme(): UseThemeResult {
  // Default values for SSR
  const [mounted, setMounted] = useState(false);

  // Get theme from store
  const theme = useUIStore((state) => state.theme);

  // Get system color scheme
  const systemColorScheme = useColorScheme();

  // Set mounted state after hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR or before hydration, use light theme as default
  if (!mounted) {
    return {
      colorScheme: 'light' as EffectiveColorScheme,
      isDark: false,
      isLight: true,
      isSystem: false,
      fontSize: 'md' as FontSize,
      spacing: 'normal' as Spacing
    };
  }

  // Determine the effective color scheme
  let effectiveColorScheme: EffectiveColorScheme = 'light';
  let isSystem = false;

  if (theme.colorScheme === 'system') {
    effectiveColorScheme = systemColorScheme as EffectiveColorScheme;
    isSystem = true;
  } else {
    effectiveColorScheme = theme.colorScheme === 'dark' ? 'dark' : 'light';
  }

  // Cast fontSize and spacing to the correct types
  const fontSize: FontSize = theme.fontSize as FontSize;
  const spacing: Spacing = theme.spacing as Spacing;
  const rawColorScheme = theme.colorScheme as ColorScheme | undefined;

  return {
    // The raw value from the store
    ...(rawColorScheme !== undefined ? { rawColorScheme } : {}),
    // The effective color scheme (resolving 'system' to actual light/dark)
    colorScheme: effectiveColorScheme,
    isDark: effectiveColorScheme === 'dark',
    isLight: effectiveColorScheme === 'light',
    isSystem,
    fontSize,
    spacing
  };
}