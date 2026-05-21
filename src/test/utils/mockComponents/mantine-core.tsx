/**
 * Mock Mantine Core Components
 *
 * Mock implementations of core Mantine layout and typography components.
 * These mocks follow established patterns for testing.
 *
 * Components: Button, Text, Stack, Group, Title, Box, Card
 *
 * Extracted from: mockComponents.tsx (lines 185-380)
 */

import React from 'react';

import type {
  MockButtonProps,
  MockTextProps,
  MockStackProps,
  MockGroupProps,
  MockTitleProps,
  MockBoxProps,
  MockCardProps,
} from './types';

// ============================================================================
// Core Components
// ============================================================================

export const Button = ({
  children,
  leftSection,
  onClick,
  variant,
  color,
  size,
  fullWidth,
  disabled,
  loading,
  ...props
}: MockButtonProps): JSX.Element => (
  <button
    onClick={onClick}
    data-variant={variant ?? ''}
    data-color={color ?? ''}
    data-size={size ?? ''}
    data-fullwidth={fullWidth ? 'true' : 'false'}
    disabled={disabled ?? loading}
    className="mantine-Button-root"
    data-testid="mantine-button"
    {...props}
  >
    {leftSection && <span className="button-left-section">{leftSection}</span>}
    {loading && <span data-testid="loading-spinner">Loading...</span>}
    {children}
  </button>
);

export const Text = ({
  children,
  size,
  fw,
  c,
  color,
  italic,
  underline,
  ...props
}: MockTextProps): JSX.Element => (
  <div
    className="mantine-Text-root"
    data-testid="mantine-text"
    data-size={size ?? ''}
    data-fw={fw ?? ''}
    data-color={c ?? color ?? ''}
    data-italic={italic ? 'true' : 'false'}
    data-underline={underline ? 'true' : 'false'}
    {...props}
  >
    {children}
  </div>
);

export const Stack = ({
  children,
  gap,
  role,
  align,
  justify,
  ...props
}: MockStackProps): JSX.Element => (
  <div
    role={role}
    data-gap={gap ?? ''}
    data-align={align ?? ''}
    data-justify={justify ?? ''}
    className="mantine-Stack-root"
    data-testid="mantine-stack"
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: align ?? 'stretch',
      justifyContent: justify ?? 'flex-start',
    }}
    {...props}
  >
    {children}
  </div>
);

export const Group = ({
  children,
  position,
  justify,
  align,
  gap,
  grow,
  wrap,
  ...props
}: MockGroupProps): JSX.Element => (
  <div
    className="mantine-Group-root"
    data-testid="mantine-group"
    data-position={position ?? ''}
    data-justify={justify ?? position ?? ''}
    data-align={align ?? ''}
    data-gap={gap ?? ''}
    data-grow={grow ? 'true' : 'false'}
    data-wrap={wrap ? 'true' : 'false'}
    style={{
      display: 'flex',
      flexDirection: 'row',
      justifyContent: position ?? justify ?? 'flex-start',
      alignItems: align ?? 'center',
      flexWrap: wrap ? 'wrap' : 'nowrap',
    }}
    {...props}
  >
    {children}
  </div>
);

export const Title = ({
  children,
  order,
  align,
  color,
  ...props
}: MockTitleProps): JSX.Element => {
  // Use React.createElement instead of JSX for dynamic element creation
  const tag = `h${order ?? 1}`;
  return React.createElement(
    tag,
    {
      className: 'mantine-Title-root',
      'data-testid': 'mantine-title',
      'data-order': order ?? '',
      'data-align': align ?? '',
      'data-color': color ?? '',
      style: {
        textAlign: align ?? 'left',
        color: color ?? 'inherit',
      },
      ...props,
    },
    children
  );
};

export const Box = ({
  children,
  mb,
  mt,
  mx,
  my,
  px,
  py,
  p,
  m,
  pos,
  style,
  ...props
}: MockBoxProps): JSX.Element => (
  <div
    data-testid="mantine-box"
    className="mantine-Box-root"
    data-margin-bottom={mb ?? ''}
    data-margin-top={mt ?? ''}
    data-margin-x={mx ?? ''}
    data-margin-y={my ?? ''}
    data-padding-x={px ?? ''}
    data-padding-y={py ?? ''}
    data-padding={p ?? ''}
    data-margin={m ?? ''}
    data-position={pos ?? ''}
    style={{
      ...(style ?? {}),
      position: (pos as React.CSSProperties['position']) || 'static',
    }}
    {...props}
  >
    {children}
  </div>
);

export const Card = ({
  children,
  shadow,
  withBorder,
  p,
  padding,
  radius,
  ...props
}: MockCardProps): JSX.Element => (
  <div
    data-testid="mantine-card"
    className="mantine-Card-root"
    data-shadow={shadow ?? ''}
    data-with-border={withBorder ? 'true' : 'false'}
    data-padding={p ?? padding ?? ''}
    data-radius={radius ?? ''}
    {...props}
  >
    {children}
  </div>
);
