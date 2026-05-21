/**
 * FAB State Management Hook
 * Manages speed dial and visibility state
 */

import { useState } from 'react';

import { useClickOutside } from '@mantine/hooks';

export interface UseFABStateOptions {
  /** Hide FAB on scroll */
  hideOnScroll?: boolean;
}

export interface UseFABStateReturn {
  /** Speed dial open state */
  speedDialOpen: boolean;
  /** Set speed dial open state */
  setSpeedDialOpen: (open: boolean) => void;
  /** FAB visibility state */
  isVisible: boolean;
  /** Set FAB visibility state */
  setIsVisible: (visible: boolean) => void;
  /** Click outside ref for closing speed dial */
  clickOutsideRef: React.RefObject<HTMLDivElement | null>;
}

export function useFABState(_options: UseFABStateOptions = {}): UseFABStateReturn {
  // Note: hideOnScroll option is reserved for future scroll-based visibility logic

  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // Click outside to close speed dial
  const clickOutsideRef = useClickOutside<HTMLDivElement>(() => {
    if (speedDialOpen) {
      setSpeedDialOpen(false);
    }
  });

  return {
    speedDialOpen,
    setSpeedDialOpen,
    isVisible,
    setIsVisible,
    clickOutsideRef
  };
}
