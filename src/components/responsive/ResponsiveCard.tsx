/**
 * Responsive Card Component
 * 
 * An enhanced card component that adapts to different screen sizes
 * with touch-optimized interactions and flexible sizing
 */

import React, { useRef, useState } from 'react';

import { Paper } from '@mantine/core';

import { useBreakpoint } from '@/hooks/mobile';
import {
  getTouchPosition,
  getSwipeDirection,
  isTap,
  type TouchPosition } from '@/utils/mobile/touch-utils';

import type { PaperProps } from '@mantine/core';

interface ResponsiveCardProps extends Omit<PaperProps, 'onClick'> {
  /** Click handler */
  onClick?: (event: React.MouseEvent) => void;
  /** Component children */
  children?: React.ReactNode;
  /** Fixed dimensions for desktop */
  fixedWidth?: number;
  fixedHeight?: number;
  /** Whether to scale on mobile */
  scaleOnMobile?: boolean;
  /** Mobile scale factor (0-1) */
  mobileScale?: number;
  /** Whether to enable swipe gestures */
  enableSwipe?: boolean;
  /** Callback for swipe left */
  onSwipeLeft?: () => void;
  /** Callback for swipe right */
  onSwipeRight?: () => void;
  /** Whether to add touch feedback */
  touchFeedback?: boolean;
  /** Aspect ratio to maintain (e.g., "16/9", "4/3", "1/1") */
  aspectRatio?: string;
  /** Mobile-specific padding */
  mobilePadding?: string | number;
  /** Tablet-specific padding */
  tabletPadding?: string | number;
}

export function ResponsiveCard({
  fixedWidth,
  fixedHeight,
  scaleOnMobile = true,
  mobileScale = 1,
  enableSwipe = false,
  onSwipeLeft,
  onSwipeRight,
  touchFeedback = true,
  aspectRatio,
  mobilePadding,
  tabletPadding,
  style,
  p = 'md',
  onClick,
  children,
  ...props
}: ResponsiveCardProps): React.ReactElement {
  const { isMobile, isTablet } = useBreakpoint();
  const [isPressed, setIsPressed] = useState(false);
  const touchStartRef = useRef<TouchPosition | null>(null);
  const touchStartTimeRef = useRef<number>(0);

  // Calculate responsive dimensions
  const responsiveDimensions = React.useMemo(() => {
    const baseStyle: React.CSSProperties = {};

    if (fixedWidth && fixedHeight) {
      if (isMobile && scaleOnMobile) {
        // Scale down for mobile
        const scale = mobileScale;
        baseStyle.width = fixedWidth * scale;
        baseStyle.height = fixedHeight * scale;
      } else if (isTablet && scaleOnMobile) {
        // Slightly larger for tablets
        const scale = mobileScale + (1 - mobileScale) * 0.5;
        baseStyle.width = fixedWidth * scale;
        baseStyle.height = fixedHeight * scale;
      } else {
        // Full size on desktop
        baseStyle.width = fixedWidth;
        baseStyle.height = fixedHeight;
      }
    } else if (aspectRatio) {
      // Use aspect ratio for responsive sizing
      baseStyle.aspectRatio = aspectRatio;
      if (isMobile) {
        baseStyle.width = '100%';
        baseStyle.maxWidth = fixedWidth ?? 'none';
      }
    }

    return baseStyle;
  }, [fixedWidth, fixedHeight, scaleOnMobile, mobileScale, aspectRatio, isMobile, isTablet]);

  // Calculate responsive padding
  const responsivePadding = React.useMemo(() => {
    if (isMobile && mobilePadding !== undefined) return mobilePadding;
    if (isTablet && tabletPadding !== undefined) return tabletPadding;
    return p;
  }, [p, mobilePadding, tabletPadding, isMobile, isTablet]);

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent): void => {
    if (!enableSwipe) return;

    touchStartRef.current = getTouchPosition(e.nativeEvent);
    touchStartTimeRef.current = Date.now();

    if (touchFeedback) {
      setIsPressed(true);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent): void => {
    setIsPressed(false);

    if (!enableSwipe || !touchStartRef.current) return;

    const endPosition = getTouchPosition(e.nativeEvent);
    if (!endPosition) return;

    const duration = Date.now() - touchStartTimeRef.current;

    // Check if it's a tap
    if (isTap(touchStartRef.current, endPosition) && duration < 300 && onClick) {
      onClick(e as unknown as React.MouseEvent);
      return;
    }

    // Check for swipe
    const swipe = getSwipeDirection(touchStartRef.current, endPosition, 50);

    if (swipe.direction === 'left' && onSwipeLeft) {
      onSwipeLeft();
    } else if (swipe.direction === 'right' && onSwipeRight) {
      onSwipeRight();
    }

    touchStartRef.current = null;
  };

  const handleTouchCancel = (): void => {
    setIsPressed(false);
    touchStartRef.current = null;
  };

  // Combined styles
  const combinedStyle = {
    ...responsiveDimensions,
    ...style,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    transform: isPressed ? 'scale(0.98)' : 'scale(1)',
    cursor: onClick ?? enableSwipe ? 'pointer' : 'default',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent'
  } as React.CSSProperties;

  return (
    <Paper
      {...props}
      p={responsivePadding}
      style={combinedStyle}
      onClick={!enableSwipe ? onClick : undefined}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}>

      {children}
    </Paper>);

}