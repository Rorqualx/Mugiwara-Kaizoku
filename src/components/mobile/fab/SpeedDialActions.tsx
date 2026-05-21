/**
 * Speed Dial Actions Component
 * Renders the list of speed dial actions
 */

import React from 'react';
import type { JSX } from 'react';

import { Box, ActionIcon, Transition, Text } from '@mantine/core';

import { MotionSafe } from '@/components/performance/ReducedMotion';

import type { FABPosition, FABVariant } from './fab-utils';

export interface SpeedDialAction {
  /** Unique identifier */
  id: string;
  /** Action icon */
  icon: React.ReactNode;
  /** Action label */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Action color */
  color?: string;
  /** Disabled state */
  disabled?: boolean;
}

export interface SpeedDialActionsProps {
  /** Speed dial actions */
  actions: SpeedDialAction[];
  /** Speed dial open state */
  isOpen: boolean;
  /** FAB position */
  position: FABPosition;
  /** FAB variant */
  variant: FABVariant;
  /** Show labels */
  showLabels: boolean;
  /** On action click */
  onActionClick: () => void;
}

export function SpeedDialActions({
  actions,
  isOpen,
  position,
  variant,
  showLabels,
  onActionClick
}: SpeedDialActionsProps): JSX.Element {
  return (
    <Transition
      mounted={isOpen && actions.length > 0}
      duration={200}
      transition="fade">

      {(styles) =>
        <Box
          style={{
            ...styles,
            position: 'absolute',
            bottom: variant === 'mini' ? 56 : 72,
            right: position === 'bottom-left' ? 'auto' : 0,
            left: position === 'bottom-left' ? 0 : 'auto',
            display: 'flex',
            flexDirection: 'column-reverse',
            gap: 12,
            alignItems: position === 'bottom-left' ? 'flex-start' : 'flex-end'
          }}>

          {actions.map((action, index) =>
            <MotionSafe
              key={action.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexDirection: position === 'bottom-left' ? 'row' : 'row-reverse',
                opacity: 0,
                transform: 'translateY(20px)',
                animation: `fab-action-appear 0.2s ease-out ${index * 0.05}s forwards`
              }}>

              {showLabels &&
                <Box
                  style={{
                    backgroundColor: 'var(--mantine-color-body)',
                    padding: '4px 12px',
                    borderRadius: 'var(--mantine-radius-sm)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    whiteSpace: 'nowrap'
                  }}>

                  <Text size="sm">{action.label}</Text>
                </Box>
              }

              <ActionIcon
                size={40}
                radius="xl"
                color={action.color ?? 'gray'}
                variant="filled"
                disabled={action.disabled ?? false}
                onClick={() => {
                  action.onClick();
                  onActionClick();
                }}
                style={{
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                }}>

                {action.icon}
              </ActionIcon>
            </MotionSafe>
          )}
        </Box>
      }
    </Transition>
  );
}
