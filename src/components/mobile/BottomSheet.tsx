/**
 * Bottom Sheet Component
 * 
 * Mobile-optimized bottom sheet with:
 * - Swipe to dismiss
 * - Multiple snap points
 * - Smooth animations
 * - Backdrop handling
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { JSX } from 'react';

import { Box, Portal, Transition, ScrollArea } from '@mantine/core';
import { useFocusTrap, useClickOutside, useWindowEvent, useMergedRef } from '@mantine/hooks';

import { MotionSafe } from '@/components/performance/ReducedMotion';
import { useSwipeGesture } from '@/hooks/mobile/useSwipeGesture';

export interface BottomSheetProps {
  /** Whether the sheet is open */
  opened: boolean;
  /** Close handler */
  onClose: () => void;
  /** Sheet content */
  children: React.ReactNode;
  /** Snap points (percentages of viewport height) */
  snapPoints?: number[];
  /** Initial snap point index */
  initialSnapPoint?: number;
  /** Enable swipe to dismiss */
  swipeToDismiss?: boolean;
  /** Show drag handle */
  showHandle?: boolean;
  /** Backdrop opacity */
  backdropOpacity?: number;
  /** Close on backdrop click */
  closeOnClickOutside?: boolean;
  /** Z-index */
  zIndex?: number;
  /** Custom styles */
  style?: React.CSSProperties;
  /** Sheet padding */
  padding?: string | number;
  /** Maximum height */
  maxHeight?: string | number;
  /** Transition duration */
  transitionDuration?: number;
  /** On snap point change */
  onSnapPointChange?: (index: number) => void;
}

export function BottomSheet({
  opened,
  onClose,
  children,
  snapPoints = [0.5, 0.9],
  initialSnapPoint = 0,
  swipeToDismiss = true,
  showHandle = true,
  backdropOpacity = 0.5,
  closeOnClickOutside = true,
  zIndex = 200,
  style,
  padding = 'md',
  maxHeight = '90vh',
  transitionDuration = 300,
  onSnapPointChange
}: BottomSheetProps): JSX.Element {
  const [currentSnapPoint, setCurrentSnapPoint] = useState(initialSnapPoint);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  const focusTrapRef = useFocusTrap(opened);

  // Click outside handler
  const clickOutsideRef = useClickOutside(() => {
    if (opened && closeOnClickOutside && !isDragging) {
      onClose();
    }
  });

  // Combine refs using useMergedRef
  const mergedSheetRef = useMergedRef(sheetRef, clickOutsideRef);

  // Calculate sheet height based on snap point
  const getSheetHeight = useCallback((snapIndex: number): string => {
    const snapPoint = snapPoints[snapIndex];
    if (!snapPoint) {
      const firstPoint = snapPoints[0];
      return firstPoint ? `${firstPoint * 100}vh` : '50vh';
    }
    return `${snapPoint * 100}vh`;
  }, [snapPoints]);

  // Find closest snap point
  const findClosestSnapPoint = useCallback((currentHeight: number, velocity: number = 0): number => {
    const viewportHeight = window.innerHeight;
    const currentPercent = currentHeight / viewportHeight;

    const firstPoint = snapPoints[0];
    if (!firstPoint) return 0;

    let closestIndex = 0;
    let closestDistance = Math.abs(firstPoint - currentPercent);

    // Consider velocity for better feel
    const adjustedPercent = currentPercent + velocity * 0.2;

    snapPoints.forEach((point, index) => {
      const distance = Math.abs(point - adjustedPercent);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    return closestIndex;
  }, [snapPoints]);

  // Handle drag start
  const handleDragStart = useCallback((clientY: number): void => {
    if (!sheetRef.current) return;

    setIsDragging(true);
    startYRef.current = clientY;
    currentYRef.current = translateY;
  }, [translateY]);

  // Handle drag move
  const handleDragMove = useCallback((clientY: number): void => {
    if (!isDragging || !sheetRef.current) return;

    const deltaY = clientY - startYRef.current;
    const newTranslateY = Math.max(0, currentYRef.current + deltaY);

    setTranslateY(newTranslateY);
  }, [isDragging]);

  // Handle drag end
  const handleDragEnd = useCallback((velocity: number = 0): void => {
    if (!sheetRef.current) return;

    setIsDragging(false);

    const sheetHeight = sheetRef.current.offsetHeight;
    const currentHeight = sheetHeight - translateY;

    // Check if should dismiss
    if (swipeToDismiss && (translateY > sheetHeight * 0.5 || velocity > 0.5)) {
      onClose();
      return;
    }

    // Snap to closest point
    const closestSnapIndex = findClosestSnapPoint(currentHeight / window.innerHeight, velocity);
    setCurrentSnapPoint(closestSnapIndex);
    setTranslateY(0);
    onSnapPointChange?.(closestSnapIndex);
  }, [translateY, swipeToDismiss, onClose, findClosestSnapPoint, onSnapPointChange]);

  // Swipe gesture handlers
  const { handlers } = useSwipeGesture({
    ...(swipeToDismiss ? { onSwipeDown: onClose } : {}),
    threshold: 100
  });

  // Mouse handler for drag handle (for testing)
  const handleMouseDown = (e: React.MouseEvent): void => {
    handleDragStart(e.clientY);
  };

  // Global mouse events
  useWindowEvent('mousemove', (e: MouseEvent) => {
    if (isDragging) {
      handleDragMove(e.clientY);
    }
  });
  useWindowEvent('mouseup', () => {
    if (isDragging) {
      handleDragEnd();
    }
  });

  // Escape key handler
  useWindowEvent('keydown', (e: KeyboardEvent) => {
    if (opened && e.key === 'Escape') {
      onClose();
    }
  });

  // Reset state when closed
  useEffect(() => {
    if (!opened) {
      setTranslateY(0);
      setCurrentSnapPoint(initialSnapPoint);
    }
  }, [opened, initialSnapPoint]);

  return (
    <Portal>
      {/* Backdrop */}
      <Transition
        mounted={opened}
        duration={transitionDuration}
        transition="fade">

        {(styles) =>
        <Box
          style={{
            ...styles,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: `rgba(0, 0, 0, ${backdropOpacity})`,
            zIndex: zIndex - 1
          }} />

        }
      </Transition>
      
      {/* Sheet */}
      <Transition
        mounted={opened}
        duration={transitionDuration}
        transition={{
          in: { transform: 'translateY(0)' },
          out: { transform: 'translateY(100%)' },
          transitionProperty: 'transform'
        }}>

        {(styles) =>
        <Box
          ref={focusTrapRef}
          style={{
            ...styles,
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'var(--mantine-color-body)',
            borderTopLeftRadius: 'var(--mantine-radius-lg)',
            borderTopRightRadius: 'var(--mantine-radius-lg)',
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.1)',
            zIndex,
            height: getSheetHeight(currentSnapPoint),
            maxHeight,
            transform: `translateY(${isDragging ? translateY : 0}px)`,
            transition: isDragging ? 'none' : `transform ${transitionDuration}ms ease-out`,
            touchAction: 'none',
            ...style
          }}>

          <MotionSafe
            style={{
              height: '100%'
            }}
            animation={{
              willChange: 'transform'
            }}>

            <Box ref={mergedSheetRef} style={{ height: '100%' }}>
              {/* Drag handle */}
              {showHandle &&
            <Box
              style={{
                padding: '12px',
                cursor: isDragging ? 'grabbing' : 'grab',
                touchAction: 'none'
              }}
              onMouseDown={handleMouseDown}
              {...handlers}>

                  <Box
                style={{
                  width: 40,
                  height: 4,
                  backgroundColor: 'var(--mantine-color-gray-4)',
                  borderRadius: 'var(--mantine-radius-xl)',
                  margin: '0 auto'
                }} />

                </Box>
            }

              {/* Content */}
              <ScrollArea
              ref={contentRef}
              style={{
                height: showHandle ? 'calc(100% - 40px)' : '100%',
                padding
              }}>

                {children}
              </ScrollArea>
            </Box>
          </MotionSafe>
        </Box>
        }
      </Transition>
    </Portal>);

}

/**
 * Hook for bottom sheet state management
 */
export function useBottomSheet(defaultOpened = false): {
  opened: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
} {
  const [opened, setOpened] = useState(defaultOpened);

  const open = useCallback((): void => setOpened(true), []);
  const close = useCallback((): void => setOpened(false), []);
  const toggle = useCallback((): void => setOpened((prev) => !prev), []);

  return {
    opened,
    open,
    close,
    toggle
  };
}