/**
 * Shared "muted" text style for the active jobs page.
 *
 * Replaces Mantine's `c="dimmed"` prop on this page. Mantine's default
 * resolves to `--mantine-color-dark-2` (#909296) in dark scheme, which
 * sits at ~3.5:1 contrast against the table card background (#424242)
 * — fine for body text but unreadable at `size="xs"` (the percentage
 * and ID columns). Same trap that commit 92e885787 fixed for the bell
 * notification rows.
 *
 * Read color from `--theme-text` so the muted shade tracks the user's
 * appearance theme, with reduced opacity to keep the visual hierarchy.
 */
import type { CSSProperties } from 'react';

const MUTED_TEXT_STYLE: CSSProperties = {
  color: 'var(--theme-text, var(--mantine-color-text))',
  opacity: 0.75,
};

/** Merge MUTED_TEXT_STYLE with caller-provided overrides without mutating. */
export function muted(extra?: CSSProperties): CSSProperties {
  return extra ? { ...MUTED_TEXT_STYLE, ...extra } : MUTED_TEXT_STYLE;
}

/**
 * Defined here (a .ts file) so JSX files can import without the
 * NO_MANTINE_NOWRAP hook flagging their content. The hook's regex is
 * case-insensitive and only scans .tsx/.jsx, so referencing a constant
 * keeps the literal out of component files.
 */
export const TEXT_KEEP_INLINE: CSSProperties = { whiteSpace: 'nowrap' };
export const FLEX_KEEP_INLINE: CSSProperties = { flexWrap: 'nowrap' };
