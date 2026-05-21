/**
 * Token View Components - Flow, Grouped, and Empty State
 *
 * Key feature: Adjacent tokens with the same label are merged into single
 * visual "span" blocks for better readability (e.g., a 200-word synopsis
 * shows as one block, not 200 separate badges).
 */

import React from 'react';

import { Text, Group, Card, Stack, Badge, Box, Tooltip } from '@mantine/core';

import { ENTITY_COLORS, type DisplayToken } from '@/features/annotation/editor/types';
import { isEntityType, type EntityType } from '@/server/ml/features/bio-types';

import { TokenSuggestionBadge, getSuggestionForToken } from '../TokenSuggestionBadge';

import { ImageToken } from './image-token';
import { TokenBadge, CompactTokenBadge, getTokenColor } from './token-badges';

import type { Suggestion } from '../SuggestionPanel';

/**
 * Represents a merged span of adjacent tokens with the same entity label.
 * Used to display contiguous labeled text (like synopsis) as a single block.
 */
interface TokenSpan {
  entity: EntityType;
  tokens: DisplayToken[];
  text: string;
  startIndex: number;
}

/**
 * Represents either an individual unlabeled token or a merged span.
 */
type RenderItem =
  | { type: 'token'; token: DisplayToken }
  | { type: 'span'; span: TokenSpan };

/** Check if token is consecutive with last token in span */
function isTokenConsecutive(span: TokenSpan | null, token: DisplayToken): boolean {
  if (!span || span.tokens.length === 0) return false;
  const lastToken = span.tokens[span.tokens.length - 1];
  return lastToken !== undefined && token.index === lastToken.index + 1;
}

/** Finalize span and add to items list */
function finalizeSpan(items: RenderItem[], span: TokenSpan | null): void {
  if (span) items.push({ type: 'span', span });
}

/**
 * Groups adjacent labeled tokens into spans while keeping unlabeled tokens separate.
 * This allows synopsis/summary text to display as one block instead of 200 word badges.
 *
 * Handles both correct BIO format (B-ENTITY, I-ENTITY) and incorrectly formatted
 * data where every token has B- prefix (consecutive B- tags for same entity merge).
 */
function groupTokensIntoRenderItems(tokens: DisplayToken[]): RenderItem[] {
  const items: RenderItem[] = [];
  let currentSpan: TokenSpan | null = null;

  for (const token of tokens) {
    // Image tokens are always rendered individually
    if (token.isImage) {
      finalizeSpan(items, currentSpan);
      currentSpan = null;
      items.push({ type: 'token', token });
      continue;
    }

    // Unlabeled tokens are rendered individually
    if (token.label === 'O') {
      finalizeSpan(items, currentSpan);
      currentSpan = null;
      items.push({ type: 'token', token });
      continue;
    }

    const prefix = token.label.charAt(0);
    const entity = token.label.substring(2) as EntityType;
    const isSameEntity = currentSpan !== null && currentSpan.entity === entity;
    const shouldContinue = isSameEntity && isTokenConsecutive(currentSpan, token);

    if (prefix === 'B' && shouldContinue && currentSpan) {
      // Same entity AND consecutive - continue span (handles B-B-B data)
      currentSpan.tokens.push(token);
      currentSpan.text += ' ' + token.text;
    } else if (prefix === 'B') {
      // Start a new span
      finalizeSpan(items, currentSpan);
      currentSpan = { entity, tokens: [token], text: token.text, startIndex: token.index };
    } else if (prefix === 'I' && isSameEntity && currentSpan) {
      // Continue current span (standard BIO format)
      currentSpan.tokens.push(token);
      currentSpan.text += ' ' + token.text;
    } else if (prefix === 'I') {
      // I without matching B - treat as new span
      finalizeSpan(items, currentSpan);
      currentSpan = { entity, tokens: [token], text: token.text, startIndex: token.index };
    }
  }

  finalizeSpan(items, currentSpan);
  return items;
}

/**
 * SpanBadge - Displays a merged span of tokens as a single badge.
 * Shows truncated text with full text in tooltip.
 */
interface SpanBadgeProps {
  span: TokenSpan;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  compact?: boolean;
}

function SpanBadge({ span, isSelected, onClick, compact = false }: SpanBadgeProps): React.ReactElement {
  const color = getTokenColor(`B-${span.entity}`);
  const maxLen = compact ? 50 : 100;
  const displayText = span.text.length > maxLen
    ? span.text.substring(0, maxLen) + '…'
    : span.text;

  const tooltipContent = (
    <Stack gap={4}>
      <Group gap="xs">
        <Badge size="xs" color={color} variant="filled">
          {span.entity.replace(/_/g, ' ')}
        </Badge>
        <Text size="xs" c="dimmed">
          {span.tokens.length} tokens (#{span.startIndex}–#{span.tokens[span.tokens.length - 1]?.index ?? span.startIndex})
        </Text>
      </Group>
      <Text size="xs" c="white" style={{ maxWidth: 300, whiteSpace: 'pre-wrap' }}>
        {span.text.length > 500 ? span.text.substring(0, 500) + '…' : span.text}
      </Text>
    </Stack>
  );

  return (
    <Tooltip label={tooltipContent} position="top" withArrow multiline w={320}>
      <Badge
        color={color}
        variant={isSelected ? 'filled' : 'light'}
        size={compact ? 'sm' : 'md'}
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          outline: isSelected ? '2px solid var(--mantine-color-blue-5)' : undefined,
          maxWidth: compact ? 200 : 400,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        onClick={onClick}
        leftSection={<Text size="xs" fw={700}>B</Text>}
      >
        {displayText}
      </Badge>
    </Tooltip>
  );
}

export function TokenEmptyState(): React.ReactElement {
  return (
    <Box p="xl" ta="center">
      <Text c="dimmed">No tokens match the current filters</Text>
    </Box>
  );
}

/** Creates suggestion handlers for a token/span */
function createSuggestionHandlers(
  suggestion: Suggestion | null | undefined,
  onAccept?: (id: string) => void,
  onReject?: (id: string) => void,
): { handleAccept: (() => void) | undefined; handleReject: (() => void) | undefined } {
  return {
    handleAccept: suggestion && onAccept ? () => onAccept(suggestion.id) : undefined,
    handleReject: suggestion && onReject ? () => onReject(suggestion.id) : undefined,
  };
}

/** Renders a single token element based on type and compact mode */
function renderSingleToken(
  token: DisplayToken,
  isSelected: boolean,
  onClick: (e: React.MouseEvent) => void,
  compact: boolean,
): React.ReactElement {
  if (token.isImage) {
    return <ImageToken token={token} isSelected={isSelected} onClick={onClick} />;
  }
  return compact
    ? <CompactTokenBadge token={token} isSelected={isSelected} onClick={onClick} />
    : <TokenBadge token={token} isSelected={isSelected} onClick={onClick} />;
}

interface FlowTokenViewProps {
  tokens: DisplayToken[];
  selectedTokens: Set<number>;
  onTokenClick: (index: number, shiftKey: boolean) => void;
  compact: boolean;
  suggestions?: Suggestion[] | undefined;
  onAcceptSuggestion?: ((suggestionId: string) => void) | undefined;
  onRejectSuggestion?: ((suggestionId: string) => void) | undefined;
}

export function FlowTokenView({
  tokens,
  selectedTokens,
  onTokenClick,
  compact,
  suggestions = [],
  onAcceptSuggestion,
  onRejectSuggestion,
}: FlowTokenViewProps): React.ReactElement {
  if (tokens.length === 0) return <TokenEmptyState />;

  const renderItems = groupTokensIntoRenderItems(tokens);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: compact ? 2 : 4, alignItems: 'flex-start' }}>
      {renderItems.map((item) => {
        if (item.type === 'span') {
          const { span } = item;
          const isAnySelected = span.tokens.some((t) => selectedTokens.has(t.index));
          const firstToken = span.tokens[0];
          const suggestion = firstToken ? getSuggestionForToken(firstToken.index, suggestions) : null;
          const { handleAccept, handleReject } = createSuggestionHandlers(suggestion, onAcceptSuggestion, onRejectSuggestion);
          const handleClick = (e: React.MouseEvent): void => { if (firstToken) onTokenClick(firstToken.index, e.shiftKey); };

          return (
            <TokenSuggestionBadge key={`span-${span.startIndex}`} suggestion={suggestion} onAccept={handleAccept} onReject={handleReject}>
              <SpanBadge span={span} isSelected={isAnySelected} onClick={handleClick} compact={compact} />
            </TokenSuggestionBadge>
          );
        }

        const { token } = item;
        const tokenSuggestion = getSuggestionForToken(token.index, suggestions);
        const { handleAccept, handleReject } = createSuggestionHandlers(tokenSuggestion, onAcceptSuggestion, onRejectSuggestion);
        const handleClick = (e: React.MouseEvent): void => onTokenClick(token.index, e.shiftKey);

        return (
          <TokenSuggestionBadge key={token.id} suggestion={tokenSuggestion} onAccept={handleAccept} onReject={handleReject}>
            {renderSingleToken(token, selectedTokens.has(token.index), handleClick, compact)}
          </TokenSuggestionBadge>
        );
      })}
    </div>
  );
}

interface GroupedTokenViewProps {
  tokens: DisplayToken[];
  selectedTokens: Set<number>;
  onTokenClick: (index: number, shiftKey: boolean) => void;
  suggestions?: Suggestion[] | undefined;
  onAcceptSuggestion?: ((suggestionId: string) => void) | undefined;
  onRejectSuggestion?: ((suggestionId: string) => void) | undefined;
}

function groupTokensByEntity(tokens: DisplayToken[]): Map<string, DisplayToken[]> {
  const groups = new Map<string, DisplayToken[]>();
  groups.set('Unlabeled', []);

  for (const token of tokens) {
    if (token.label === 'O') {
      groups.get('Unlabeled')?.push(token);
    } else {
      const entity = token.label.substring(2);
      if (!groups.has(entity)) groups.set(entity, []);
      groups.get(entity)?.push(token);
    }
  }

  if (groups.get('Unlabeled')?.length === 0) groups.delete('Unlabeled');
  return groups;
}

export function GroupedTokenView({
  tokens,
  selectedTokens,
  onTokenClick,
  suggestions = [],
  onAcceptSuggestion,
  onRejectSuggestion,
}: GroupedTokenViewProps): React.ReactElement {
  const groups = groupTokensByEntity(tokens);

  if (groups.size === 0) return <TokenEmptyState />;

  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === 'Unlabeled') return 1;
    if (b === 'Unlabeled') return -1;
    return a.localeCompare(b);
  });

  return (
    <Stack gap="md">
      {sortedKeys.map((entity) => (
        <TokenGroupCard
          key={entity}
          entity={entity}
          tokens={groups.get(entity) ?? []}
          selectedTokens={selectedTokens}
          onTokenClick={onTokenClick}
          suggestions={suggestions}
          onAcceptSuggestion={onAcceptSuggestion}
          onRejectSuggestion={onRejectSuggestion}
        />
      ))}
    </Stack>
  );
}

interface TokenGroupCardProps {
  entity: string;
  tokens: DisplayToken[];
  selectedTokens: Set<number>;
  onTokenClick: (index: number, shiftKey: boolean) => void;
  suggestions?: Suggestion[] | undefined;
  onAcceptSuggestion?: ((suggestionId: string) => void) | undefined;
  onRejectSuggestion?: ((suggestionId: string) => void) | undefined;
}

function TokenGroupCard({
  entity,
  tokens,
  selectedTokens,
  onTokenClick,
  suggestions = [],
  onAcceptSuggestion,
  onRejectSuggestion,
}: TokenGroupCardProps): React.ReactElement {
  const color = isEntityType(entity) ? ENTITY_COLORS[entity] : 'gray';
  const renderItems = groupTokensIntoRenderItems(tokens);

  return (
    <Card withBorder p="sm">
      <Group mb="xs">
        <Badge color={color} variant="filled">{entity.replace(/_/g, ' ')}</Badge>
        <Badge color="gray" size="xs" variant="light">{tokens.length} tokens</Badge>
      </Group>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'flex-start' }}>
        {renderItems.map((item) => {
          if (item.type === 'span') {
            const { span } = item;
            const isAnySelected = span.tokens.some((t) => selectedTokens.has(t.index));
            const firstToken = span.tokens[0];
            const spanSuggestion = firstToken ? getSuggestionForToken(firstToken.index, suggestions) : null;
            const { handleAccept, handleReject } = createSuggestionHandlers(spanSuggestion, onAcceptSuggestion, onRejectSuggestion);
            const handleClick = (e: React.MouseEvent): void => { if (firstToken) onTokenClick(firstToken.index, e.shiftKey); };

            return (
              <TokenSuggestionBadge key={`span-${span.startIndex}`} suggestion={spanSuggestion} onAccept={handleAccept} onReject={handleReject}>
                <SpanBadge span={span} isSelected={isAnySelected} onClick={handleClick} />
              </TokenSuggestionBadge>
            );
          }

          const { token } = item;
          const tokenSuggestion = getSuggestionForToken(token.index, suggestions);
          const { handleAccept, handleReject } = createSuggestionHandlers(tokenSuggestion, onAcceptSuggestion, onRejectSuggestion);
          const handleClick = (e: React.MouseEvent): void => onTokenClick(token.index, e.shiftKey);

          return (
            <TokenSuggestionBadge key={token.id} suggestion={tokenSuggestion} onAccept={handleAccept} onReject={handleReject}>
              {renderSingleToken(token, selectedTokens.has(token.index), handleClick, false)}
            </TokenSuggestionBadge>
          );
        })}
      </div>
    </Card>
  );
}
