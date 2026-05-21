/**
 * Reduced Motion Components
 * 
 * Components that respect user's motion preferences:
 * - Motion-safe animations
 * - Conditional transitions
 * - Accessible alternatives
 */

import React, { useEffect, useState } from 'react';

import { Box, Transition, type TransitionProps } from '@mantine/core';
import { useReducedMotion } from '@mantine/hooks';

import { prefersReducedMotion } from '@/utils/mobile/performance';

interface MotionSafeProps extends React.HTMLAttributes<HTMLElement> {
  /** Children to render */
  children: React.ReactNode;
  /** Animation when motion is allowed */
  animation?: React.CSSProperties;
  /** Static styles when motion is reduced */
  reducedMotion?: React.CSSProperties;
  /** Base styles */
  style?: React.CSSProperties;
  /** Component to render */
  component?: 'div' | 'span' | 'section' | 'article' | 'nav' | 'header' | 'footer' | 'main';
}

/**
 * Motion-safe wrapper component
 */
export const MotionSafe = React.forwardRef<HTMLElement, MotionSafeProps>(
  (
    {
      children,
      animation = {},
      reducedMotion = {},
      style = {},
      component = 'div',
      className,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      ...restProps
    }: MotionSafeProps,
    ref
  ): React.ReactElement => {
    const prefersReduced = useReducedMotion();

    const filteredRestProps = Object.fromEntries(
      Object.entries(restProps).filter(([, v]) => v !== undefined)
    );

    const mergedStyle: React.CSSProperties = {
      ...style,
      ...(prefersReduced ? reducedMotion : animation)
    };

    // Build consolidated props object to satisfy exactOptionalPropertyTypes
    const allProps: Record<string, unknown> = {
      ref: ref as unknown as React.Ref<HTMLDivElement>,
      component: component as unknown as 'div',
      style: mergedStyle,
      ...filteredRestProps
    };

    // Add optional handler props only if defined
    if (className !== undefined) {
      allProps['className'] = className;
    }
    if (onTouchStart !== undefined) {
      allProps['onTouchStart'] = onTouchStart;
    }
    if (onTouchMove !== undefined) {
      allProps['onTouchMove'] = onTouchMove;
    }
    if (onTouchEnd !== undefined) {
      allProps['onTouchEnd'] = onTouchEnd;
    }

    return (
      <Box {...(allProps as unknown as React.ComponentProps<typeof Box>)}>
        {children}
      </Box>
    );
  }
);

MotionSafe.displayName = 'MotionSafe';

interface MotionTransitionProps extends Omit<TransitionProps, 'children'> {
  /** Children render function */
  children: (styles: React.CSSProperties) => React.ReactElement;
  /** Whether to disable transition when motion is reduced */
  respectMotionPreference?: boolean;
  /** Alternative transition for reduced motion */
  reducedMotionTransition?: Partial<TransitionProps>;
}

/**
 * Motion-aware transition component
 */
export function MotionTransition({
  children,
  respectMotionPreference = true,
  reducedMotionTransition,
  ...props
}: MotionTransitionProps): React.ReactElement {
  const prefersReduced = useReducedMotion();

  if (respectMotionPreference && prefersReduced) {
    const defaultReducedTransition = { duration: 0, transition: 'fade' as TransitionProps['transition'] };
    const reducedTransition = reducedMotionTransition ?? defaultReducedTransition;
    const finalDuration = reducedTransition.duration ?? 0;
    const finalTransition = reducedTransition.transition ?? 'fade';
    return (
      <Transition {...props} duration={finalDuration} transition={finalTransition}>
        {children}
      </Transition>);

  }

  return <Transition {...props}>{children}</Transition>;
}

interface AnimatedValueProps {
  /** Starting value */
  from: number;
  /** Ending value */
  to: number;
  /** Animation duration in ms */
  duration?: number;
  /** Easing function */
  easing?: (t: number) => number;
  /** Whether to respect motion preference */
  respectMotionPreference?: boolean;
  /** Format value for display */
  format?: (value: number) => string;
  /** Component to render */
  component?: 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

/**
 * Animated numeric value component
 */
export function AnimatedValue({
  from,
  to,
  duration = 1000,
  easing = (t) => t, // Linear by default
  respectMotionPreference = true,
  format = (value) => Math.round(value).toString(),
  component = 'span'
}: AnimatedValueProps): React.ReactElement {
  const prefersReduced = useReducedMotion();
  const [value, setValue] = useState(from);
  const [_isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Skip animation if motion is reduced
    if (respectMotionPreference && prefersReduced) {
      setValue(to);
      return;
    }

    setIsAnimating(true);
    const startTime = performance.now();
    const difference = to - from;

    const animate = (currentTime: number): void => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);

      setValue(from + difference * easedProgress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(animate);
  }, [from, to, duration, easing, prefersReduced, respectMotionPreference]);

  const Component = component as unknown as React.ElementType;

  return (
    <Component>
      {format(value)}
    </Component>);

}

interface SkeletonProps {
  /** Width of skeleton */
  width?: string | number;
  /** Height of skeleton */
  height?: string | number;
  /** Border radius */
  radius?: string | number;
  /** Whether to animate */
  animate?: boolean;
  /** Circle skeleton */
  circle?: boolean;
  /** Additional styles */
  style?: React.CSSProperties;
}

/**
 * Motion-aware skeleton loader
 */
export function MotionSkeleton({
  width = '100%',
  height = 20,
  radius = 4,
  animate = true,
  circle = false,
  style = {}
}: SkeletonProps): React.ReactElement {
  const prefersReduced = useReducedMotion();
  const shouldAnimate = animate && !prefersReduced;

  const baseStyles: React.CSSProperties = {
    width: circle ? height : width,
    height,
    borderRadius: circle ? '50%' : radius,
    backgroundColor: 'var(--mantine-color-gray-3)',
    ...style
  };

  if (shouldAnimate) {
    return (
      <Box
        style={{
          ...baseStyles,
          background: `linear-gradient(
            90deg,
            var(--mantine-color-gray-3) 25%,
            var(--mantine-color-gray-2) 50%,
            var(--mantine-color-gray-3) 75%
          )`,
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s infinite'
        }} />);


  }

  return <Box style={baseStyles} />;
}

/**
 * Motion preference provider
 */
export function MotionPreferenceProvider({ children }: {children: React.ReactNode;}): React.ReactElement {
  const [_motionPreference, setMotionPreference] = useState<'no-preference' | 'reduce'>('no-preference');

  useEffect(() => {
    // Check initial preference
    setMotionPreference(prefersReducedMotion() ? 'reduce' : 'no-preference');

    // Listen for changes
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (e: MediaQueryListEvent): void => {
      setMotionPreference(e.matches ? 'reduce' : 'no-preference');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Add CSS for animations
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      
      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return <>{children}</>;
}

// Easing functions
export const easings = {
  linear: (t: number): number => t,
  easeInQuad: (t: number): number => t * t,
  easeOutQuad: (t: number): number => t * (2 - t),
  easeInOutQuad: (t: number): number => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t: number): number => t * t * t,
  easeOutCubic: (t: number): number => {
    const localT = t - 1;
    return localT * localT * localT + 1;
  },
  easeInOutCubic: (t: number): number => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
};