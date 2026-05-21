/**
 * Main FAB Button Component
 * Renders the main floating action button (extended or regular)
 */

import React from 'react';
import type { JSX } from 'react';

import { Button, ActionIcon } from '@mantine/core';
import { IconX } from '@tabler/icons-react';

import { getFABSize } from './fab-utils';

import type { FABVariant } from './fab-utils';

export interface MainFABButtonProps {
  /** FAB variant */
  variant: FABVariant;
  /** FAB color */
  color: string;
  /** Button label (for extended variant) */
  label?: string | undefined;
  /** Button icon */
  icon: React.ReactNode;
  /** Speed dial open state */
  speedDialOpen: boolean;
  /** Has speed dial actions */
  hasActions: boolean;
  /** Disabled state */
  disabled: boolean;
  /** Click handler */
  onClick: () => void;
}

export function MainFABButton({
  variant,
  color,
  label,
  icon,
  speedDialOpen,
  hasActions,
  disabled,
  onClick
}: MainFABButtonProps): JSX.Element {
  const displayIcon = speedDialOpen && hasActions ? <IconX size={20} /> : icon;

  if (variant === 'extended') {
    return (
      <Button
        size="lg"
        radius="xl"
        color={color}
        disabled={disabled}
        onClick={onClick}
        leftSection={displayIcon}
        style={{
          height: 48,
          boxShadow: '0 3px 12px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.3s ease'
        }}>

        {label}
      </Button>
    );
  }

  return (
    <ActionIcon
      size={getFABSize(variant)}
      radius="xl"
      color={color}
      variant="filled"
      disabled={disabled}
      onClick={onClick}
      aria-label="Floating action button"
      style={{
        boxShadow: '0 3px 12px rgba(0, 0, 0, 0.2)',
        transition: 'all 0.3s ease',
        transform: speedDialOpen ? 'rotate(45deg)' : 'rotate(0deg)'
      }}>

      {speedDialOpen && hasActions ? <IconX size={24} /> : icon}
    </ActionIcon>
  );
}
