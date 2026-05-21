/**
 * Token Display Types
 */

import type { DisplayToken } from '@/features/annotation/editor/types';

import type { Suggestion } from '../SuggestionPanel';

export type TokenViewMode = 'all' | 'labeled' | 'unlabeled';
export type TokenLayoutMode = 'flow' | 'compact' | 'grouped';

export interface TokenDisplayProps {
  tokens: DisplayToken[];
  onTokenClick: (index: number, shiftKey: boolean) => void;
  selectedTokens: Set<number>;
  suggestions?: Suggestion[] | undefined;
  onAcceptSuggestion?: ((suggestionId: string) => void) | undefined;
  onRejectSuggestion?: ((suggestionId: string) => void) | undefined;
}

export function filterTokensBySearch(tokens: DisplayToken[], search: string): DisplayToken[] {
  if (!search.trim()) return tokens;
  const lower = search.toLowerCase();
  return tokens.filter((t) =>
    t.text.toLowerCase().includes(lower) ||
    t.label.toLowerCase().includes(lower) ||
    (t.imageAlt?.toLowerCase().includes(lower) ?? false)
  );
}

export function filterTokensByView(tokens: DisplayToken[], view: TokenViewMode): DisplayToken[] {
  if (view === 'all') return tokens;
  if (view === 'labeled') return tokens.filter((t) => t.label !== 'O');
  return tokens.filter((t) => t.label === 'O');
}

export function groupTokensByEntity(tokens: DisplayToken[]): Map<string, DisplayToken[]> {
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

export function computeTokenStats(tokens: DisplayToken[]): { labeled: number; unlabeled: number } {
  let labeled = 0;
  let unlabeled = 0;
  for (const t of tokens) {
    if (t.label === 'O') unlabeled++;
    else labeled++;
  }
  return { labeled, unlabeled };
}
