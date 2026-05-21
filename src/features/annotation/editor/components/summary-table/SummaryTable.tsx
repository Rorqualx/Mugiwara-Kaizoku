/**
 * Summary Table Component - Shows labeled entity spans with expandable details
 *
 * Bundles BIO tokens: B-tagged tokens are main rows, I-tagged tokens shown on expand
 */

import React, { useState, useEffect, useCallback } from 'react';

import {
  Stack,
  Paper,
} from '@mantine/core';

import type { EntityType } from '@/server/ml/features/bio-types';

import { TokenDetailModal } from '../TokenDetailModal';

import { groupIntoSpans, getSpanIndices, filterValidSelection } from './helpers';
import { SummaryEmptyState, SummaryToolbar, EntityCard } from './subcomponents';

import type { EntitySpan, SummaryTableProps } from './types';

export function SummaryTable({ tokens, onClearLabels }: SummaryTableProps): React.ReactElement {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());
  const [detailToken, setDetailToken] = useState<typeof tokens[0] | null>(null);
  const [modalOpened, setModalOpened] = useState(false);

  const grouped = groupIntoSpans(tokens);
  const entities = Array.from(grouped.keys()).sort();

  // Auto-expand all entities when the entity list changes
  const entitiesKey = entities.join(',');
  useEffect(() => {
    if (entitiesKey) {
      setExpandedEntities(new Set(entitiesKey.split(',')));
    }
  }, [entitiesKey]);

  useEffect(() => {
    setSelected((prev) => filterValidSelection(prev, tokens));
  }, [tokens]);

  const toggleSpanSelection = (span: EntitySpan): void => {
    const indices = getSpanIndices(span);
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = indices.every((i) => prev.has(i));
      if (allSelected) {
        indices.forEach((i) => next.delete(i));
      } else {
        indices.forEach((i) => next.add(i));
      }
      return next;
    });
  };

  const toggleExpand = (spanKey: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(spanKey)) next.delete(spanKey);
      else next.add(spanKey);
      return next;
    });
  };

  const toggleEntityExpand = (entity: string): void => {
    setExpandedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(entity)) next.delete(entity);
      else next.add(entity);
      return next;
    });
  };

  const toggleTokenSelection = (index: number): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAllEntity = (entity: EntityType): void => {
    const spans = grouped.get(entity) ?? [];
    const allIndices = spans.flatMap(getSpanIndices);
    setSelected((prev) => {
      const next = new Set(prev);
      allIndices.forEach((i) => next.add(i));
      return next;
    });
  };

  const deselectAllEntity = (entity: EntityType): void => {
    const spans = grouped.get(entity) ?? [];
    const allIndices = spans.flatMap(getSpanIndices);
    setSelected((prev) => {
      const next = new Set(prev);
      allIndices.forEach((i) => next.delete(i));
      return next;
    });
  };

  const deleteSelected = (): void => {
    onClearLabels?.(Array.from(selected));
    setSelected(new Set());
  };

  const deleteEntity = (entity: EntityType): void => {
    const spans = grouped.get(entity) ?? [];
    const allIndices = spans.flatMap(getSpanIndices);
    onClearLabels?.(allIndices);
  };

  const deleteSpan = (span: EntitySpan): void => {
    onClearLabels?.(getSpanIndices(span));
  };

  const handleTokenDetail = useCallback((tokenIndex: number): void => {
    const token = tokens.find((t) => t.index === tokenIndex);
    if (token) {
      setDetailToken(token);
      setModalOpened(true);
    }
  }, [tokens]);

  const closeModal = useCallback((): void => {
    setModalOpened(false);
  }, []);

  if (entities.length === 0) return <SummaryEmptyState />;

  return (
    <Paper withBorder p="md">
      <SummaryToolbar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        onDelete={deleteSelected}
        show={selected.size > 0 && !!onClearLabels}
      />
      <Stack gap="md">
        {entities.map((entity) => (
          <EntityCard
            key={entity}
            entity={entity}
            spans={grouped.get(entity) ?? []}
            selected={selected}
            expanded={expanded}
            entityExpanded={expandedEntities.has(entity)}
            onToggleSpan={toggleSpanSelection}
            onToggleExpand={toggleExpand}
            onToggleEntityExpand={() => toggleEntityExpand(entity)}
            onToggleToken={toggleTokenSelection}
            onSelectAll={() => selectAllEntity(entity)}
            onDeselectAll={() => deselectAllEntity(entity)}
            onDeleteEntity={onClearLabels ? () => deleteEntity(entity) : undefined}
            onDeleteSpan={onClearLabels ? deleteSpan : undefined}
            onTokenDetail={handleTokenDetail}
          />
        ))}
      </Stack>
      <TokenDetailModal opened={modalOpened} onClose={closeModal} token={detailToken} allTokens={tokens} />
    </Paper>
  );
}
