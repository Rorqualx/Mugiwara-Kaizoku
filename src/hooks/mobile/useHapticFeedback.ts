/**
 * Haptic Feedback Hook
 *
 * Provides haptic feedback functionality for mobile devices.
 * Falls back gracefully on non-supporting platforms.
 */

import { useCallback, useEffect, useRef } from 'react';

import { logger } from '@/utils/logger';

export type HapticFeedbackType = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid' | 'success' | 'warning' | 'error' | 'selection';

interface HapticFeedbackOptions {
  /** Whether haptic feedback is enabled (default: true) */
  enabled?: boolean;
  /** Fallback to visual feedback if haptics not available (default: true) */
  fallbackToVisual?: boolean;
}

interface UseHapticFeedbackReturn {
  /** Trigger haptic feedback */
  trigger: (type?: HapticFeedbackType) => void;
  /** Whether haptic feedback is supported */
  isSupported: boolean;
  /** Whether haptic feedback is enabled */
  isEnabled: boolean;
}

/**
 * Hook for providing haptic feedback on mobile devices
 */
export function useHapticFeedback(options: HapticFeedbackOptions = {}): UseHapticFeedbackReturn {
  const { enabled = true, fallbackToVisual = true } = options;
  const visualFeedbackRef = useRef<HTMLDivElement | null>(null);

  // Check if Vibration API is supported
   
  const isSupported = typeof window !== 'undefined' && 'vibrate' in navigator;

  // Check if haptics should be enabled (user preference + device support)
  const isEnabled = enabled && isSupported;

  // Create visual feedback element
  useEffect(() => {
    if (fallbackToVisual && !isSupported && typeof document !== 'undefined') {
      const div = document.createElement('div');
      div.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background-color: rgba(0, 0, 0, 0.1);
        pointer-events: none;
        z-index: 9999;
        display: none;
      `;
      document.body.appendChild(div);
      visualFeedbackRef.current = div;

      return () => {
        document.body.removeChild(div);
      };
    }
  }, [fallbackToVisual, isSupported]);

  const trigger = useCallback((type: HapticFeedbackType = 'light') => {
    if (isEnabled) {
      // Map feedback types to vibration patterns
      const patterns: Record<HapticFeedbackType, number | number[]> = {
        light: 10,
        medium: 20,
        heavy: 30,
        soft: [10, 10],
        rigid: [30, 10, 30],
        success: [10, 20, 10],
        warning: [20, 10, 20],
        error: [30, 10, 30, 10, 30],
        selection: 5
      };

      const pattern = patterns[type] || patterns.light;

      try {
        navigator.vibrate(pattern);
      } catch (error: unknown) {
        logger.warn('Haptic feedback failed:', error);
      }
    } else if (fallbackToVisual && visualFeedbackRef.current) {
      // Provide visual feedback as fallback
      const element = visualFeedbackRef.current;
      element.style.display = 'block';
      element.style.opacity = '1';

      // Animate fade out
      element.animate([
      { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
      { opacity: 0, transform: 'translate(-50%, -50%) scale(1.5)' }],
      {
        duration: 300,
        easing: 'ease-out'
      }).onfinish = () => {
        element.style.display = 'none';
      };
    }
  }, [isEnabled, fallbackToVisual]);

  return {
    trigger,
    isSupported,
    isEnabled
  };
}