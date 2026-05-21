/**
 * Indicator Components
 *
 * Progress and action indicators for the annotation editor.
 */

import React, { useState, useEffect } from 'react';

import {
  Text,
  Button,
  Group,
  Stack,
  Alert,
  Badge,
  Transition,
  Progress,
} from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

// ============================================================================
// LastActionIndicator
// ============================================================================

export interface LastActionIndicatorProps {
  lastAction: { label: string; count: number; timestamp: number } | null;
}

export function LastActionIndicator({ lastAction }: LastActionIndicatorProps): React.ReactElement | null {
  const [visible, setVisible] = useState(false);

  // Show indicator when lastAction changes, hide after 2 seconds
  useEffect(() => {
    if (lastAction) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastAction]);

  if (!lastAction) return null;

  return (
    <Transition mounted={visible} transition="slide-down" duration={200}>
      {(styles) => (
        <Alert
          style={styles}
          color="green"
          variant="light"
          icon={<IconCheck size={18} />}
        >
          <Group gap="xs">
            <Badge color="green" variant="filled" size="lg">
              {lastAction.label}
            </Badge>
            <Text size="sm" fw={500}>
              applied to {lastAction.count} token{lastAction.count > 1 ? 's' : ''}
            </Text>
          </Group>
        </Alert>
      )}
    </Transition>
  );
}

// ============================================================================
// BatchProgressIndicator
// ============================================================================

export interface BatchProgress {
  total: number;
  completed: number;
  created: number;
  skipped: number;
  failed: number;
}

export interface BatchProgressIndicatorProps {
  progress: BatchProgress | null;
  isActive: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function BatchProgressIndicator({
  progress,
  isActive,
  onRetry,
  onDismiss,
}: BatchProgressIndicatorProps): React.ReactElement | null {
  if (!isActive || !progress) return null;

  const percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;
  const isComplete = progress.completed === progress.total;
  const hasErrors = progress.failed > 0;

  const alertProps = {
    color: hasErrors ? 'orange' : isComplete ? 'green' : 'blue',
    variant: 'light' as const,
    withCloseButton: isComplete && !!onDismiss,
    ...(onDismiss ? { onClose: onDismiss } : {}),
  };

  return (
    <Alert {...alertProps}>
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="sm" fw={500}>
            {isComplete ? 'Batch Import Complete' : 'Importing Pages...'}
          </Text>
          <Text size="sm" c="dimmed">
            {progress.completed}/{progress.total}
          </Text>
        </Group>
        <Progress value={percentage} animated={!isComplete} color={hasErrors ? 'orange' : 'blue'} />
        <Group gap="md">
          <Badge color="green" variant="light" size="sm">{progress.created} created</Badge>
          <Badge color="gray" variant="light" size="sm">{progress.skipped} skipped</Badge>
          {hasErrors && (
            <Badge color="red" variant="light" size="sm">{progress.failed} failed</Badge>
          )}
        </Group>
        {hasErrors && isComplete && onRetry && (
          <Button size="xs" variant="light" color="orange" onClick={onRetry}>
            Retry Failed
          </Button>
        )}
      </Stack>
    </Alert>
  );
}
