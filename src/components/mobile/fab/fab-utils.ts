/**
 * FAB Utility Functions
 * Position and size calculations
 */

import type { CSSProperties } from 'react';

export type FABPosition = 'bottom-right' | 'bottom-left' | 'bottom-center';
export type FABVariant = 'regular' | 'mini' | 'extended';

export interface FABOffset {
  x?: number;
  y?: number;
}

/**
 * Get position styles for FAB
 */
export function getFABPositionStyles(
  position: FABPosition,
  offset: FABOffset
): CSSProperties {
  const base: CSSProperties = {
    position: 'fixed',
    bottom: offset.y
  };

  switch (position) {
    case 'bottom-left':
      return { ...base, left: offset.x };
    case 'bottom-center':
      return { ...base, left: '50%', transform: 'translateX(-50%)' };
    case 'bottom-right':
    default:
      return { ...base, right: offset.x };
  }
}

/**
 * Get FAB size based on variant
 */
export function getFABSize(variant: FABVariant): number | 'auto' {
  switch (variant) {
    case 'mini':
      return 40;
    case 'extended':
      return 'auto';
    case 'regular':
    default:
      return 56;
  }
}
