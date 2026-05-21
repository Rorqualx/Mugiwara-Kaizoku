/**
 * Pinch Zoom Hook
 * 
 * Handles pinch-to-zoom gestures on mobile devices
 */

import { useRef, useState, useCallback, useEffect } from 'react';

export interface UsePinchZoomOptions {
  /** Minimum zoom scale */
  minScale?: number;
  /** Maximum zoom scale */
  maxScale?: number;
  /** Initial scale */
  initialScale?: number;
  /** Scale change callback */
  onScaleChange?: (scale: number) => void;
  /** Pinch start callback */
  onPinchStart?: () => void;
  /** Pinch end callback */
  onPinchEnd?: () => void;
}

export interface PinchZoomHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export interface UsePinchZoomReturn {
  /** Current scale */
  scale: number;
  /** Set scale programmatically */
  setScale: (scale: number) => void;
  /** Reset to initial scale */
  resetScale: () => void;
  /** Touch event handlers */
  handlers: PinchZoomHandlers;
  /** Whether currently pinching */
  isPinching: boolean;
}

export function usePinchZoom({
  minScale = 0.5,
  maxScale = 3,
  initialScale = 1,
  onScaleChange,
  onPinchStart,
  onPinchEnd
}: UsePinchZoomOptions = {}): UsePinchZoomReturn {
  const [scale, setScaleState] = useState(initialScale);
  const [isPinching, setIsPinching] = useState(false);

  const initialDistanceRef = useRef<number | null>(null);
  const currentScaleRef = useRef(initialScale);

  // Update scale with bounds checking
  const setScale = useCallback((newScale: number) => {
    const clampedScale = Math.max(minScale, Math.min(maxScale, newScale));
    setScaleState(clampedScale);
    currentScaleRef.current = clampedScale;
    onScaleChange?.(clampedScale);
  }, [minScale, maxScale, onScaleChange]);

  // Reset scale
  const resetScale = useCallback(() => {
    setScale(initialScale);
  }, [initialScale, setScale]);

  // Calculate distance between two touch points
  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;

    const touch0 = touches[0];
    const touch1 = touches[1];
    if (touch0 === undefined || touch1 === undefined) return 0;

    const dx = touch0.clientX - touch1.clientX;
    const dy = touch0.clientY - touch1.clientY;

    return Math.sqrt(dx * dx + dy * dy);
  };

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Start pinch
      initialDistanceRef.current = getTouchDistance(e.touches);
      setIsPinching(true);
      onPinchStart?.();
    }
  }, [onPinchStart]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistanceRef.current !== null) {
      e.preventDefault();

      const currentDistance = getTouchDistance(e.touches);
      const scaleFactor = currentDistance / initialDistanceRef.current;

      // Apply scale relative to the scale when pinch started
      const baseScale = currentScaleRef.current / scaleFactor;
      const newScale = baseScale * scaleFactor;

      setScale(newScale);
    }
  }, [setScale]);

  // Handle touch end
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      // End pinch
      initialDistanceRef.current = null;

      if (isPinching) {
        setIsPinching(false);
        onPinchEnd?.();
      }
    }
  }, [isPinching, onPinchEnd]);

  // Create handlers object
  const handlers: PinchZoomHandlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };

  // Prevent default gesture handling
  useEffect(() => {
    const preventGesture = (e: Event): void => {
      if (isPinching) {
        e.preventDefault();
      }
    };

    document.addEventListener('gesturestart', preventGesture);
    document.addEventListener('gesturechange', preventGesture);
    document.addEventListener('gestureend', preventGesture);

    return () => {
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      document.removeEventListener('gestureend', preventGesture);
    };
  }, [isPinching]);

  return {
    scale,
    setScale,
    resetScale,
    handlers,
    isPinching
  };
}