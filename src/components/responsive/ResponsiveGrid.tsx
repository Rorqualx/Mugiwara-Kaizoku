/**
 * Responsive Grid Component
 * 
 * An enhanced grid component that provides better mobile responsiveness
 * with touch-optimized spacing and dynamic column adjustments
 */

import React from 'react';

import { SimpleGrid } from '@mantine/core';

import { useBreakpoint } from '@/hooks/mobile';

import type { SimpleGridProps } from '@mantine/core';

interface ResponsiveGridProps extends Omit<SimpleGridProps, 'cols'> {
  /** Base columns configuration or responsive object */
  cols?: number | { base?: number; xs?: number; sm?: number; md?: number; lg?: number; xl?: number };
  /** Mobile-optimized spacing */
  mobileSpacing?: string | number;
  /** Tablet-optimized spacing */
  tabletSpacing?: string | number;
  /** Whether to use compact mode on mobile */
  compactOnMobile?: boolean;
  /** Minimum column width in pixels (for auto-sizing) */
  minColWidth?: number;
}

export function ResponsiveGrid({
  cols = { base: 1, xs: 2, sm: 3, md: 4, lg: 5, xl: 6 },
  spacing = 'md',
  verticalSpacing,
  mobileSpacing,
  tabletSpacing,
  compactOnMobile = false,
  minColWidth,
  children,
  ...props
}: ResponsiveGridProps): React.ReactElement {
  const { isMobile, isTablet } = useBreakpoint();

  // Calculate responsive columns
  const responsiveCols = React.useMemo(() => {
    if (typeof cols === 'number') {
      // Simple number - apply mobile optimizations
      if (isMobile) return Math.max(1, Math.floor(cols / 3));
      if (isTablet) return Math.max(2, Math.floor(cols / 2));
      return cols;
    }
    
    // Already responsive - use as is
    return cols;
  }, [cols, isMobile, isTablet]);

  // Calculate responsive spacing
  const responsiveSpacing = React.useMemo(() => {
    if (isMobile && mobileSpacing !== undefined) return mobileSpacing;
    if (isTablet && tabletSpacing !== undefined) return tabletSpacing;
    if (isMobile && compactOnMobile) return 'xs';
    return spacing;
  }, [spacing, mobileSpacing, tabletSpacing, isMobile, isTablet, compactOnMobile]);

  const responsiveVerticalSpacing = React.useMemo(() => {
    const baseVertical = verticalSpacing ?? responsiveSpacing;
    if (isMobile && mobileSpacing !== undefined) return mobileSpacing;
    if (isTablet && tabletSpacing !== undefined) return tabletSpacing;
    if (isMobile && compactOnMobile) return 'xs';
    return baseVertical;
  }, [verticalSpacing, responsiveSpacing, mobileSpacing, tabletSpacing, isMobile, isTablet, compactOnMobile]);

  // Apply minimum column width if specified
  const style = React.useMemo(() => {
    if (!minColWidth) return props.style;
    
    return {
      ...props.style,
      gridTemplateColumns: `repeat(auto-fit, minmax(${minColWidth}px, 1fr))`
    };
  }, [minColWidth, props.style]);

  return (
    <SimpleGrid
      {...props}
      cols={responsiveCols}
      spacing={responsiveSpacing}
      verticalSpacing={responsiveVerticalSpacing}
      style={style}
    >
      {children}
    </SimpleGrid>
  );
}