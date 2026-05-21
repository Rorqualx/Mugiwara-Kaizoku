import React from 'react';

import { Box, Group, ActionIcon, Text } from '@mantine/core';
import { IconX, IconChevronLeft } from '@tabler/icons-react';


import { useBreakpoint } from '@/hooks/mobile';

/**
 * Props for MobileModalHeader component
 */
export interface MobileModalHeaderProps {
  /** Custom header component */
  header?: React.ReactNode;
  /** Header title */
  headerTitle?: string | undefined;
  /** Whether to show back button */
  showBackButton?: boolean;
  /** Whether to use safe area padding */
  useSafeArea?: boolean;
  /** Safe area insets */
  safeAreaInsets?: { top: number; right: number; bottom: number; left: number };
  /** Whether to show close button */
  withCloseButton?: boolean;
  /** Back button click handler */
  onBack?: (() => void) | undefined;
  /** Close button click handler */
  onClose?: (() => void) | undefined;
}

/**
 * Mobile modal header component
 */
export function MobileModalHeader({
  header,
  headerTitle,
  showBackButton = false,
  useSafeArea = true,
  safeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 },
  withCloseButton = true,
  onBack,
  onClose
}: MobileModalHeaderProps): React.ReactElement | null {
  const { isMobile } = useBreakpoint();

  if (header) {
    return <>{header}</>;
  }

  if (!headerTitle && !showBackButton) {
    return null;
  }

  return (
    <Box
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--mantine-color-gray-2)',
        backgroundColor: 'var(--mantine-color-body)',
        position: 'sticky' as const,
        top: 0,
        zIndex: 10,
        paddingTop: useSafeArea ? safeAreaInsets.top + 12 : 12
      }}
    >
      <Group justify="space-between">
        <Group>
          {showBackButton && (
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={onBack ?? onClose}
            >
              <IconChevronLeft size={20} />
            </ActionIcon>
          )}
          {headerTitle && (
            <Text fw={500} size={isMobile ? 'md' : 'lg'}>
              {headerTitle}
            </Text>
          )}
        </Group>

        {!showBackButton && withCloseButton && (
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={onClose}
          >
            <IconX size={20} />
          </ActionIcon>
        )}
      </Group>
    </Box>
  );
}