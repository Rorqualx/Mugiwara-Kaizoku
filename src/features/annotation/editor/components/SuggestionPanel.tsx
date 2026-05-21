/**
 * SuggestionPanel - Displays label suggestions for review
 *
 * Shows AI-generated label suggestions grouped by entity type,
 * allowing users to accept/reject suggestions before they're applied.
 */

import React, { useCallback } from 'react';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Collapse,
  CopyButton,
  Group,
  Progress,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconExternalLink,
  IconInfoCircle,
  IconX,
} from '@tabler/icons-react';

import { isEntityType } from '@/server/ml/features/bio-types';

import { ENTITY_COLORS } from '../types';

// ============================================================================
// Types
// ============================================================================

/** Preview data showing context and token metadata */
export interface SuggestionPreview {
  /** Text from surrounding tokens before the suggestion */
  contextBefore: string;
  /** Text from surrounding tokens after the suggestion */
  contextAfter: string;
  /** Link href if the token is a link */
  linkHref: string | null;
  /** Whether the token is a link */
  isLink: boolean;
  /** HTML tag name of the token */
  tagName: string;
  /** CSS classes on the token's element */
  classes: string[];
  /** Section type (infobox, main_content, etc.) */
  sectionType: string;
}

export interface Suggestion {
  id: string;
  tokenIndices: number[];
  entityType: string;
  confidence: number;
  source: string;
  reasoning: string;
  text: string;
  ruleId?: string;
  /** Preview data with context and token metadata */
  preview?: SuggestionPreview;
}

interface SuggestionPanelProps {
  suggestions: Suggestion[];
  autoAppliedCount: number;
  pendingReviewCount: number;
  onAccept: (suggestionId: string) => void;
  onReject: (suggestionId: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  isLoading?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getEntityColor(entityType: string): string {
  return isEntityType(entityType) ? ENTITY_COLORS[entityType] : 'gray';
}

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'green';
  if (confidence >= 0.7) return 'blue';
  if (confidence >= 0.5) return 'yellow';
  return 'orange';
}

function formatEntityType(entityType: string): string {
  return entityType
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function groupByEntity(suggestions: Suggestion[]): Map<string, Suggestion[]> {
  const grouped = new Map<string, Suggestion[]>();
  for (const s of suggestions) {
    const existing = grouped.get(s.entityType) ?? [];
    existing.push(s);
    grouped.set(s.entityType, existing);
  }
  return grouped;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Preview panel showing context, link, and token metadata
 */
function SuggestionPreviewPanel({
  preview,
  suggestionText,
}: {
  preview: SuggestionPreview;
  suggestionText: string;
}): React.ReactElement {
  const hasContext = preview.contextBefore || preview.contextAfter;

  return (
    <Stack
      gap="xs"
      p="xs"
      style={{
        borderTop: '1px solid var(--mantine-color-dark-4)',
        backgroundColor: 'var(--mantine-color-dark-7)',
      }}
    >
      {/* Context section */}
      {hasContext && (
        <Box>
          <Text size="xs" c="dimmed" mb={4}>
            Context:
          </Text>
          <Text size="xs" style={{ fontFamily: 'monospace' }}>
            {preview.contextBefore && (
              <Text component="span" c="dimmed">
                &quot;{preview.contextBefore}&quot;{' '}
              </Text>
            )}
            <Text component="span" c="dimmed">
              →{' '}
            </Text>
            <Text component="span" fw={600} c="yellow">
              [{suggestionText}]
            </Text>
            <Text component="span" c="dimmed">
              {' '}→
            </Text>
            {preview.contextAfter && (
              <Text component="span" c="dimmed">
                {' '}&quot;{preview.contextAfter}&quot;
              </Text>
            )}
          </Text>
        </Box>
      )}

      {/* Link URL section */}
      {preview.isLink && preview.linkHref && (
        <Group gap="xs" wrap="nowrap">
          <IconExternalLink size={12} color="var(--mantine-color-blue-5)" />
          <Text
            size="xs"
            c="blue"
            style={{
              fontFamily: 'monospace',
              wordBreak: 'break-all',
              flex: 1,
            }}
          >
            {preview.linkHref}
          </Text>
          <CopyButton value={preview.linkHref}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? 'Copied!' : 'Copy URL'}>
                <ActionIcon
                  size="xs"
                  color={copied ? 'teal' : 'gray'}
                  variant="subtle"
                  onClick={copy}
                >
                  <IconCopy size={12} />
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        </Group>
      )}

      {/* Token metadata section */}
      <Group gap={4}>
        <Badge size="xs" variant="outline" color="gray">
          &lt;{preview.tagName}&gt;
        </Badge>
        {preview.sectionType !== 'unknown' && (
          <Badge size="xs" variant="dot" color="cyan">
            {preview.sectionType}
          </Badge>
        )}
      </Group>

      {/* Classes (collapsible if many) */}
      {preview.classes.length > 0 && (
        <Box>
          <Text size="xs" c="dimmed">
            Classes:{' '}
            <Text component="span" size="xs" style={{ fontFamily: 'monospace' }}>
              {preview.classes.slice(0, 3).join(', ')}
              {preview.classes.length > 3 && ` +${preview.classes.length - 3} more`}
            </Text>
          </Text>
        </Box>
      )}
    </Stack>
  );
}

function SuggestionItem({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: Suggestion;
  onAccept: () => void;
  onReject: () => void;
}): React.ReactElement {
  const [expanded, { toggle }] = useDisclosure(true);
  const confidenceColor = getConfidenceColor(suggestion.confidence);
  const hasPreview = Boolean(suggestion.preview);

  const handleAccept = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onAccept();
    },
    [onAccept]
  );

  const handleReject = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onReject();
    },
    [onReject]
  );

  return (
    <Box
      style={{
        borderRadius: 'var(--mantine-radius-sm)',
        backgroundColor: 'var(--mantine-color-dark-6)',
        cursor: hasPreview ? 'pointer' : 'default',
        transition: 'background-color 150ms ease',
      }}
      onClick={hasPreview ? toggle : undefined}
    >
      <Box p="xs">
        <Stack gap={6}>
          {/* Value row with confidence and actions */}
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
              {hasPreview && (
                expanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />
              )}
              <Badge
                size="xs"
                color={confidenceColor}
                variant="filled"
                style={{ flexShrink: 0 }}
              >
                {formatConfidence(suggestion.confidence)}
              </Badge>
              <Text size="sm" fw={500} style={{ wordBreak: 'break-word' }}>
                {suggestion.text}
              </Text>
            </Group>
            <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
              <Tooltip label="Accept">
                <ActionIcon size="xs" color="green" variant="light" onClick={handleAccept}>
                  <IconCheck size={12} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Reject">
                <ActionIcon size="xs" color="red" variant="light" onClick={handleReject}>
                  <IconX size={12} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
          {/* Reasoning row */}
          <Tooltip label={suggestion.reasoning} multiline maw={280} position="left">
            <Group gap={4} wrap="nowrap" style={{ cursor: 'help' }}>
              <IconInfoCircle size={10} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
              <Text size="xs" c="dimmed" lineClamp={1}>
                {suggestion.reasoning}
              </Text>
            </Group>
          </Tooltip>
        </Stack>
      </Box>

      {/* Expandable preview panel */}
      {hasPreview && suggestion.preview && (
        <Collapse in={expanded}>
          <SuggestionPreviewPanel
            preview={suggestion.preview}
            suggestionText={suggestion.text}
          />
        </Collapse>
      )}
    </Box>
  );
}

function EntityGroup({
  entityType,
  suggestions,
  onAccept,
  onReject,
}: {
  entityType: string;
  suggestions: Suggestion[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}): React.ReactElement {
  const [opened, { toggle }] = useDisclosure(true);
  const color = getEntityColor(entityType);

  return (
    <Box>
      <Group
        gap="xs"
        onClick={toggle}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        py={4}
      >
        {opened ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        <Badge color={color} variant="light" size="sm">
          {formatEntityType(entityType)}
        </Badge>
        <Text size="xs" c="dimmed">
          ({suggestions.length})
        </Text>
      </Group>
      <Collapse in={opened}>
        <Stack gap={6} pl="sm" pb="xs">
          {suggestions.map((s) => (
            <SuggestionItem
              key={s.id}
              suggestion={s}
              onAccept={() => onAccept(s.id)}
              onReject={() => onReject(s.id)}
            />
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SuggestionPanel({
  suggestions,
  autoAppliedCount,
  pendingReviewCount,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
  isLoading = false,
}: SuggestionPanelProps): React.ReactElement {
  const groupedSuggestions = groupByEntity(suggestions);
  const totalSuggestions = suggestions.length;

  if (totalSuggestions === 0) {
    return (
      <Stack gap="sm">
        <Text fw={600} size="sm">Label Suggestions</Text>
        <Text c="dimmed" ta="center" size="xs" py="md">
          No suggestions available
        </Text>
      </Stack>
    );
  }

  const reviewedPercent = totalSuggestions > 0
    ? Math.round((autoAppliedCount / totalSuggestions) * 100)
    : 0;

  return (
    <Stack gap="sm">
      {/* Header */}
      <Group justify="space-between">
        <Text fw={600} size="sm">Label Suggestions</Text>
        <Badge variant="filled" color="yellow" size="sm">
          {pendingReviewCount} PENDING
        </Badge>
      </Group>

      {/* Progress */}
      <Box>
        <Group justify="space-between" mb={4}>
          <Text size="xs" c="dimmed">
            {autoAppliedCount} auto-applied / {totalSuggestions} total
          </Text>
          <Text size="xs" fw={500}>
            {reviewedPercent}%
          </Text>
        </Group>
        <Progress value={reviewedPercent} size="xs" color="green" />
      </Box>

      {/* Bulk Actions */}
      <Stack gap={6}>
        <Button
          size="xs"
          variant="light"
          color="green"
          leftSection={<IconCheck size={12} />}
          onClick={onAcceptAll}
          disabled={isLoading || pendingReviewCount === 0}
          fullWidth
        >
          Accept All ({pendingReviewCount})
        </Button>
        <Button
          size="xs"
          variant="subtle"
          color="red"
          leftSection={<IconX size={12} />}
          onClick={onRejectAll}
          disabled={isLoading || pendingReviewCount === 0}
          fullWidth
        >
          Reject All
        </Button>
      </Stack>

      {/* Suggestion List */}
      <Stack gap="xs">
        {Array.from(groupedSuggestions.entries()).map(([entityType, entitySuggestions]) => (
          <EntityGroup
            key={entityType}
            entityType={entityType}
            suggestions={entitySuggestions}
            onAccept={onAccept}
            onReject={onReject}
          />
        ))}
      </Stack>
    </Stack>
  );
}
