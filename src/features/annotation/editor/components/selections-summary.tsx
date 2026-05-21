/**
 * Selections Summary Component - Shows text selections grouped by entity type
 *
 * For deferred tokenization: displays TextSelections instead of tokens
 * Selections will be tokenized at export time
 */

import React, { useState, useEffect } from 'react';

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
} from '@mantine/core';
import { IconTrash, IconX, IconChevronDown, IconChevronRight } from '@tabler/icons-react';

import type { EntityType } from '@/server/ml/features/bio-types';

import { ENTITY_COLORS } from '../types';

import { SelectionHealthBadge } from './SelectionHealthBadge';

import type { SelectionHealth } from '../page-view/selection-resolver';
import type { TextSelection } from '../types';

// ============================================================================
// Types
// ============================================================================

interface SelectionsSummaryProps {
  selections: TextSelection[];
  onRemoveSelection?: (selectionId: string) => void;
  onRemoveAllOfType?: (label: EntityType) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Groups selections by entity type
 */
function groupByEntity(selections: TextSelection[]): Map<EntityType, TextSelection[]> {
  const grouped = new Map<EntityType, TextSelection[]>();

  for (const selection of selections) {
    if (!grouped.has(selection.label)) {
      grouped.set(selection.label, []);
    }
    grouped.get(selection.label)?.push(selection);
  }

  return grouped;
}

/**
 * Determine selection health from recovery strategy
 */
function getHealthFromSelection(selection: TextSelection): SelectionHealth | null {
  const { recoveryStrategy } = selection;
  if (!recoveryStrategy) return null; // Not yet resolved

  switch (recoveryStrategy) {
    case 'xpath':
      return 'healthy';
    case 'context':
      return 'shifted';
    case 'global':
    case 'text-search':
      return 'stale';
    case 'manual':
      return 'broken';
    default:
      return null;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function SelectionsSummary({
  selections,
  onRemoveSelection,
  onRemoveAllOfType,
}: SelectionsSummaryProps): React.ReactElement {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());

  const grouped = groupByEntity(selections);
  const entities = Array.from(grouped.keys()).sort();

  // Auto-expand all entities when the entity list changes
  const entitiesKey = entities.join(',');
  useEffect(() => {
    if (entitiesKey) {
      setExpandedEntities(new Set(entitiesKey.split(',')));
    }
  }, [entitiesKey]);

  // Clear invalid selections when selections change
  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(selections.map((s) => s.id));
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
      }
      return next;
    });
  }, [selections]);

  const toggleEntityExpand = (entity: string): void => {
    setExpandedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(entity)) next.delete(entity);
      else next.add(entity);
      return next;
    });
  };

  const toggleSelectionSelect = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOfEntity = (entity: EntityType): void => {
    const entitySelections = grouped.get(entity) ?? [];
    setSelectedIds((prev) => {
      const next = new Set(prev);
      entitySelections.forEach((s) => next.add(s.id));
      return next;
    });
  };

  const deselectAllOfEntity = (entity: EntityType): void => {
    const entitySelections = grouped.get(entity) ?? [];
    setSelectedIds((prev) => {
      const next = new Set(prev);
      entitySelections.forEach((s) => next.delete(s.id));
      return next;
    });
  };

  const deleteSelected = (): void => {
    if (!onRemoveSelection) return;
    for (const id of selectedIds) {
      onRemoveSelection(id);
    }
    setSelectedIds(new Set());
  };

  if (entities.length === 0) return <SelectionsEmptyState />;

  return (
    <Paper withBorder p="md">
      <Group justify="space-between" mb="sm">
        <Text fw={600} size="sm">Text Selections</Text>
        <Badge color="blue" variant="light">
          {selections.length} selection{selections.length !== 1 ? 's' : ''}
        </Badge>
      </Group>
      <SelectionsToolbar
        count={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        onDelete={deleteSelected}
        show={selectedIds.size > 0 && !!onRemoveSelection}
      />
      <Stack gap="md">
        {entities.map((entity) => (
          <EntitySelectionCard
            key={entity}
            entity={entity}
            selections={grouped.get(entity) ?? []}
            selectedIds={selectedIds}
            entityExpanded={expandedEntities.has(entity)}
            onToggleEntityExpand={() => toggleEntityExpand(entity)}
            onToggleSelection={toggleSelectionSelect}
            onSelectAll={() => selectAllOfEntity(entity)}
            onDeselectAll={() => deselectAllOfEntity(entity)}
            onDeleteEntity={onRemoveAllOfType ? () => onRemoveAllOfType(entity) : undefined}
            onDeleteSelection={onRemoveSelection}
          />
        ))}
      </Stack>
    </Paper>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function SelectionsEmptyState(): React.ReactElement {
  return (
    <Paper withBorder p="xl" style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Stack align="center" gap="sm">
        <Text size="lg" c="dimmed">No selections yet</Text>
        <Text size="sm" c="dimmed">Use selection tools to annotate content</Text>
      </Stack>
    </Paper>
  );
}

function SelectionsToolbar({ count, onClear, onDelete, show }: {
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

interface EntitySelectionCardProps {
  entity: EntityType;
  selections: TextSelection[];
  selectedIds: Set<string>;
  entityExpanded: boolean;
  onToggleEntityExpand: () => void;
  onToggleSelection: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleteEntity: (() => void) | undefined;
  onDeleteSelection: ((id: string) => void) | undefined;
}

function EntitySelectionCard({
  entity,
  selections,
  selectedIds,
  entityExpanded,
  onToggleEntityExpand,
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
  onDeleteEntity,
  onDeleteSelection,
}: EntitySelectionCardProps): React.ReactElement {
  const color = ENTITY_COLORS[entity];
  const allSelected = selections.length > 0 && selections.every((s) => selectedIds.has(s.id));
  const someSelected = selections.some((s) => selectedIds.has(s.id));

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
            {selections.length} selection{selections.length !== 1 ? 's' : ''}
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
          {selections.map((selection) => (
            <SelectionRow
              key={selection.id}
              selection={selection}
              isSelected={selectedIds.has(selection.id)}
              onToggleSelect={() => onToggleSelection(selection.id)}
              onDelete={onDeleteSelection ? () => onDeleteSelection(selection.id) : undefined}
            />
          ))}
        </Stack>
      </Collapse>
    </Card>
  );
}

interface SelectionRowProps {
  selection: TextSelection;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDelete: (() => void) | undefined;
}

function SelectionRow({
  selection,
  isSelected,
  onToggleSelect,
  onDelete,
}: SelectionRowProps): React.ReactElement {
  const isImage = selection.isImage;
  const displayText = isImage ? `[Image: ${selection.imageAlt ?? selection.imageSrc ?? 'unknown'}]` : selection.text;
  const health = getHealthFromSelection(selection);

  return (
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
      {isImage && (
        <Badge size="xs" color="pink" variant="light">IMG</Badge>
      )}
      {health && (
        <SelectionHealthBadge health={health} compact />
      )}
      <Tooltip label={displayText} withArrow position="top" multiline maw={300}>
        <Text
          size="sm"
          lineClamp={1}
          style={{ flex: 1 }}
        >
          {displayText}
        </Text>
      </Tooltip>
      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
        {new Date(selection.createdAt).toLocaleTimeString()}
      </Text>
      {onDelete && (
        <ActionIcon size="xs" variant="subtle" color="red" onClick={onDelete}>
          <IconX size={12} />
        </ActionIcon>
      )}
    </Group>
  );
}
