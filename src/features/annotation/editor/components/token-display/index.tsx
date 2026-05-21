/**
 * Token Display Module - Main component with search, filtering, and grouping
 */

import React, { useState } from 'react';

import { Paper, ScrollArea, Divider } from '@mantine/core';

import { FlowTokenView, GroupedTokenView } from './token-views';
import { TokenDisplayToolbar } from './toolbar';
import {
  filterTokensBySearch,
  filterTokensByView,
  computeTokenStats,
  type TokenViewMode,
  type TokenLayoutMode,
  type TokenDisplayProps,
} from './types';

export { TokenBadge } from './token-badges';
export { ImageToken } from './image-token';

export function TokenDisplay({
  tokens,
  onTokenClick,
  selectedTokens,
  suggestions = [],
  onAcceptSuggestion,
  onRejectSuggestion,
}: TokenDisplayProps): React.ReactElement {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<TokenViewMode>('all');
  const [layoutMode, setLayoutMode] = useState<TokenLayoutMode>('flow');

  const searchFiltered = filterTokensBySearch(tokens, search);
  const viewFiltered = filterTokensByView(searchFiltered, viewMode);
  const stats = computeTokenStats(tokens);

  return (
    <Paper withBorder p="md" style={{ minHeight: 400 }}>
      <TokenDisplayToolbar
        search={search}
        onSearchChange={setSearch}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        layoutMode={layoutMode}
        onLayoutModeChange={setLayoutMode}
        stats={stats}
        filteredCount={viewFiltered.length}
      />

      <Divider my="sm" />

      <ScrollArea h={450}>
        {layoutMode === 'grouped' ? (
          <GroupedTokenView
            tokens={viewFiltered}
            selectedTokens={selectedTokens}
            onTokenClick={onTokenClick}
            suggestions={suggestions}
            onAcceptSuggestion={onAcceptSuggestion}
            onRejectSuggestion={onRejectSuggestion}
          />
        ) : (
          <FlowTokenView
            tokens={viewFiltered}
            selectedTokens={selectedTokens}
            onTokenClick={onTokenClick}
            compact={layoutMode === 'compact'}
            suggestions={suggestions}
            onAcceptSuggestion={onAcceptSuggestion}
            onRejectSuggestion={onRejectSuggestion}
          />
        )}
      </ScrollArea>
    </Paper>
  );
}
