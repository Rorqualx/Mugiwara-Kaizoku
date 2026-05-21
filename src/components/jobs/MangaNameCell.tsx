/**
 * Manga name cell for the Active Jobs table.
 *
 * When the job has a `mangaId` we render the title as a Next.js link to
 * `/manga/[id]`. Without one (system tasks, jobs not tied to a manga
 * row), the cell falls back to a plain Text. The link uses the same
 * white body color as the original cell text plus a subtle hover
 * underline so it's discoverable without screaming "I'm a link" in
 * dense table rows.
 */
import React from 'react';
import type { ReactElement } from 'react';

import { Text } from '@mantine/core';
import Link from 'next/link';

import { muted } from './theme-text-styles';

export interface MangaNameCellProps {
  taskName: string;
  mangaId?: number | undefined;
  /** Mantine Text size — `sm` for top-level rows, `xs` for child sub-jobs. */
  size?: 'sm' | 'xs';
}

const LINK_STYLE: React.CSSProperties = {
  textDecoration: 'none',
  color: 'inherit',
  cursor: 'pointer',
};

export function MangaNameCell({ taskName, mangaId, size = 'sm' }: MangaNameCellProps): ReactElement {
  const textStyle = size === 'sm' ? { color: '#e0e0e0' } : muted();

  if (mangaId === undefined) {
    return <Text size={size} lineClamp={1} style={textStyle}>{taskName}</Text>;
  }

  return (
    <Link href={`/manga/${mangaId}`} style={LINK_STYLE} className="manga-name-link">
      <Text size={size} lineClamp={1} style={textStyle} title={`Open ${taskName}`}>
        {taskName}
      </Text>
    </Link>
  );
}
