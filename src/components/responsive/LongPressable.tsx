/**
 * Long Pressable Component
 * 
 * Provides long press gesture support with:
 * - Customizable press duration
 * - Visual feedback
 * - Cancel on movement
 * - Haptic feedback support
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';

import { Box, Progress, Portal } from '@mantine/core';

import { getTouchDistance } from '@/utils/mobile/touch-utils';

interface LongPressableProps {
  /** Content to make long-pressable */
  children: React.ReactNode;
  /** Long press handler */
  onLongPress: () => void;
  /** Regular click/tap handler */
  onClick?: () => void;
  /** Long press duration in ms */
  duration?: number;
  /** Movement threshold to cancel (pixels) */
  moveThreshold?: number;
  /** Show visual feedback */
  showFeedback?: boolean;
  /** Disable long press */
  disabled?: boolean;
  /** Custom feedback component */
  feedbackComponent?: React.ReactNode;
  /** Feedback position */
  feedbackPosition?: 'overlay' | 'inline';
}

export function LongPressable({
  children,
  onLongPress,
  onClick,
  duration = 500,
  moveThreshold = 10,
  showFeedback = true,
  disabled = false,
  feedbackComponent,
  feedbackPosition = 'overlay'
}: LongPressableProps): JSX.Element {
  const [isPressing, setIsPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [feedbackCoords, setFeedbackCoords] = useState({ x: 0, y: 0 });

  const startPositionRef = useRef<{x: number;y: number;} | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredRef = useRef(false);
  const elementRef = useRef<HTMLDivElement>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPressing(false);
    setProgress(0);
  }, []);

  // Handle press start (mouse or touch)
  const handlePressStart = useCallback((clientX: number, clientY: number) => {
    if (disabled) return;

    longPressTriggeredRef.current = false;
    startPositionRef.current = { x: clientX, y: clientY };
    setIsPressing(true);

    // Set feedback position
    if (elementRef.current && feedbackPosition === 'overlay') {
      const _rect = elementRef.current.getBoundingClientRect();
      setFeedbackCoords({
        x: clientX,
        y: clientY
      });
    }

    // Start progress animation
    if (showFeedback) {
      const startTime = Date.now();
      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const newProgress = Math.min(elapsed / duration * 100, 100);
        setProgress(newProgress);

        if (newProgress >= 100 && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }, 16); // ~60fps
    }

    // Set timeout for long press
    timeoutRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      onLongPress();
      cleanup();

      // Haptic feedback would go here
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }, duration);
  }, [disabled, duration, showFeedback, onLongPress, cleanup, feedbackPosition]);

  // Handle press move
  const handlePressMove = useCallback((clientX: number, clientY: number) => {
    if (!startPositionRef.current || !isPressing) return;

    const distance = getTouchDistance(
      startPositionRef.current,
      { x: clientX, y: clientY }
    );

    // Cancel if moved too far
    if (distance > moveThreshold) {
      cleanup();
    }
  }, [isPressing, moveThreshold, cleanup]);

  // Handle press end
  const handlePressEnd = useCallback(() => {
    if (!isPressing) return;

    const wasLongPress = longPressTriggeredRef.current;
    cleanup();

    // Trigger click if it wasn't a long press
    if (!wasLongPress && onClick) {
      onClick();
    }
  }, [isPressing, onClick, cleanup]);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent): void => {
    handlePressStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent): void => {
    handlePressMove(e.clientX, e.clientY);
  };

  const handleMouseUp = (): void => {
    handlePressEnd();
  };

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent): void => {
    const touch = e.touches[0];
    if (touch) {
      handlePressStart(touch.clientX, touch.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent): void => {
    const touch = e.touches[0];
    if (touch) {
      handlePressMove(touch.clientX, touch.clientY);
    }
  };

  const handleTouchEnd = (): void => {
    handlePressEnd();
  };

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Default feedback component
  const defaultFeedback =
  <Box
    style={{
      position: 'absolute',
      top: feedbackCoords.y - 40,
      left: feedbackCoords.x - 40,
      width: 80,
      height: 80,
      borderRadius: '50%',
      backgroundColor: 'rgba(0, 0, 0, 0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      transform: `scale(${0.8 + progress / 100 * 0.2})`,
      opacity: 0.8
    }}>

      <Progress
      value={progress}
      size={60}
      radius="xl"
      styles={{
        root: { backgroundColor: 'transparent' }
      }}
      color="blue" />

    </Box>;

  return (
    <>
      <Box
        ref={elementRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={cleanup}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={cleanup}
        style={{
          cursor: disabled ? 'default' : 'pointer',
          userSelect: 'none',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          position: feedbackPosition === 'inline' ? 'relative' : undefined
        }}>

        {children}
        
        {/* Inline feedback */}
        {showFeedback && isPressing && feedbackPosition === 'inline' &&
        <Box
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            borderRadius: 'inherit',
            pointerEvents: 'none'
          }}>

            <Progress
            value={progress}
            size="xs"
            radius="xs"
            styles={{
              root: {
                backgroundColor: 'transparent',
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0
              }
            }}
            color="blue" />

          </Box>
        }
      </Box>

      {/* Overlay feedback */}
      {showFeedback && isPressing && feedbackPosition === 'overlay' &&
      <Portal>
          {feedbackComponent ?? defaultFeedback}
        </Portal>
      }
    </>);

}