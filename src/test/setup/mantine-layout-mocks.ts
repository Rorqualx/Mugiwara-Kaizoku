/**
 * Test Setup - Mantine Layout Component Mocks
 *
 * Mock implementations of Mantine layout components.
 * Extracted from: src/test/setup.ts (layout components from lines 764-1655)
 *
 * @module test/setup/mantine-layout-mocks
 */

import { jest } from '@jest/globals';
import * as React from 'react';
import { CommonProps, MantineComponentProps } from './foundation';

/**
 * Convert a spacing prop value to CSS value.
 * Numbers are multiplied by 4 to get pixels (Mantine convention).
 */
function convertSpacing(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value * 4}px` : value;
}

/**
 * Build spacing styles from Mantine spacing props.
 * Extracted to reduce complexity in Box component.
 *
 * Note: Uses explicit `| undefined` types to satisfy exactOptionalPropertyTypes.
 * When destructuring optional props, they become `T | undefined` not optional `T?`.
 */
function buildSpacingStyles(props: {
  pr?: number | string | undefined;
  pl?: number | string | undefined;
  pt?: number | string | undefined;
  pb?: number | string | undefined;
  p?: number | string | undefined;
  mr?: number | string | undefined;
  ml?: number | string | undefined;
  mt?: number | string | undefined;
  mb?: number | string | undefined;
  m?: number | string | undefined;
}): React.CSSProperties {
  const style: React.CSSProperties = {};

  const paddingRight = convertSpacing(props.pr);
  const paddingLeft = convertSpacing(props.pl);
  const paddingTop = convertSpacing(props.pt);
  const paddingBottom = convertSpacing(props.pb);
  const padding = convertSpacing(props.p);
  const marginRight = convertSpacing(props.mr);
  const marginLeft = convertSpacing(props.ml);
  const marginTop = convertSpacing(props.mt);
  const marginBottom = convertSpacing(props.mb);
  const margin = convertSpacing(props.m);

  if (paddingRight) style.paddingRight = paddingRight;
  if (paddingLeft) style.paddingLeft = paddingLeft;
  if (paddingTop) style.paddingTop = paddingTop;
  if (paddingBottom) style.paddingBottom = paddingBottom;
  if (padding) style.padding = padding;
  if (marginRight) style.marginRight = marginRight;
  if (marginLeft) style.marginLeft = marginLeft;
  if (marginTop) style.marginTop = marginTop;
  if (marginBottom) style.marginBottom = marginBottom;
  if (margin) style.margin = margin;

  return style;
}

/**
 * Mock implementation of @mantine/core layout components.
 * This is a PARTIAL mock - it preserves existing functionality while overriding specific components.
 */
jest.mock('@mantine/core', () => ({
  ...(jest.requireActual('@mantine/core') as Record<string, unknown>),

  /**
   * Card - Container component with border, shadow, and padding options
   */
  Card: ({ children, ...props }: MantineComponentProps & {
    withBorder?: boolean;
    shadow?: string;
    radius?: string;
    padding?: string;
  }) =>
    React.createElement('div', {
      ...props,
      'data-testid': 'mantine-card',
      className: 'mantine-card'
    }, children),

  /**
   * Group - Horizontal flex container for aligning elements in a row
   */
  Group: ({ children, justify, pl, pr, h, w, gap, grow, style, ...props }: MantineComponentProps & {
    justify?: string;
    pl?: string | number;
    pr?: string | number;
    h?: string | number;
    w?: string | number;
    gap?: string | number;
  }) => {
    const { justify: _justify, pl: _pl, pr: _pr, h: _h, w: _w, gap: _gap, grow: _grow, ...cleanProps } = props;
    return React.createElement('div', {
      ...cleanProps,
      'data-testid': 'mantine-group',
      className: 'mantine-group mantine-Group-root',
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: justify ?? 'flex-start',
        paddingLeft: pl,
        paddingRight: pr,
        height: h,
        width: w,
        gap: gap,
        ...style
      }
    }, children);
  },

  /**
   * Stack - Vertical flex container for stacking elements in a column
   */
  Stack: ({ children, align, gap, grow, style, ...props }: MantineComponentProps & {
    align?: string;
    gap?: string | number;
  }) => {
    const { align: _align, gap: _gap, grow: _grow, className, ...cleanProps } = props;
    return React.createElement('div', {
      ...cleanProps,
      'data-testid': 'mantine-stack',
      className: `mantine-Stack-root mantine-stack ${className ?? ''}`,
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: align ?? 'stretch',
        gap: gap ?? '1rem',
        ...style
      }
    }, children);
  },

  /**
   * Grid - Responsive grid layout system
   * Grid.Col - Grid column component with span support
   */
  Grid: Object.assign(
    ({ children, ...props }: CommonProps) =>
      React.createElement('div', {
        ...props,
        'data-testid': 'mantine-grid',
        className: 'mantine-grid'
      }, children),
    {
      Col: ({ span, children, ...props }: CommonProps & { span?: number }) =>
        React.createElement('div', {
          ...props,
          'data-testid': 'mantine-grid-col',
          className: 'mantine-grid-col'
        }, children)
    }
  ),

  /**
   * Paper - Container with background, border, shadow, and padding
   */
  Paper: ({ children, withBorder, shadow, radius, padding, ...props }: CommonProps & {
    withBorder?: boolean;
    shadow?: string;
    radius?: string;
    padding?: string;
  }) =>
    React.createElement('div', {
      ...props,
      'data-testid': 'mantine-paper',
      className: `mantine-Paper-root mantine-paper ${props.className ?? ''}`,
      'data-mantine-paper': true,
      'data-with-border': withBorder ? 'true' : undefined
    }, children),

  /**
   * Box - Generic container with Mantine spacing props (padding/margin)
   * Converts numeric spacing values to pixels (multiplied by 4)
   */
  Box: ({ children, pr, pl, pt, pb, p, mr, ml, mt, mb, m, style, ...props }: CommonProps & {
    pr?: number | string;
    pl?: number | string;
    pt?: number | string;
    pb?: number | string;
    p?: number | string;
    mr?: number | string;
    ml?: number | string;
    mt?: number | string;
    mb?: number | string;
    m?: number | string;
  }) => {
    // Use helper function to convert Mantine spacing props to CSS styles
    const spacingStyle = buildSpacingStyles({ pr, pl, pt, pb, p, mr, ml, mt, mb, m });
    const combinedStyle = { ...spacingStyle, ...style };

    return React.createElement('div', {
      ...props,
      'data-testid': (props as Record<string, unknown>)['data-testid'] ?? 'mantine-box',
      style: combinedStyle
    }, children);
  },

  /**
   * Center - Container that centers its content both horizontally and vertically
   */
  Center: ({ children, ...props }: CommonProps) =>
    React.createElement('div', {
      ...props,
      'data-testid': 'mantine-center',
      className: `mantine-Center-root ${props.className ?? ''}`,
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...props.style
      }
    }, children),

  /**
   * Collapse - Collapsible container controlled by 'in' prop
   * Only renders children when in=true
   */
  Collapse: ({ in: inProp, children, style, ...props }: CommonProps & { in?: boolean }) => {
    if (!inProp) return null;

    return React.createElement('div', {
      ...props,
      'data-testid': 'mantine-collapse',
      style: { display: 'block', ...style }
    }, children);
  },

  /**
   * Portal - Renders children into a DOM node outside the parent component hierarchy
   * In tests, we render into a container div with a test-id for queryability
   */
  Portal: ({ children }: CommonProps) => {
    // In tests, render children in a container div with test-id for queryability
    if (!children) {
      return null;
    }
    // Wrap in a div with test-id so Portal content is queryable in tests
    return React.createElement('div', {
      'data-testid': 'mantine-portal',
      'data-portal': 'true'
    }, children);
  },

  /**
   * Transition - Animated transition component
   * In tests, we render children immediately when mounted without animations
   */
  Transition: ({ mounted, children, duration, transition, ...props }: CommonProps & {
    mounted?: boolean;
    duration?: number;
    transition?: string | Record<string, unknown>;
    children: ((styles: React.CSSProperties) => React.ReactElement) | React.ReactNode;
  }) => {
    if (!mounted) return null;

    // Call the render function with empty styles (no animation in tests)
    if (typeof children === 'function') {
      return children({});
    }
    return children as React.ReactElement;
  },
}));
