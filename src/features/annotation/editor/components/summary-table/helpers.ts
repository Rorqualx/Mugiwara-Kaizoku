/**
 * Summary Table Helper Functions
 */

import type { DisplayToken } from '@/features/annotation/editor/types';
import type { EntityType } from '@/server/ml/features/bio-types';


import type { EntitySpan } from './types';


/**
 * Groups tokens into entity spans (B + following I tokens)
 */
export function groupIntoSpans(tokens: DisplayToken[]): Map<EntityType, EntitySpan[]> {
  const spans = new Map<EntityType, EntitySpan[]>();
  let currentSpan: EntitySpan | null = null;

  for (const token of tokens) {
    if (token.label === 'O') {
      // End current span if any
      if (currentSpan) {
        addSpanToMap(spans, currentSpan);
        currentSpan = null;
      }
      continue;
    }

    const prefix = token.label.charAt(0);
    const entity = token.label.substring(2) as EntityType;

    if (prefix === 'B') {
      // Start new span, save previous if exists
      if (currentSpan) {
        addSpanToMap(spans, currentSpan);
      }
      currentSpan = {
        entity,
        tokens: [token],
        startIndex: token.index,
        text: token.text,
      };
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- explicit check needed for type narrowing
    } else if (prefix === 'I' && currentSpan && currentSpan.entity === entity) {
      // Continue current span
      currentSpan.tokens.push(token);
      currentSpan.text += ' ' + token.text;
    } else if (prefix === 'I') {
      // I without matching B - treat as new span
      if (currentSpan) {
        addSpanToMap(spans, currentSpan);
      }
      currentSpan = {
        entity,
        tokens: [token],
        startIndex: token.index,
        text: token.text,
      };
    }
  }

  // Don't forget last span
  if (currentSpan) {
    addSpanToMap(spans, currentSpan);
  }

  return spans;
}

function addSpanToMap(map: Map<EntityType, EntitySpan[]>, span: EntitySpan): void {
  if (!map.has(span.entity)) {
    map.set(span.entity, []);
  }
  map.get(span.entity)?.push(span);
}

export function getSpanIndices(span: EntitySpan): number[] {
  return span.tokens.map((t) => t.index);
}

export function filterValidSelection(prev: Set<number>, tokens: DisplayToken[]): Set<number> {
  const valid = new Set<number>();
  for (const idx of prev) {
    const token = tokens.find((t) => t.index === idx);
    if (token && token.label !== 'O') valid.add(idx);
  }
  return valid;
}
