/**
 * ReviewConfidenceStep Component - Main Aggregator
 *
 * Final review step showing all selected data and metadata quality scores
 * before confirming the import.
 *
 * Architecture:
 * - types.ts - Type definitions and interfaces
 * - hooks/use-merged-metadata.ts - Metadata merging logic
 * - hooks/use-field-source.ts - Field source detection
 * - components/VolumeCoverSection.tsx - Volume covers display
 * - components/ChapterCoverSection.tsx - Chapter covers display
 * - components/GallerySection.tsx - Gallery images display
 * - components/MetadataDisplaySection.tsx - Metadata values
 * - components/MetadataQualitySection.tsx - Quality indicators
 * - components/ContentSummarySection.tsx - Summary stats
 *
 * Original file: 1075 lines -> Refactored: ~200 lines (81% reduction)
 */

import React from 'react';

import {
  Stack,
  Title,
  Paper,
  Grid,
  Text,
  Image,
  ScrollArea,
  Progress,
} from '@mantine/core';

import { VolumeChapterDisplay } from '@/components/addManga/steps/confirmationStep/components/VolumeChapterDisplay';
import { logger } from '@/utils/logger';
import { isString } from '@/utils/validation/type-guards';

import {
  ChapterCoverSection,
  ContentSummarySection,
  GallerySection,
  MetadataDisplaySection,
  MetadataQualitySection,
  VolumeCoverSection,
} from './components';
import { useFieldSource } from './hooks/use-field-source';
import { useMergedMetadata } from './hooks/use-merged-metadata';

import type { ReviewConfidenceStepProps } from './types';

export const ReviewConfidenceStep: React.FC<ReviewConfidenceStepProps> = React.memo(({
  selectedCover,
  selectedBanner,
  selectedVolumes,
  displayVolumes,
  volumeDisplaySource,
  chapterDisplaySource,
  selectedGalleryImages,
  volumesData,
  allChapterUrls,
  selectedChapters,
  chapterMetadataCache,
  selectedMetadata,
  selectedSourcesMetadata,
  externalIds,
  externalLinks,
  mediaGallery,
  provider,
  isImporting,
  importProgress,
  calculateFieldConfidence,
  getConfidenceColor,
}) => {
  // State to track metadata updates
  const [metadataVersion, setMetadataVersion] = React.useState(0);

  // Custom hooks
  const mergedMetadata = useMergedMetadata({
    selectedMetadata,
    selectedSourcesMetadata,
    provider,
  });

  const getFieldSource = useFieldSource(selectedSourcesMetadata);

  // Update version when metadata changes
  React.useEffect(() => {
    setMetadataVersion(prev => prev + 1);
  }, [mergedMetadata]);

  return (
    <Stack key={`review-${metadataVersion}`}>
      <Title order={4}>Review & Confirm Import</Title>

      {/* Description and Synopsis Section */}
      {(() => {
        const description = mergedMetadata["description"];
        const synopsis = mergedMetadata["synopsis"];
        const descriptionStr = isString(description) ? description.trim() : '';
        const synopsisStr = isString(synopsis) ? synopsis.trim() : '';

        return (descriptionStr.length > 0 || synopsisStr.length > 0) && (
          <Paper p="md" key={`desc-${metadataVersion}`}>
            <Stack gap="md">
              {descriptionStr.length > 0 && (
                <div>
                  <Title order={5} mb="sm">Description</Title>
                  <ScrollArea h={150}>
                    <Text size="sm">{descriptionStr}</Text>
                  </ScrollArea>
                </div>
              )}
              {synopsisStr.length > 0 && (
                <div>
                  <Title order={5} mb="sm">Synopsis</Title>
                  <ScrollArea h={150}>
                    <Text size="sm">{synopsisStr}</Text>
                  </ScrollArea>
                </div>
              )}
            </Stack>
          </Paper>
        );
      })()}

      {/* Media Preview Section */}
      <Paper p="md" key={`media-${metadataVersion}`}>
        <Title order={5} mb="md">Selected Media</Title>
        <Stack gap="md">
          {/* Main Cover and Banner */}
          <Grid>
            <Grid.Col span={3}>
              <Stack gap="xs">
                <Text size="xs" fw={500} c="dimmed">Main Cover</Text>
                {selectedCover ? (
                  <>
                    {logger.debug('[ReviewConfidenceStep] Main cover props', {
                      selectedCover: selectedCover.substring(0, 80),
                      fit: 'contain',
                      height: 200
                    })}
                    <Image
                      src={selectedCover}
                      alt="Selected cover"
                      radius="sm"
                      height={200}
                      fit="contain"
                      fallbackSrc="/cover-not-found.jpg"
                    />
                  </>
                ) : (
                  <Paper p="xl" style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Text size="sm" c="dimmed">No cover selected</Text>
                  </Paper>
                )}
              </Stack>
            </Grid.Col>

            {selectedBanner && (
              <Grid.Col span={9}>
                <Stack gap="xs">
                  <Text size="xs" fw={500} c="dimmed">Banner Image</Text>
                  <Image
                    src={selectedBanner}
                    alt="Selected banner"
                    radius="sm"
                    height={200}
                    fit="cover"
                    fallbackSrc="/banner-not-found.jpg"
                  />
                </Stack>
              </Grid.Col>
            )}
          </Grid>

          {/* Volume Covers */}
          <VolumeCoverSection
            displayVolumes={displayVolumes}
            volumeDisplaySource={volumeDisplaySource}
            provider={provider}
          />

          {/* Chapter Covers */}
          <ChapterCoverSection
            selectedVolumes={selectedVolumes}
            volumesData={volumesData}
            allChapterUrls={allChapterUrls}
            chapterMetadataCache={chapterMetadataCache}
            chapterDisplaySource={chapterDisplaySource}
            provider={provider}
          />

          {/* Gallery Images */}
          <GallerySection selectedGalleryImages={selectedGalleryImages} />
        </Stack>
      </Paper>

      {/* Volume/Chapter Table */}
      {displayVolumes.length > 0 && (
        <VolumeChapterDisplay
          provider={volumeDisplaySource ?? provider}
          // VolumeChapterDisplay expects local VolumeData[] which isn't exported
          volumes={displayVolumes as NonNullable<Parameters<typeof VolumeChapterDisplay>[0]['volumes']>}
          chapters={[]}
          totalVolumes={volumesData.totalVolumes}
          totalChapters={volumesData.totalChapters}
          isLoading={false}
        />
      )}

      {/* Metadata Grid */}
      <Grid>
        <Grid.Col span={6}>
          <MetadataDisplaySection
            mergedMetadata={mergedMetadata}
            externalIds={externalIds}
            metadataVersion={metadataVersion}
          />
        </Grid.Col>

        <Grid.Col span={6}>
          <Stack gap="md">
            <MetadataQualitySection
              mergedMetadata={mergedMetadata}
              selectedCover={selectedCover}
              selectedBanner={selectedBanner}
              selectedVolumes={selectedVolumes}
              selectedChapters={selectedChapters}
              getFieldSource={getFieldSource}
              provider={provider}
              metadataVersion={metadataVersion}
              calculateFieldConfidence={calculateFieldConfidence}
              getConfidenceColor={getConfidenceColor}
            />

            <ContentSummarySection
              provider={provider}
              volumesData={volumesData}
              selectedChapters={selectedChapters}
              mediaGallery={mediaGallery}
              selectedBanner={selectedBanner}
              selectedGalleryImages={selectedGalleryImages}
              externalLinks={externalLinks}
              metadataVersion={metadataVersion}
            />
          </Stack>
        </Grid.Col>
      </Grid>

      {/* Import Progress */}
      {isImporting && (
        <Paper p="md">
          <Stack>
            <Text size="sm" fw={500}>Importing...</Text>
            <Progress value={importProgress ?? 0} />
          </Stack>
        </Paper>
      )}
    </Stack>
  );
});

ReviewConfidenceStep.displayName = 'ReviewConfidenceStep';

// Re-export types for backward compatibility
export type { ReviewConfidenceStepProps } from './types';
export type { ExternalIds, MediaGallery, VolumeData } from './types';
