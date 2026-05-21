/**
 * Swipe Gesture Hook
 * 
 * Handles swipe gestures for navigation and actions
 */

import { useRef, useCallback } from 'react';

import { getSwipeDirection, getTouchPosition, type SwipeInfo, type TouchPosition } from '@/utils/mobile/touch-utils';

export interface UseSwipeGestureOptions {
  /** Swipe left handler */
  onSwipeLeft?: () => void;
  /** Swipe right handler */
  onSwipeRight?: () => void;
  /** Swipe up handler */
  onSwipeUp?: () => void;
  /** Swipe down handler */
  onSwipeDown?: () => void;
  /** Minimum distance for swipe (pixels) */
  threshold?: number;
  /** Maximum time for swipe (ms) */
  maxTime?: number;
  /** Prevent default behavior */
  preventDefault?: boolean;
  /** Stop propagation */
  stopPropagation?: boolean;
}

export interface SwipeGestureHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
}

export interface UseSwipeGestureReturn {
  /** Touch/mouse event handlers */
  handlers: SwipeGestureHandlers;
  /** Whether currently swiping */
  isSwiping: boolean;
  /** Current swipe direction */
  swipeDirection: SwipeInfo['direction'] | null;
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 50,
  maxTime = 300,
  preventDefault = true,
  stopPropagation = false
}: UseSwipeGestureOptions = {}): UseSwipeGestureReturn {
  const startPositionRef = useRef<TouchPosition | null>(null);
  const startTimeRef = useRef<number>(0);
  const isSwipingRef = useRef(false);
  const currentDirectionRef = useRef<SwipeInfo['direction'] | null>(null);
  
  // Handle swipe based on direction
  const handleSwipe = useCallback((swipeInfo: SwipeInfo) => {
    switch (swipeInfo.direction) {
      case 'left':
        onSwipeLeft?.();
        break;
      case 'right':
        onSwipeRight?.();
        break;
      case 'up':
        onSwipeUp?.();
        break;
      case 'down':
        onSwipeDown?.();
        break;
      default:
        // No handler defined for this swipe direction
        break;
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);
  
  // Handle touch/mouse start
  const handleStart = useCallback((position: TouchPosition, e: React.TouchEvent | React.MouseEvent) => {
    startPositionRef.current = position;
    startTimeRef.current = Date.now();
    isSwipingRef.current = true;
    currentDirectionRef.current = null;
    
    if (stopPropagation) {
      e.stopPropagation();
    }
  }, [stopPropagation]);
  
  // Handle touch/mouse move
  const handleMove = useCallback((position: TouchPosition, e: React.TouchEvent | React.MouseEvent) => {
    if (!startPositionRef.current || !isSwipingRef.current) return;
    
    if (preventDefault) {
      e.preventDefault();
    }
    
    if (stopPropagation) {
      e.stopPropagation();
    }
    
    // Update current direction
    const swipeInfo = getSwipeDirection(startPositionRef.current, position, threshold / 2);
    currentDirectionRef.current = swipeInfo.direction;
  }, [preventDefault, stopPropagation, threshold]);
  
  // Handle touch/mouse end
  const handleEnd = useCallback((position: TouchPosition | null, e: React.TouchEvent | React.MouseEvent) => {
    if (!startPositionRef.current || !isSwipingRef.current) return;
    
    if (stopPropagation) {
      e.stopPropagation();
    }
    
    const endTime = Date.now();
    const duration = endTime - startTimeRef.current;
    
    // Check if it was a valid swipe
    if (duration <= maxTime && position) {
      const swipeInfo = getSwipeDirection(startPositionRef.current, position, threshold);

      if (swipeInfo.direction !== null) {
        handleSwipe(swipeInfo);
      }
    }
    
    // Reset
    startPositionRef.current = null;
    isSwipingRef.current = false;
    currentDirectionRef.current = null;
  }, [threshold, maxTime, handleSwipe, stopPropagation]);
  
  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const position = getTouchPosition(e.nativeEvent);
    if (position) {
      handleStart(position, e);
    }
  }, [handleStart]);
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const position = getTouchPosition(e.nativeEvent);
    if (position) {
      handleMove(position, e);
    }
  }, [handleMove]);
  
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const position = getTouchPosition(e.nativeEvent);
    handleEnd(position, e);
  }, [handleEnd]);
  
  // Mouse event handlers (for desktop testing)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const position: TouchPosition = { x: e.clientX, y: e.clientY };
    handleStart(position, e);
  }, [handleStart]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSwipingRef.current) return;
    const position: TouchPosition = { x: e.clientX, y: e.clientY };
    handleMove(position, e);
  }, [handleMove]);
  
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const position: TouchPosition = { x: e.clientX, y: e.clientY };
    handleEnd(position, e);
  }, [handleEnd]);
  
  // Create handlers object
  const handlers: SwipeGestureHandlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp
  };
  
  return {
    handlers,
    isSwiping: isSwipingRef.current,
    swipeDirection: currentDirectionRef.current
  };
}