/**
 * Responsive Form Section Component
 *
 * Groups related form fields with optional collapsibility on mobile
 */

import React, { useState } from 'react';

import { Box, Group, Stack, Text } from '@mantine/core';

import { useBreakpoint } from '@/hooks/mobile';

import type { ResponsiveFormSectionProps } from './types';

export function ResponsiveFormSection({
  title,
  description,
  children,
  collapsibleOnMobile = false,
  defaultCollapsed = false,
  spacing = 'md'
}: ResponsiveFormSectionProps): React.ReactElement {
  const { isMobile } = useBreakpoint();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const canCollapse = isMobile && collapsibleOnMobile;

  return (
    <Stack gap={spacing}>
      {title && (
        <Box
          onClick={canCollapse ? () => setCollapsed(!collapsed) : undefined}
          style={{ cursor: canCollapse ? 'pointer' : 'default' }}
        >
          <Group justify="space-between">
            <Text size={isMobile ? 'md' : 'lg'} fw={600}>
              {title}
            </Text>
            {canCollapse && (
              <Text size="sm" c="dimmed">
                {collapsed ? 'Tap to expand' : 'Tap to collapse'}
              </Text>
            )}
          </Group>

          {description && !collapsed && (
            <Text size={isMobile ? 'xs' : 'sm'} c="dimmed" mt={4}>
              {description}
            </Text>
          )}
        </Box>
      )}

      {!collapsed && (
        <Stack gap={isMobile ? 'sm' : 'md'}>
          {children}
        </Stack>
      )}
    </Stack>
  );
}
