/**
 * Summary Table Types
 */

import type { DisplayToken } from '@/features/annotation/editor/types';
import type { EntityType } from '@/server/ml/features/bio-types';


export interface EntitySpan {
  entity: EntityType;
  tokens: DisplayToken[];
  startIndex: number;
  text: string; // Combined text of all tokens in span
}

export interface SummaryTableProps {
  tokens: DisplayToken[];
  onClearLabels?: (indices: number[]) => void;
}
