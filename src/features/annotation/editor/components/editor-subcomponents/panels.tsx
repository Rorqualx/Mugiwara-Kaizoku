/**
 * Panel Components
 *
 * URL annotations panel, brush mode wrapper, and clear labels button.
 */

import React from 'react';

import {
  ActionIcon,
  Text,
  Button,
  Group,
  Stack,
  Alert,
  Badge,
  Tooltip,
} from '@mantine/core';
import { IconX } from '@tabler/icons-react';

// ============================================================================
// UrlAnnotationsPanel
// ============================================================================

export interface UrlAnnotationsPanelProps {
  urlAnnotations: Array<{ label: string; url: string; text: string }>;
  onRemove: (label: string) => void;
}

export function UrlAnnotationsPanel({ urlAnnotations, onRemove }: UrlAnnotationsPanelProps): React.ReactElement {
  return (
    <Alert color="blue" title="URL Annotations" variant="light">
      <Stack gap="sm">
        {urlAnnotations.map((annotation) => (
          <div key={annotation.label} style={{
            background: 'var(--mantine-color-blue-light)',
            borderRadius: 'var(--mantine-radius-sm)',
            padding: '8px 12px',
            border: '1px solid var(--mantine-color-blue-3)',
          }}>
            <Group justify="space-between" wrap="nowrap" mb={4}>
              <Badge size="sm" color="blue" variant="filled">{annotation.label.replace(/_/g, ' ')}</Badge>
              <Tooltip label="Remove URL annotation">
                <ActionIcon size="xs" color="gray" variant="subtle" onClick={() => onRemove(annotation.label)}>
                  <IconX size={12} />
                </ActionIcon>
              </Tooltip>
            </Group>
            <Text size="xs" c="blue.7" truncate title={annotation.url} style={{ fontFamily: 'monospace' }}>
              {annotation.url}
            </Text>
            {annotation.text && (
              <Text size="xs" c="dimmed" fs="italic" mt={2}>Link text: {annotation.text}</Text>
            )}
          </div>
        ))}
      </Stack>
    </Alert>
  );
}

// ============================================================================
// BrushModeWrapper
// ============================================================================

export interface BrushModeWrapperProps {
  isActive: boolean;
  brushLabel?: string | null;
  children: React.ReactNode;
}

export function BrushModeWrapper({
  isActive: _isActive,
  brushLabel: _brushLabel,
  children,
}: BrushModeWrapperProps): React.ReactElement {
  // Visual indicator removed - brush mode is shown in toolbar/alerts instead
  return <>{children}</>;
}

// ============================================================================
// ClearLabelsButton
// ============================================================================

export interface ClearLabelsButtonProps {
  activeBrush: string | null;
  selectedCount: number;
  labeledCount: number;
  onClearSelection: () => void;
  onSetClearBrush: () => void;
  onUnlabelAll: () => void;
}

export function ClearLabelsButton({
  activeBrush,
  selectedCount,
  onClearSelection,
  onSetClearBrush,
  onUnlabelAll,
  labeledCount,
}: ClearLabelsButtonProps): React.ReactElement {
  return (
    <Group gap="xs">
      <Button
        size="xs"
        variant={activeBrush === 'CLEAR' ? 'filled' : 'light'}
        color="red"
        onClick={() => {
          if (selectedCount > 0) {
            onClearSelection();
          } else {
            onSetClearBrush();
          }
        }}
      >
        {activeBrush === 'CLEAR' ? '🖌️ Clear Mode Active' : 'Clear Label Mode'}
      </Button>
      {activeBrush === 'CLEAR' && (
        <Tooltip label="Remove all labels from all tokens" withArrow>
          <Button
            size="xs"
            variant="outline"
            color="red"
            onClick={onUnlabelAll}
            disabled={labeledCount === 0}
          >
            Unlabel All
          </Button>
        </Tooltip>
      )}
    </Group>
  );
}
