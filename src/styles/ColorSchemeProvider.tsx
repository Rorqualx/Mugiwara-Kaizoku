/**
 * ColorSchemeProvider Component
 * 
 * A React component that manages the application's color scheme (light/dark/system) and theme customization.
 * Integrates with Mantine UI library and provides theme persistence across sessions.
 * 
 * Features:
 * - System color scheme detection
 * - Theme persistence in localStorage
 * - Custom color scheme support
 * - Dynamic theme switching
 * - SSR compatibility with hydration handling
 * 
 * @module ColorSchemeProvider
 */

"use client";
import React from "react";
import { createContext, useContext, useCallback, useState, useEffect, useMemo } from 'react';


import { MantineProvider, type MantineThemeOverride, type CSSVariablesResolver } from '@mantine/core';
import { useColorScheme } from '@mantine/hooks';
import { useSession } from 'next-auth/react';
import { z } from 'zod';

import {
  DEFAULT_THEME_CONFIG,
  THEME_CONFIG_KEY,
  parseThemeConfig,
} from '@/constants/theme-defaults';
import type { ColorTheme, ThemeConfig as ThemeColorsConfig } from '@/constants/theme-defaults';
import { logger } from '@/utils/logger';
import { generateMantineShades } from '@/utils/theme/colorShades';
import { trpc } from '@/utils/trpc-client/index';

import { useUIStore } from '../store/uiSlice';
import { createSuccessResult, createLoadingResult, isSuccess, isLoading } from '../utils/async-result';

import { theme as baseTheme } from './themes';

import type {
  AsyncResult} from '../utils/async-result';

// Mirrors the DB-backed ThemeConfig into localStorage so the inline theme-init
// script in _document.tsx can apply --theme-* vars on <html> before first paint.
// Read in public/theme-init.js.
const THEME_CACHE_KEY = 'kaizoku-theme-cache';

function buildMantineTheme(colors: ColorTheme | null, isMounted: boolean): MantineThemeOverride {
  const override: MantineThemeOverride = { ...baseTheme };
  if (!colors || !isMounted) return override;

  override.colors = {
    ...baseTheme.colors,
    brand: generateMantineShades(colors.primary),
    secondary: generateMantineShades(colors.secondary),
    accent: generateMantineShades(colors.accent),
    success: generateMantineShades(colors.success),
    error: generateMantineShades(colors.error),
    warning: generateMantineShades(colors.warning),
  };
  override.primaryColor = 'brand';
  override.components = {
    ...baseTheme.components,
    Paper: {
      styles: { root: { backgroundColor: colors.card, borderColor: colors.border } },
    },
    Notification: {
      styles: { root: { backgroundColor: colors.card, borderColor: colors.border } },
    },
    Menu: {
      styles: {
        dropdown: { backgroundColor: colors.card, borderColor: colors.border },
        item: { color: colors.text },
        itemLabel: { color: colors.text },
        label: { color: colors.text, opacity: 0.65 },
        divider: { borderColor: colors.border },
      },
    },
    SegmentedControl: {
      styles: {
        root: { backgroundColor: colors.secondary },
        label: { color: colors.text },
        indicator: { backgroundColor: colors.surface },
      },
    },
    Chip: {
      styles: {
        label: { color: colors.text, borderColor: colors.border },
      },
    },
    Input: {
      styles: { input: { backgroundColor: colors.surface, borderColor: colors.border } },
    },
    NavLink: {
      defaultProps: { color: 'brand' },
    },
    Tabs: {
      defaultProps: { color: 'accent' },
    },
    Anchor: {
      defaultProps: { color: 'accent' },
    },
    Badge: {
      defaultProps: { color: 'accent' },
    },
  };
  return override;
}


/**
 * Context type definition for color scheme management
 * 
 * @interface ColorSchemeContextType
 * @property {() => void} toggleColorScheme - Function to toggle between light and dark modes
 * @property {(scheme: 'light' | 'dark' | 'system') => void} setColorScheme - Function to set a specific color scheme
 * @property {ColorTheme | null} customColors - Custom theme colors if available
 * @property {boolean} isCustomTheme - Flag indicating if a custom theme is active
 * @property {'light' | 'dark' | 'system'} colorScheme - Current color scheme setting
 */
interface ColorSchemeContextType {
  toggleColorScheme: () => void;
  setColorScheme: (scheme: 'light' | 'dark' | 'system') => void;
  customColors: ColorTheme | null;
  isCustomTheme: boolean;
  colorScheme: 'light' | 'dark' | 'system';
  themeColorsConfig: ThemeColorsConfig;
  isThemeConfigLoaded: boolean;
  setThemeColorsConfig: (config: ThemeColorsConfig) => void;
}

const ColorSchemeContext = createContext<ColorSchemeContextType | null>(null);

// Zod schema for validating color scheme from localStorage
const ColorSchemeSchema = z.enum(['light', 'dark', 'system']);

/**
 * Custom hook to access the color scheme context
 * 
 * @throws {Error} If used outside of ColorSchemeProvider
 * @returns {ColorSchemeContextType} The color scheme context value
 * @example
 * ```tsx
 * const { toggleColorScheme, colorScheme } = useColorSchemeContext();
 * 
 * return (
 *   <Button onClick={toggleColorScheme}>
 *     Toggle {colorScheme === 'dark' ? 'Light' : 'Dark'} Mode
 *   </Button>
 * );
 * ```
 */
export function useColorSchemeContext(): ColorSchemeContextType {
  const context = useContext(ColorSchemeContext);
  if (!context) {
    throw new Error('useColorSchemeContext must be used within a ColorSchemeProvider');
  }
  return context;
}

/**
 * Props for the ColorSchemeProvider component
 * 
 * @interface ColorSchemeProviderProps
 * @property {React.ReactNode} children - Child components to be wrapped by the provider
 */
interface ColorSchemeProviderProps {
  children: React.ReactNode;
}


/**
 * Provider component for managing application color scheme and theme
 * 
 * Handles:
 * - Color scheme persistence
 * - System preference detection
 * - Theme customization
 * - SSR compatibility
 * - Mantine theme integration
 * 
 * @param {ColorSchemeProviderProps} props - Component props
 * @returns {JSX.Element} Provider component with Mantine theme configuration
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <ColorSchemeProvider>
 *       <YourApp />
 *     </ColorSchemeProvider>
 *   );
 * }
 * ```
 */
export function ColorSchemeProvider({ children }: ColorSchemeProviderProps): React.ReactElement {
  const systemColorScheme = useColorScheme();
  const [mounted, setMounted] = useState(false);

  // Use the UI store for theme state
  const uiTheme = useUIStore((state) => state.theme);
  const updateTheme = useUIStore((state) => state.updateTheme);

  // Get the color scheme from the UI store
  const colorScheme = uiTheme.colorScheme;

  // Fetch theme colors from the config system
  const getConfigMutation = trpc.config.get.useMutation();
  const [themeColorsConfigResult, setThemeColorsConfigResult] = useState<AsyncResult<ThemeColorsConfig, Error>>(
    createSuccessResult<ThemeColorsConfig, Error>(DEFAULT_THEME_CONFIG)
  );
  const [isThemeConfigLoaded, setIsThemeConfigLoaded] = useState(false);

  const themeColorsConfig = isSuccess(themeColorsConfigResult)
    ? themeColorsConfigResult.data
    : DEFAULT_THEME_CONFIG;

  const setThemeColorsConfig = useCallback((config: ThemeColorsConfig) => {
    setThemeColorsConfigResult(createSuccessResult<ThemeColorsConfig, Error>(config));
  }, []);

  // config.get is a protectedProcedure — loading pre-auth just 401s on the
  // login page. Defaults + the localStorage cache (applied by the inline
  // script in _document.tsx) cover rendering until the session resolves.
  const { status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === 'authenticated';

  // Load theme colors from database once authenticated
  useEffect(() => {
    if (typeof window === 'undefined' || !isAuthenticated) return;

    const loadThemeColors = async (): Promise<void> => {
      setThemeColorsConfigResult(createLoadingResult<ThemeColorsConfig, Error>());
      try {
        // config.get now returns the bare config value over the wire.
        const value: unknown = await getConfigMutation.mutateAsync({
          key: THEME_CONFIG_KEY,
          defaultValue: DEFAULT_THEME_CONFIG
        });

        if (value !== undefined && value !== null) {
          const validatedConfig = parseThemeConfig(value);
          if (validatedConfig) {
            setThemeColorsConfigResult(createSuccessResult<ThemeColorsConfig, Error>(validatedConfig));
            logger.info('Loaded theme colors from database');
          } else {
            logger.warn('Invalid theme config from database, using defaults');
            setThemeColorsConfigResult(createSuccessResult<ThemeColorsConfig, Error>(DEFAULT_THEME_CONFIG));
          }
        } else {
          setThemeColorsConfigResult(createSuccessResult<ThemeColorsConfig, Error>(DEFAULT_THEME_CONFIG));
        }
      } catch (error: unknown) {
        logger.error('Failed to load theme colors:', error);
        setThemeColorsConfigResult(createSuccessResult<ThemeColorsConfig, Error>(DEFAULT_THEME_CONFIG));
      } finally {
        setIsThemeConfigLoaded(true);
      }
    };

    void loadThemeColors();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mutation ref changes every render; run once per auth transition
  }, [isAuthenticated]);

  // Set the color scheme in both the UI store and localStorage
  const setColorScheme = useCallback((scheme: 'light' | 'dark' | 'system') => {
    logger.info('Setting color scheme:', scheme);
    updateTheme({ colorScheme: scheme });
    // Also save to localStorage for persistence across sessions
    try {
      localStorage.setItem('mantine-color-scheme', scheme);
      logger.info('Saved color scheme to localStorage');
    } catch (error: unknown) {
      console.error('Failed to save color scheme to localStorage:', error);
    }
  }, [updateTheme]);

  // Toggle between light and dark, preserving system preference
  const toggleColorScheme = useCallback(() => {
    logger.info('Toggling color scheme', { current: colorScheme, system: systemColorScheme });
    if (colorScheme === 'system') {
      setColorScheme(systemColorScheme === 'dark' ? 'light' : 'dark');
    } else {
      setColorScheme(colorScheme === 'dark' ? 'light' : 'dark');
    }
  }, [colorScheme, setColorScheme, systemColorScheme]);

  // Initialize from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setMounted(true);
    try {
      const savedScheme = localStorage.getItem('mantine-color-scheme');
      logger.info('Retrieved saved color scheme:', savedScheme);

      if (savedScheme) {
        const result = ColorSchemeSchema.safeParse(savedScheme);
        if (result.success) {
          updateTheme({ colorScheme: result.data });
        } else {
          logger.warn('Invalid color scheme in localStorage, ignoring:', savedScheme);
          localStorage.removeItem('mantine-color-scheme');
        }
      }
    } catch (error: unknown) {
      console.error('Error reading from localStorage:', error);
    }
  }, [updateTheme]);

  // Get custom colors for the current theme
  const customColors = useMemo((): ColorTheme | null => {
    if (!isSuccess(themeColorsConfigResult) || isLoading(themeColorsConfigResult)) return null;

    const effectiveScheme = colorScheme === 'system' ?
      systemColorScheme :
      colorScheme;

    const themeData = themeColorsConfigResult.data;
    const colors = themeData.themes[effectiveScheme as keyof typeof themeData.themes];
    return colors;
  }, [themeColorsConfigResult, colorScheme, systemColorScheme]);

  // Determine if we're using a custom theme
  const isCustomTheme = isSuccess(themeColorsConfigResult) && customColors !== null;

  // Mirror the active ThemeConfig to localStorage so the inline theme-init
  // script in _document.tsx can apply --theme-* vars on <html> before first
  // paint. Covers both initial DB load and edits from Settings → Appearance:
  // ThemeEditor.save / .reset both flow through setThemeColorsConfig, which
  // updates themeColorsConfig and re-runs this effect.
  useEffect(() => {
    if (!mounted || !isThemeConfigLoaded) return;
    try {
      localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(themeColorsConfig));
    } catch (error: unknown) {
      logger.warn('Failed to cache theme colors to localStorage', { error });
    }
  }, [mounted, isThemeConfigLoaded, themeColorsConfig]);

  // Update CSS variables when the theme changes.
  // themeOverrides.css consumes these as `--theme-*`; writing them here
  // is what powers real-time preview when ThemeEditor mutates the config
  // via setThemeColorsConfig.
  useEffect(() => {
    if (!mounted || !customColors) return;

    requestAnimationFrame(() => {
      const style = document.documentElement.style;
      style.setProperty('--theme-primary', customColors.primary);
      style.setProperty('--theme-secondary', customColors.secondary);
      style.setProperty('--theme-accent', customColors.accent);
      style.setProperty('--theme-background', customColors.background);
      style.setProperty('--theme-card', customColors.card);
      style.setProperty('--theme-text', customColors.text);
      style.setProperty('--theme-border', customColors.border);
      style.setProperty('--theme-error', customColors.error);
      style.setProperty('--theme-success', customColors.success);
      style.setProperty('--theme-surface', customColors.surface);
      style.setProperty('--theme-warning', customColors.warning);
      // Only set --theme-* vars here (consumed by themeOverrides.css).
      // Mantine-internal vars (--mantine-color-*) are handled by cssVariablesResolver.
    });
  }, [mounted, customColors]);

  // Create the context value
  const contextValue = useMemo<ColorSchemeContextType>(() => ({
    toggleColorScheme,
    setColorScheme,
    customColors,
    isCustomTheme,
    colorScheme,
    themeColorsConfig,
    isThemeConfigLoaded,
    setThemeColorsConfig,
  }), [
    toggleColorScheme,
    setColorScheme,
    customColors,
    isCustomTheme,
    colorScheme,
    themeColorsConfig,
    isThemeConfigLoaded,
    setThemeColorsConfig,
  ]);

  // Determine the effective color scheme
  const effectiveColorScheme = colorScheme === 'system' ? systemColorScheme : colorScheme;

  const mantineThemeOverride = useMemo<MantineThemeOverride>(
    () => buildMantineTheme(customColors, mounted),
    [customColors, mounted],
  );

  const cssVariablesResolver = useMemo<CSSVariablesResolver>(() => {
    if (!customColors || !mounted) {
      return () => ({ variables: {}, light: {}, dark: {} });
    }
    const c = customColors;
    // The ColorThemeSchema defaults surface to '#ffffff' when absent.
    // Treat that legacy value as missing so dark-mode hover backgrounds
    // (which read --mantine-color-dark-4) don't render as pure white on
    // configs persisted before the surface field was widely populated.
    const surfaceColor =
      c.surface.toLowerCase() !== '#ffffff' ? c.surface : c.card;
    // `--mantine-color-dimmed` drives `<Text c="dimmed">` (authors under
    // titles, "Latest: Ch. N", etc). Mapping it to c.border (the previous
    // light-section value) made dimmed text effectively invisible — borders
    // are intentionally low-contrast, so dimmed text on a dark --theme-card
    // vanished. Use a self-balancing color-mix instead: 55% text + 45% card
    // is readable on any --theme-card luminance and follows custom-theme
    // color shifts without crossing into the wrong scheme.
    const dimmedColor = `color-mix(in srgb, ${c.text}, ${c.card} 45%)`;
    return () => ({
      variables: {},
      light: {
        '--mantine-color-text': c.text,
        '--mantine-color-body': c.background,
        '--mantine-color-default': surfaceColor,
        '--mantine-color-default-hover': surfaceColor,
        '--mantine-color-default-border': c.border,
        '--mantine-color-dimmed': dimmedColor,
      },
      dark: {
        '--mantine-color-text': c.text,
        '--mantine-color-body': c.background,
        '--mantine-color-default': surfaceColor,
        '--mantine-color-default-hover': surfaceColor,
        '--mantine-color-default-border': surfaceColor,
        '--mantine-color-dimmed': dimmedColor,
        '--mantine-color-dark-0': c.text,
        '--mantine-color-dark-4': surfaceColor,
        '--mantine-color-dark-5': c.card,
        '--mantine-color-dark-6': c.background,
        '--mantine-color-dark-7': c.background,
      },
    });
  }, [customColors, mounted]);

  return (
    <ColorSchemeContext.Provider value={contextValue}>
      <MantineProvider
        theme={mantineThemeOverride}
        defaultColorScheme={effectiveColorScheme}
        cssVariablesResolver={cssVariablesResolver}>
        {children}
      </MantineProvider>
    </ColorSchemeContext.Provider>);

}