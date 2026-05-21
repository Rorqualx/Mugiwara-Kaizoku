// useReaderGestures hook - Touch gesture handling for reader
import { useState, useCallback, useRef } from 'react';

import { useGesture } from '@use-gesture/react';

import type { GestureHandlers } from '@/types/reader/reader-types';
import {
  SWIPE_VELOCITY_THRESHOLD,
  MIN_ZOOM_LEVEL,
  MAX_ZOOM_LEVEL,
  ZOOM_RESET_THRESHOLD,
  WHEEL_ZOOM_DELTA_FACTOR,
  DOUBLE_TAP_INTERVAL_MS,
  DOUBLE_TAP_DISTANCE_RADIUS,
  DOUBLE_TAP_ZOOM_LEVEL
} from '@/utils/reader/constants';
import { isObject, hasPropertyOfType, isNumber } from '@/utils/type-guards';

interface UseReaderGesturesOptions extends GestureHandlers {
  enabled?: boolean;
}

interface GestureState {
  zoom: number;
  offset: {x: number;y: number;};
}

/**
 * Return type for useReaderGestures hook
 */
export interface UseReaderGesturesReturn {
  bind: () => Record<string, unknown>;
  zoom: number;
  offset: { x: number; y: number };
  resetZoom: () => void;
  gestureState: GestureState;
}

export function useReaderGestures({
  onSwipeLeft,
  onSwipeRight,
  onPinchZoom,
  onPan,
  onDoubleTap,
  enabled = true
}: UseReaderGesturesOptions): UseReaderGesturesReturn {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const lastTapTime = useRef(0);
  const lastTapPosition = useRef({ x: 0, y: 0 });

  const bind = useGesture({
    onDrag: ({ movement: [mx, my], last, velocity: [vx], event }) => {
      if (!enabled) return;

      // Prevent default to avoid scrolling
      event.preventDefault();

      // If zoomed in, pan instead of swipe
      if (zoom > 1) {
        onPan?.({ x: mx, y: my });
        setOffset({ x: mx, y: my });
        return;
      }

      // Detect swipe on release
      if (last && Math.abs(vx) > SWIPE_VELOCITY_THRESHOLD) {
        if (vx > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      }
    },

    onPinch: ({ offset: [scale], last, event }) => {
      if (!enabled) return;

      // Prevent default to avoid page zoom
      event.preventDefault();

      const newZoom = Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, scale));
      setZoom(newZoom);
      onPinchZoom?.(newZoom);

      // Reset position when zoom returns to 1
      if (last && Math.abs(newZoom - 1) < ZOOM_RESET_THRESHOLD) {
        setOffset({ x: 0, y: 0 });
        setZoom(1);
      }
    },

    onWheel: ({ delta: [, dy], ctrlKey, metaKey, event }) => {
      if (!enabled) return;

      // Only handle zoom if Ctrl/Cmd is held
      if (ctrlKey || metaKey) {
        event.preventDefault();

        const zoomDelta = dy * WHEEL_ZOOM_DELTA_FACTOR;
        const newZoom = Math.max(MIN_ZOOM_LEVEL, Math.min(MAX_ZOOM_LEVEL, zoom + zoomDelta));
        setZoom(newZoom);
        onPinchZoom?.(newZoom);
      }
    },

    onTouchEnd: ({ event }) => {
      if (!enabled) return;

      if (!isObject(event) || !hasPropertyOfType(event, 'changedTouches', isObject)) {
        return;
      }

      const touch = event.changedTouches[0];
      if (!isObject(touch) || !hasPropertyOfType(touch, 'clientX', isNumber) || !hasPropertyOfType(touch, 'clientY', isNumber)) {
        return;
      }

      const currentTime = Date.now();
      const tapInterval = currentTime - lastTapTime.current;

      // Check for double tap (within interval and radius)
      if (tapInterval < DOUBLE_TAP_INTERVAL_MS) {
        const dx = touch.clientX - lastTapPosition.current.x;
        const dy = touch.clientY - lastTapPosition.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < DOUBLE_TAP_DISTANCE_RADIUS) {
          // Double tap detected
          onDoubleTap?.({ x: touch.clientX, y: touch.clientY });

          // Toggle zoom on double tap
          if (zoom === 1) {
            setZoom(DOUBLE_TAP_ZOOM_LEVEL);
            onPinchZoom?.(DOUBLE_TAP_ZOOM_LEVEL);
          } else {
            setZoom(1);
            setOffset({ x: 0, y: 0 });
            onPinchZoom?.(1);
          }
        }
      }

      lastTapTime.current = currentTime;
      lastTapPosition.current = { x: touch.clientX, y: touch.clientY };
    }
  });

  const resetZoom = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    onPinchZoom?.(1);
  }, [onPinchZoom]);

  return {
    bind,
    zoom,
    offset,
    resetZoom,
    gestureState: { zoom, offset } as GestureState
  };
}