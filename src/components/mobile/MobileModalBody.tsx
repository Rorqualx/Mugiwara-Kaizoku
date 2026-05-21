import React from 'react';

import { Box } from '@mantine/core';

/**
 * Props for MobileModalBody component
 */
export interface MobileModalBodyProps {
  /** Modal content */
  children: React.ReactNode;
  /** Whether the modal is in full screen mode */
  isFullScreen?: boolean;
  /** Whether to use safe area padding */
  useSafeArea?: boolean;
  /** Safe area insets */
  safeAreaInsets?: { top: number; right: number; bottom: number; left: number };
}

/**
 * Mobile modal body component
 */
export function MobileModalBody({
  children,
  isFullScreen = false,
  useSafeArea = true,
  safeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 }
}: MobileModalBodyProps): React.ReactElement {
  return (
    <Box
      style={{
        flex: 1,
        overflow: 'auto' as const,
        padding: isFullScreen ? '16px' : 0,
        paddingBottom: isFullScreen && useSafeArea ? safeAreaInsets.bottom + 16 : undefined,
        WebkitOverflowScrolling: 'touch' as const
      }}
    >
      {children}
    </Box>
  );
}