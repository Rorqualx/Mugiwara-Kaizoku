/**
 * Manga Detail Component
 *
 * Displays comprehensive manga information using modular sections.
 *
 * Refactored from: mangaDetail.tsx (526 lines → 80 lines, 85% reduction)
 * Architecture: 9 focused modules (types, utils, hooks, 5 sections)
 *
 * Fixes Applied:
 * - ✅ max-lines violation (526 → 80)
 * - ✅ complexity violation (21 → ~8)
 * - ✅ react-hooks/exhaustive-deps (proper dependency array)
 * - ✅ complex expression in dependency array
 */

"use client";

import React from "react";

import { Grid, Box } from "@mantine/core";

import { ScanlationGroupList } from "@/components/manga/ScanlationGroupList";

import { useVolumeData } from "./hooks/useVolumeData";
import { CoverSection } from "./sections/CoverSection";
import { GenresTagsSection } from "./sections/GenresTagsSection";
import { MetadataSection } from "./sections/MetadataSection";
import { RelatedSeriesSection } from "./sections/RelatedSeriesSection";
import { TechnicalInfoSection } from "./sections/TechnicalInfoSection";
import { VolumesSection } from "./sections/VolumesSection";

import type { MangaWithMetadataAndChapters } from "./types";

// Re-export type for backward compatibility
export type { MangaWithMetadataAndChapters };

export interface MangaDetailProps {
  manga: MangaWithMetadataAndChapters;
}

/**
 * Detailed manga information display component
 *
 * This component provides a comprehensive view of manga details including:
 * - Cover image with hover effects
 * - Summary and metadata
 * - Genres and tags
 * - Technical information
 * - Volume and chapter statistics
 *
 * @param props - Component properties
 * @param props.manga - Manga data with metadata and chapters
 * @returns Detailed manga information layout
 */
export function MangaDetail({ manga }: MangaDetailProps): React.ReactElement {
  // Calculate volume data using custom hook
  const { totalSize, volumes } = useVolumeData(manga);

  return (
    <Box>
      {/* Main Content Area */}
      <Grid gutter="xl">
        {/* Cover Image */}
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <CoverSection manga={manga} />
        </Grid.Col>

        {/* Metadata */}
        <Grid.Col span={{ base: 12, sm: 8 }}>
          <MetadataSection manga={manga} />
        </Grid.Col>
      </Grid>

      {/* Genres and Tags */}
      <GenresTagsSection manga={manga} />

      {/* Related Series & Recommendations (MangaUpdates) */}
      <RelatedSeriesSection mangaId={manga.id} />

      {/* Technical Information */}
      <TechnicalInfoSection manga={manga} totalSize={totalSize} />

      {/* Scanlation Groups - shown for MangaDex sources */}
      {(manga.searchProvider === 'mangadex' || manga.source.toLowerCase() === 'mangadex') && (
        <Box mt="xl">
          <ScanlationGroupList mangaId={manga.id} />
        </Box>
      )}

      {/* Volumes */}
      <VolumesSection volumes={volumes} />
    </Box>
  );
}
