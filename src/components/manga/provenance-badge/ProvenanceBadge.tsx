/**
 * Phase 4 #1: Provenance badge.
 *
 * Tiny chip showing the winner provider for a field + confidence color.
 * Hover reveals a tooltip with the alternatives list (Phase 1.5 cutover
 * populates that; pre-cutover it shows only the winner).
 *
 * Drop-in for any detail-page field — pass a FieldProvenance from
 * `useFieldProvenance`. Returns `null` when provenance is missing so
 * fields without a recorded source simply omit the chip.
 */

import { Badge, Tooltip } from '@mantine/core';

import type { FieldProvenance } from '@/hooks/useFieldProvenance';

const CONFIDENCE_TIERS: Array<{ min: number; color: string; label: string }> = [
  { min: 0.7, color: 'green', label: 'high confidence' },
  { min: 0.4, color: 'yellow', label: 'medium confidence' },
  { min: 0.0, color: 'red', label: 'low confidence' },
];

export interface ProvenanceBadgeProps {
  provenance: FieldProvenance | null;
  /** Optional label override; defaults to the winner provider name. */
  label?: string;
  /** When true, render a smaller chip suited to inline use. */
  compact?: boolean;
}

export function ProvenanceBadge({ provenance, label, compact = false }: ProvenanceBadgeProps): JSX.Element | null {
  if (!provenance?.winner) return null;
  const tier = CONFIDENCE_TIERS.find(t => provenance.confidence >= t.min) ?? CONFIDENCE_TIERS[CONFIDENCE_TIERS.length - 1];
  const text = label ?? provenance.winner;
  const tooltipBody = renderTooltipBody(provenance);
  return (
    <Tooltip label={tooltipBody} multiline w={260} withArrow>
      <Badge color={tier?.color ?? 'gray'} size={compact ? 'xs' : 'sm'} variant="light" radius="sm">
        {text}
        {provenance.manual ? ' • pinned' : ''}
      </Badge>
    </Tooltip>
  );
}

function renderTooltipBody(p: FieldProvenance): string {
  const lines: string[] = [];
  lines.push(`${p.field}: ${p.winner ?? 'unknown'} (confidence ${p.confidence.toFixed(2)})`);
  if (p.manual) lines.push('Manually pinned by user.');
  if (p.alternatives.length > 0) {
    lines.push(`Dissenters: ${p.alternatives.map(a => `${a.provider} (${a.confidence.toFixed(2)})`).join(', ')}`);
  } else {
    lines.push('No dissenters recorded.');
  }
  return lines.join('\n');
}
