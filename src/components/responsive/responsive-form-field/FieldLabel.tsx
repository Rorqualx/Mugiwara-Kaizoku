/**
 * Field Label Component
 *
 * Displays form field label with required indicator and tooltip
 */

import type React from 'react';

import { Group, Text, Badge, Tooltip, Box } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

interface FieldLabelProps {
  label?: React.ReactNode;
  required?: boolean;
  showRequiredIndicator?: boolean;
  requiredText?: string;
  tooltip?: string | undefined;
  labelProps?: React.ComponentProps<typeof Text>;
  isMobile: boolean;
}

export function FieldLabel({
  label,
  required,
  showRequiredIndicator,
  requiredText,
  tooltip,
  labelProps,
  isMobile
}: FieldLabelProps): React.ReactElement | null {
  if (!label) return null;

  return (
    <Group gap="xs" align="center">
      <Text
        size={isMobile ? 'sm' : 'md'}
        fw={500}
        {...labelProps}
      >
        {label}
      </Text>

      {required && showRequiredIndicator && (
        <Badge
          size="xs"
          variant="light"
          color="red"
          style={{ textTransform: 'none' }}
        >
          {requiredText}
        </Badge>
      )}

      {tooltip && (
        <Tooltip
          label={tooltip}
          withArrow
          multiline
          maw={220}
          position={isMobile ? 'top' : 'top-start'}
        >
          <Box component="span" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <IconInfoCircle
              size={16}
              style={{ opacity: 0.6, cursor: 'help' }}
            />
          </Box>
        </Tooltip>
      )}
    </Group>
  );
}
