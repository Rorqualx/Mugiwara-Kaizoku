/**
 * Summary Table Sub-components
 */

import React from 'react';

import {
  Text,
  Button,
  Group,
  Card,
  Stack,
  Badge,
  Paper,
  Tooltip,
  Checkbox,
  ActionIcon,
  Collapse,
  Box,
} from '@mantine/core';
import { IconTrash, IconX, IconChevronDown, IconChevronRight } from '@tabler/icons-react';


import { ENTITY_COLORS } from '@/features/annotation/editor/types';
import type { DisplayToken } from '@/features/annotation/editor/types';
import type { EntityType } from '@/server/ml/features/bio-types';

import { getSpanIndices } from './helpers';

import type { EntitySpan } from './types';

// ============================================================================
// SummaryEmptyState
// ============================================================================

export function SummaryEmptyState(): React.ReactElement {
  return (
    <Paper withBorder p="xl" style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Stack align="center" gap="sm">
        <Text size="lg" c="dimmed">No labels yet</Text>
        <Text size="sm" c="dimmed">Label some tokens to see them here</Text>
      </Stack>
    </Paper>
  );
}

// ============================================================================
// SummaryToolbar
// ============================================================================

export function SummaryToolbar({ count, onClear, onDelete, show }: {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  show: boolean;
}): React.ReactElement | null {
  if (!show) return null;
  return (
    <Group justify="space-between" mb="sm" p="xs" bg="red.0" style={{ borderRadius: 4 }}>
      <Group gap="xs">
        <Badge color="red" variant="filled">{count} selected</Badge>
        <Button size="compact-xs" variant="subtle" color="gray" onClick={onClear}>Clear</Button>
      </Group>
      <Button size="compact-sm" color="red" leftSection={<IconTrash size={14} />} onClick={onDelete}>
        Delete Selected
      </Button>
    </Group>
  );
}

// ============================================================================
// EntityCard
// ============================================================================

export interface EntityCardProps {
  entity: EntityType;
  spans: EntitySpan[];
  selected: Set<number>;
  expanded: Set<string>;
  entityExpanded: boolean;
  onToggleSpan: (span: EntitySpan) => void;
  onToggleExpand: (key: string) => void;
  onToggleEntityExpand: () => void;
  onToggleToken: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleteEntity: (() => void) | undefined;
  onDeleteSpan: ((span: EntitySpan) => void) | undefined;
  onTokenDetail: (index: number) => void;
}

export function EntityCard({
  entity, spans, selected, expanded, entityExpanded, onToggleSpan, onToggleExpand, onToggleEntityExpand, onToggleToken,
  onSelectAll, onDeselectAll, onDeleteEntity, onDeleteSpan, onTokenDetail,
}: EntityCardProps): React.ReactElement {
  const color = ENTITY_COLORS[entity];
  const allIndices = spans.flatMap(getSpanIndices);
  const allSelected = allIndices.length > 0 && allIndices.every((i) => selected.has(i));
  const someSelected = allIndices.some((i) => selected.has(i));
  const totalTokens = allIndices.length;

  return (
    <Card withBorder p="sm">
      <Group justify="space-between" mb={entityExpanded ? 'xs' : 0}>
        <Group gap="xs">
          <Checkbox
            size="xs"
            checked={allSelected}
            indeterminate={someSelected && !allSelected}
            onChange={() => (allSelected ? onDeselectAll() : onSelectAll())}
          />
          <ActionIcon size="xs" variant="subtle" onClick={onToggleEntityExpand}>
            {entityExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </ActionIcon>
          <Badge color={color} size="md" variant="filled">{entity.replace(/_/g, ' ')}</Badge>
          <Badge color="gray" size="sm" variant="light">
            {spans.length} span{spans.length !== 1 ? 's' : ''} ({totalTokens} token{totalTokens !== 1 ? 's' : ''})
          </Badge>
        </Group>
        {onDeleteEntity && (
          <Tooltip label="Delete all" withArrow>
            <ActionIcon size="sm" variant="subtle" color="red" onClick={onDeleteEntity}>
              <IconX size={14} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      <Collapse in={entityExpanded}>
        <Stack gap={4}>
          {spans.map((span) => {
            const spanKey = `${entity}-${span.startIndex}`;
            return (
              <SpanRow
                key={spanKey}
                span={span}
                isExpanded={expanded.has(spanKey)}
                isSelected={getSpanIndices(span).every((i) => selected.has(i))}
                selected={selected}
                onToggleSelect={() => onToggleSpan(span)}
                onToggleExpand={() => onToggleExpand(spanKey)}
                onToggleToken={onToggleToken}
                onDelete={onDeleteSpan ? () => onDeleteSpan(span) : undefined}
                onTokenDetail={onTokenDetail}
              />
            );
          })}
        </Stack>
      </Collapse>
    </Card>
  );
}

// ============================================================================
// SpanRow
// ============================================================================

interface SpanRowProps {
  span: EntitySpan;
  isExpanded: boolean;
  isSelected: boolean;
  selected: Set<number>;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onToggleToken: (index: number) => void;
  onDelete: (() => void) | undefined;
  onTokenDetail: (index: number) => void;
}

function SpanRow({
  span, isExpanded, isSelected, selected, onToggleSelect, onToggleExpand, onToggleToken, onDelete, onTokenDetail,
}: SpanRowProps): React.ReactElement {
  const hasMultipleTokens = span.tokens.length > 1;

  return (
    <Box>
      <Group
        gap="xs"
        wrap="nowrap"
        p={4}
        style={{
          borderRadius: 4,
          cursor: 'pointer',
          background: isSelected ? 'var(--mantine-color-blue-0)' : undefined,
        }}
      >
        <Checkbox
          size="xs"
          checked={isSelected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
        />
        {hasMultipleTokens && (
          <ActionIcon size="xs" variant="subtle" onClick={onToggleExpand}>
            {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </ActionIcon>
        )}
        {!hasMultipleTokens && <Box w={22} />}
        <Badge size="xs" color="blue" variant="light" w={24}>B</Badge>
        <Tooltip label="Click for details" withArrow position="top">
          <Text
            size="sm"
            lineClamp={1}
            style={{ flex: 1, cursor: 'pointer' }}
            onClick={() => onTokenDetail(span.startIndex)}
            td="underline"
            c="blue"
          >
            {span.text}
          </Text>
        </Tooltip>
        <Badge size="xs" color="gray" variant="light">
          {span.tokens.length} token{span.tokens.length !== 1 ? 's' : ''}
        </Badge>
        {onDelete && (
          <ActionIcon size="xs" variant="subtle" color="red" onClick={onDelete}>
            <IconX size={12} />
          </ActionIcon>
        )}
      </Group>
      {hasMultipleTokens && (
        <Collapse in={isExpanded}>
          <Stack gap={2} pl={50} pt={4}>
            {span.tokens.map((token, idx) => (
              <TokenDetailRow
                key={token.index}
                token={token}
                prefix={idx === 0 ? 'B' : 'I'}
                isSelected={selected.has(token.index)}
                onToggleSelect={() => onToggleToken(token.index)}
                onDetail={() => onTokenDetail(token.index)}
              />
            ))}
          </Stack>
        </Collapse>
      )}
    </Box>
  );
}

// ============================================================================
// TokenDetailRow
// ============================================================================

function TokenDetailRow({ token, prefix, isSelected, onToggleSelect, onDetail }: {
  token: DisplayToken;
  prefix: 'B' | 'I';
  isSelected: boolean;
  onToggleSelect: () => void;
  onDetail: () => void;
}): React.ReactElement {
  return (
    <Group
      gap="xs"
      wrap="nowrap"
      p={2}
      style={{
        borderRadius: 4,
        background: isSelected ? 'var(--mantine-color-blue-0)' : undefined,
      }}
    >
      <Checkbox
        size="xs"
        checked={isSelected}
        onChange={onToggleSelect}
        onClick={(e) => e.stopPropagation()}
      />
      <Badge size="xs" color={prefix === 'B' ? 'blue' : 'cyan'} variant="light" w={24}>
        {prefix}
      </Badge>
      <Text
        size="xs"
        lineClamp={1}
        style={{ flex: 1, cursor: 'pointer' }}
        onClick={onDetail}
        c="dimmed"
      >
        {token.text}
      </Text>
      <Text size="xs" c="dimmed">#{token.index}</Text>
    </Group>
  );
}
