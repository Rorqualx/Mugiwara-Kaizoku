/**
 * Mantine Theme Configuration
 * 
 * This module defines the global theme settings for the application using Mantine's theme system.
 * It includes configurations for:
 * - Typography and font stacks
 * - Color schemes and palettes
 * - Spacing and layout metrics
 * - Component-specific customizations
 * - Responsive breakpoints
 * 
 * @module themes
 */

import { createTheme, rem } from '@mantine/core';

import type { MantineThemeOverride} from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/spotlight/styles.css';

/**
 * Font stack definitions for different text contexts
 * Uses system fonts with appropriate fallbacks
 */
const fontStack = {
  sans: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  mono: 'Monaco, Courier, monospace',
  heading: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
} as const;

/**
 * Main theme configuration object
 * Extends Mantine's base theme with custom settings
 * 
 * @type {MantineThemeOverride}
 */
export const theme: MantineThemeOverride = createTheme({
  /**
   * Core typography settings
   * Defines base font families for regular and monospace text
   */
  fontFamily: fontStack.sans,
  fontFamilyMonospace: fontStack.mono,

  /**
   * Border radius scale
   * Provides consistent rounding across components
   */
  radius: {
    xs: rem(2),
    sm: rem(4),
    md: rem(8),
    lg: rem(16),
    xl: rem(32),
  },

  /**
   * Typography configuration
   * Defines heading styles and sizes with consistent scaling
   */
  headings: {
    fontFamily: fontStack.heading,
    sizes: {
      h1: { fontSize: rem(32), lineHeight: '1.3' },
      h2: { fontSize: rem(24), lineHeight: '1.35' },
      h3: { fontSize: rem(20), lineHeight: '1.4' },
      h4: { fontSize: rem(18), lineHeight: '1.45' },
      h5: { fontSize: rem(16), lineHeight: '1.5' },
      h6: { fontSize: rem(14), lineHeight: '1.5' },
    },
  },

  /**
   * Color palette configuration
   * Uses Mantine v7 CSS variable format for dynamic theming
   * Each color must have exactly 10 shades for proper gradient support
   */
  colors: {
    // Each color must have exactly 10 shades - define actual colors, not CSS variables
    gray: [
      '#f8f9fa',
      '#f1f3f5',
      '#e9ecef',
      '#dee2e6',
      '#ced4da',
      '#adb5bd',
      '#868e96',
      '#495057',
      '#343a40',
      '#212529',
    ],
    blue: [
      '#e7f5ff',
      '#d0ebff',
      '#a5d8ff',
      '#74c0fc',
      '#4dabf7',
      '#339af0',
      '#228be6',
      '#1c7ed6',
      '#1971c2',
      '#1864ab',
    ],
    orange: [
      '#fff4e6',
      '#ffe8cc',
      '#ffd8a8',
      '#ffc078',
      '#ffa94d',
      '#ff922b',
      '#fd7e14',
      '#f76707',
      '#e8590c',
      '#d9480f',
    ],
    green: [
      '#ebfbee',
      '#d3f9d8',
      '#b2f2bb',
      '#8ce99a',
      '#69db7c',
      '#51cf66',
      '#40c057',
      '#37b24d',
      '#2f9e44',
      '#2b8a3e',
    ],
    violet: [
      '#f3f0ff',
      '#e5dbff',
      '#d0bfff',
      '#b197fc',
      '#9775fa',
      '#845ef7',
      '#7950f2',
      '#7048e8',
      '#6741d9',
      '#5f3dc4',
    ],
    cyan: [
      '#e3fafc',
      '#c5f6fa',
      '#99e9f2',
      '#66d9e8',
      '#3bc9db',
      '#22b8cf',
      '#15aabf',
      '#1098ad',
      '#0c8599',
      '#0b7285',
    ],
    red: [
      '#fff5f5',
      '#ffe3e3',
      '#ffc9c9',
      '#ffa8a8',
      '#ff8787',
      '#ff6b6b',
      '#fa5252',
      '#f03e3e',
      '#e03131',
      '#c92a2a',
    ],
  },

  /**
   * Spacing scale
   * Defines consistent spacing units for margins and padding
   */
  spacing: {
    xs: rem(4),
    sm: rem(8),
    md: rem(16),
    lg: rem(24),
    xl: rem(32),
  },

  /**
   * Responsive breakpoints
   * Defines screen size thresholds for responsive design
   */
  breakpoints: {
    xs: '36em',  // 576px
    sm: '48em',  // 768px
    md: '62em',  // 992px
    lg: '75em',  // 1200px
    xl: '88em',  // 1408px
  },

  /**
   * Component-specific customizations
   * Overrides default Mantine component styles and behaviors
   */
  components: {
    Button: {
      defaultProps: {
        size: 'sm',
      },
      styles: {
        root: {
          '--button-height': rem(30),
        }
      },
    },
    Text: {
      defaultProps: {
        size: 'sm',
      },
    },
    Title: {
      styles: {
        root: {
          '--title-fw': '600',
          '--title-lts': '-0.01em',
          fontWeight: 600,
          letterSpacing: '-0.01em',
        },
      },
    },
    Card: {
      styles: {
        root: {
          '--card-transition': 'transform 150ms ease, box-shadow 150ms ease',
          transition: 'transform 150ms ease, box-shadow 150ms ease',
          '&:hover': {
            transform: 'scale(1.01)',
            boxShadow: 'var(--mantine-shadow-sm)',
          },
        },
      },
    },
    Modal: {
      styles: {
        header: {
          marginBottom: 'var(--mantine-spacing-md)',
        },
      },
    },
  },

  /**
   * Custom theme extensions
   * Additional variables for application-specific styling needs
   */
  other: {
    fontFamilyNaruto: "'Ninja Naruto Regular', cursive",
    transitionTimings: {
      fast: '150ms var(--mantine-transition-timing-function)',
      normal: '250ms var(--mantine-transition-timing-function)',
      slow: '350ms var(--mantine-transition-timing-function)',
    },
  },
});

export type { MantineThemeOverride };
