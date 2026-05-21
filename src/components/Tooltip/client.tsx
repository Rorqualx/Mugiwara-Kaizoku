"use client";
/**
 * Client-side Tooltip Component
 * 
 * This component provides a wrapper around Mantine's Tooltip component that
 * handles server-side rendering gracefully. It prevents hydration mismatches
 * by only rendering the tooltip on the client side.
 * 
 * Features:
 * - SSR-safe tooltip rendering
 * - Hydration mismatch prevention
 * - Full Mantine tooltip functionality
 * - Type-safe props interface
 * 
 * @module components/Tooltip/client
 */

import { type ReactNode } from 'react';

import { Tooltip as MantineTooltip, type TooltipProps } from '@mantine/core';

/**
 * Props for the CustomTooltip component
 * 
 * Extends Mantine's TooltipProps but makes the children prop required
 * and properly typed as ReactNode.
 * 
 * @interface CustomTooltipProps
 * @extends {Omit<TooltipProps, 'children'>}
 * @property {ReactNode} children - The content to wrap with the tooltip
 */
interface CustomTooltipProps extends Omit<TooltipProps, 'children'> {
  children: ReactNode;
}

/**
 * SSR-safe tooltip component
 * 
 * Renders a Mantine tooltip on the client side, but returns just the children
 * during server-side rendering to prevent hydration mismatches.
 * 
 * @param {CustomTooltipProps} props - Component properties
 * @returns {JSX.Element} The rendered tooltip or its children
 * 
 * @example
 * ```tsx
 * <Tooltip label="Helpful information">
 *   <Button>Hover me</Button>
 * </Tooltip>
 * ```
 */
export function Tooltip({ children, ...props }: CustomTooltipProps): React.ReactElement {
  // Return null if we're on the server to prevent hydration issues
  if (typeof window === 'undefined') return <>{children}</>;
  
  return <MantineTooltip {...props}>{children}</MantineTooltip>;
}
