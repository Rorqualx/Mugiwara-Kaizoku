/**
 * Floating Action Button Component
 *
 * Material Design inspired FAB with:
 * - Extended and mini variants
 * - Speed dial menu
 * - Position options
 * - Scroll-aware hiding
 */

import React, { useRef, useEffect } from 'react';
import type { JSX } from 'react';

import { Portal } from '@mantine/core';
import { useMergedRef, useWindowScroll } from '@mantine/hooks';
import { IconPlus } from '@tabler/icons-react';

import { MotionSafe } from '@/components/performance/ReducedMotion';
import { useBreakpoint } from '@/hooks/mobile/useBreakpoint';

import { getFABPositionStyles } from './fab-utils';
import { MainFABButton } from './MainFABButton';
import { SpeedDialActions } from './SpeedDialActions';
import { useFABScroll } from './useFABScroll';
import { useFABState } from './useFABState';

import type { FABPosition, FABVariant, FABOffset } from './fab-utils';
import type { SpeedDialAction } from './SpeedDialActions';


export type { SpeedDialAction };

export interface FloatingActionButtonProps {
  /** Main action icon */
  icon?: React.ReactNode;
  /** Extended FAB label */
  label?: string | undefined;
  /** Click handler for main button */
  onClick?: () => void;
  /** Speed dial actions */
  actions?: SpeedDialAction[];
  /** FAB position */
  position?: FABPosition;
  /** FAB variant */
  variant?: FABVariant;
  /** FAB color */
  color?: string;
  /** Hide on scroll */
  hideOnScroll?: boolean;
  /** Scroll threshold for hiding */
  scrollThreshold?: number;
  /** Z-index */
  zIndex?: number;
  /** Offset from edges */
  offset?: FABOffset;
  /** Show labels for speed dial */
  showLabels?: boolean;
  /** Custom styles */
  style?: React.CSSProperties;
  /** Disabled state */
  disabled?: boolean;
  /** Force render (for testing) - bypasses isMobile check */
  forceRender?: boolean;
}

export function FloatingActionButton({
  icon = <IconPlus size={24} />,
  label,
  onClick,
  actions = [],
  position = 'bottom-right',
  variant = 'regular',
  color = 'blue',
  hideOnScroll = false,
  scrollThreshold = 10,
  zIndex = 100,
  offset = { x: 16, y: 16 },
  showLabels = true,
  style,
  disabled = false,
  forceRender = false
}: FloatingActionButtonProps): JSX.Element | null {
  const fabRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useBreakpoint();

  // State management
  const {
    speedDialOpen,
    setSpeedDialOpen,
    isVisible,
    setIsVisible,
    clickOutsideRef
  } = useFABState({ hideOnScroll });

  // Scroll handling
  useFABScroll({
    enabled: hideOnScroll,
    threshold: scrollThreshold,
    setIsVisible
  });

  // Combine refs
  const mergedFabRef = useMergedRef(fabRef, clickOutsideRef);

  // Handle main button click
  const handleMainClick = (): void => {
    if (actions.length > 0) {
      setSpeedDialOpen(!speedDialOpen);
    } else if (onClick) {
      onClick();
    }
  };

  // Don't render on desktop to prevent portal issues (unless forceRender is true for testing)
  if (!isMobile && !forceRender) {
    return null;
  }

  return (
    <Portal>
      <MotionSafe
        ref={mergedFabRef as unknown as React.Ref<HTMLDivElement>}
        style={{
          ...getFABPositionStyles(position, offset),
          zIndex,
          transition: 'transform 0.3s ease, opacity 0.3s ease',
          transform: isVisible ? 'scale(1)' : 'scale(0)',
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? 'auto' : 'none',
          ...style
        }}
        animation={{
          willChange: 'transform, opacity'
        }}>

        {/* Speed dial actions */}
        <SpeedDialActions
          actions={actions}
          isOpen={speedDialOpen}
          position={position}
          variant={variant}
          showLabels={showLabels}
          onActionClick={() => setSpeedDialOpen(false)}
        />

        {/* Main FAB */}
        <MainFABButton
          variant={variant}
          color={color}
          label={label}
          icon={icon}
          speedDialOpen={speedDialOpen}
          hasActions={actions.length > 0}
          disabled={disabled}
          onClick={handleMainClick}
        />
      </MotionSafe>

      <style>{`
        @keyframes fab-action-appear {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </Portal>
  );
}

/**
 * Hook for managing FAB visibility
 */
export function useFABVisibility(threshold = 10): boolean {
  const [scroll] = useWindowScroll();
  const lastScrollY = useRef(scroll.y);
  const [isVisible, setIsVisible] = React.useState(true);

  useEffect(() => {
    const scrollDelta = scroll.y - lastScrollY.current;

    if (Math.abs(scrollDelta) > threshold) {
      // Hide when scrolling down, show when scrolling up
      setIsVisible(scrollDelta < 0 || scroll.y < 100);
      lastScrollY.current = scroll.y;
    }
  }, [scroll.y, threshold]);

  return isVisible;
}
