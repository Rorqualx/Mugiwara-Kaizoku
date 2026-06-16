"use client";
/**
 * Component for displaying a library as an interactive cover-mosaic hero card.
 *
 * The card is filled edge-to-edge with a mosaic of the library's manga covers,
 * topped by a dark gradient overlay that carries the library name, manga count,
 * total size, and edit/delete actions. It replaces the previous layout where a
 * single low-opacity cover floated in a mostly-empty 200px box.
 *
 * @remarks
 * Visual States:
 * - Default: cover mosaic + gradient footer, elevation shadow
 * - Selected: blue border
 * - Hover: deeper shadow + subtle mosaic zoom
 *
 * Degradation by cover count:
 * - 0 covers → centered folder placeholder over a muted backdrop
 * - 1 cover  → single full-bleed cover
 * - 2-6      → 2x1 / 3x1 / 2x2 / 3x2 tiled mosaic
 *
 * Event Handling:
 * - Card click / Enter / Space navigates to the library
 * - Edit and delete buttons stop propagation and call their handlers
 *
 * @example
 * ```tsx
 * <LibraryCard
 *   library={library}
 *   onEdit={() => handleEdit(library.id)}
 *   onDelete={() => handleDelete(library.id)}
 *   onClick={() => handleSelect(library.id)}
 * />
 * ```
 */
import React, { useMemo, useState } from "react";

import { Paper, Badge, Text, Group, Stack, ActionIcon, Box, Center } from '@mantine/core';
import { IconEdit, IconTrash, IconFolder, IconPhoto } from '@tabler/icons-react';

import { useLibraryStore } from '@/store/librarySlice';
import type { LibraryWithRelations } from '@/types/search.types';
import { formatFileSize } from '@/utils/formatters';
import { toNumberId } from '@/utils/id-converters';

/**
 * Extended type to handle runtime cases where the Manga relation may not be
 * eagerly loaded.
 */
type LibraryCardData = Omit<LibraryWithRelations, 'Manga'> & {
  Manga?: LibraryWithRelations['Manga'];
};

type MangaList = NonNullable<LibraryCardData['Manga']>;

interface LibraryCardProps {
  /** The library data to display (name, id, path, optional Manga relation). */
  library: LibraryCardData;
  /** Handler for the edit action (event propagation already stopped). */
  onEdit: () => void;
  /** Handler for the delete action (event propagation already stopped). */
  onDelete: () => void;
  /** Handler for selecting/opening the library. */
  onClick: () => void;
}

/** Max covers shown in the mosaic — capped to keep a clean 3x2 grid. */
const MAX_COVERS = 6;
const CARD_HEIGHT = 200;
const PLACEHOLDER_COVER = '/cover-not-found.jpg';
const OVERLAY_GRADIENT =
  'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.78) 28%, rgba(0,0,0,0.25) 58%, rgba(0,0,0,0) 100%)';

/** Grid shape (columns x rows) for a given number of mosaic tiles. */
function mosaicGrid(count: number): { cols: number; rows: number; cells: number } {
  if (count >= 6) return { cols: 3, rows: 2, cells: 6 };
  if (count >= 4) return { cols: 2, rows: 2, cells: 4 };
  if (count === 3) return { cols: 3, rows: 1, cells: 3 };
  if (count === 2) return { cols: 2, rows: 1, cells: 2 };
  return { cols: 1, rows: 1, cells: 1 };
}

/** Collect up to MAX_COVERS distinct, real cover URLs from the library's manga. */
function collectCoverUrls(mangaList: MangaList): string[] {
  const seen = new Set<string>();
  for (const manga of mangaList) {
    const meta = manga.Metadata;
    const url = (meta?.coverLarge ?? meta?.coverMedium ?? meta?.cover) ?? '';
    if (url.length > 0 && url !== PLACEHOLDER_COVER && !seen.has(url)) {
      seen.add(url);
      if (seen.size >= MAX_COVERS) break;
    }
  }
  return [...seen];
}

/** Sum chapter sizes defensively — Chapter may be absent on a lightly-loaded relation. */
function computeLibrarySize(mangaList: MangaList): number {
  return mangaList.reduce((sum, manga) => {
    const chapters = (manga as { Chapter?: Array<{ size?: number | null }> }).Chapter ?? [];
    const mangaSize = chapters.reduce((chSum, ch) => chSum + (typeof ch.size === 'number' ? ch.size : 0), 0);
    return sum + mangaSize;
  }, 0);
}

/** Edge-to-edge tiled mosaic of cover images. */
function CoverMosaic({ covers, hovered }: { covers: string[]; hovered: boolean }): React.ReactElement {
  const grid = mosaicGrid(covers.length);
  return (
    <Box
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        gridTemplateColumns: `repeat(${grid.cols}, 1fr)`,
        gridTemplateRows: `repeat(${grid.rows}, 1fr)`,
        transform: hovered ? 'scale(1.04)' : 'scale(1)',
        transition: 'transform 300ms ease',
      }}
    >
      {Array.from({ length: grid.cells }, (_, i) => (
        <Box
          key={i}
          style={{
            backgroundImage: `url("${covers[i % covers.length]}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
          }}
        />
      ))}
    </Box>
  );
}

/** Muted backdrop with a folder/photo glyph when the library has no covers. */
function MosaicPlaceholder({ hasManga }: { hasManga: boolean }): React.ReactElement {
  return (
    <Center aria-hidden style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--mantine-color-dark-6)' }}>
      {hasManga
        ? <IconFolder size={56} color="var(--mantine-color-dark-2)" />
        : <IconPhoto size={56} color="var(--mantine-color-dark-3)" />}
    </Center>
  );
}

/** Gradient footer carrying the name, count/size, and edit/delete actions. */
function LibraryOverlay({
  name, mangaCount, totalSize, onEdit, onDelete,
}: {
  name: string;
  mangaCount: number;
  totalSize: number;
  onEdit: () => void;
  onDelete: () => void;
}): React.ReactElement {
  return (
    <Box
      style={{
        position: 'absolute',
        inset: 0,
        background: OVERLAY_GRADIENT,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: 'var(--mantine-spacing-sm)',
      }}
    >
      <Group justify="space-between" align="flex-end" wrap="nowrap" gap="xs">
        <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
          <Group gap={6} wrap="nowrap" align="center">
            <IconFolder size={18} color="var(--mantine-color-blue-4)" style={{ flexShrink: 0 }} />
            <Text fw={700} c="white" lineClamp={1} style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
              {name}
            </Text>
          </Group>
          <Group gap={6} wrap="nowrap">
            <Badge size="sm" color="blue" variant="filled" style={{ flexShrink: 0 }}>
              {mangaCount} manga
            </Badge>
            {totalSize > 0 && (
              <Text size="xs" c="gray.4" lineClamp={1}>
                {formatFileSize(totalSize)}
              </Text>
            )}
          </Group>
        </Stack>

        <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
          <ActionIcon
            variant="filled"
            color="dark"
            size="md"
            aria-label={`Edit library ${name}`}
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="filled"
            color="red"
            size="md"
            aria-label={`Delete library ${name}`}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Group>
    </Box>
  );
}

/**
 * Renders a library as a cover-mosaic hero card with edit/delete actions and a
 * blue border when it is the currently-selected library.
 */
export function LibraryCard({ library, onEdit, onDelete, onClick }: LibraryCardProps): React.ReactElement {
  const { selectedLibraryId } = useLibraryStore();
  const isSelected = selectedLibraryId === toNumberId(library["id"]);
  const [hovered, setHovered] = useState(false);

  const mangaList = useMemo(() => library.Manga ?? [], [library.Manga]);
  const mangaCount = mangaList.length;
  const name = library["name"];

  const covers = useMemo(() => collectCoverUrls(mangaList), [mangaList]);
  const totalSize = useMemo(() => computeLibrarySize(mangaList), [mangaList]);

  return (
    <Paper
      shadow={hovered ? 'xl' : 'md'}
      radius="md"
      pos="relative"
      h={CARD_HEIGHT}
      w="100%"
      role="button"
      tabIndex={0}
      aria-label={`Open library ${name} (${mangaCount} manga)`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        overflow: 'hidden',
        border: isSelected ? '2px solid var(--mantine-color-blue-6)' : '1px solid var(--mantine-color-dark-4)',
      }}
    >
      {covers.length > 0
        ? <CoverMosaic covers={covers} hovered={hovered} />
        : <MosaicPlaceholder hasManga={mangaCount > 0} />}

      <LibraryOverlay
        name={name}
        mangaCount={mangaCount}
        totalSize={totalSize}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </Paper>
  );
}
