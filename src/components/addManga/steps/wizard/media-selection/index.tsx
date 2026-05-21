/**
 * Media Selection Step - Main Component
 *
 * Handles media selection including covers, banners, and galleries.
 * This is step 5 of the UniversalImportWizard.
 *
 * Architecture:
 * - media-selection/utils.ts - Shared utilities and types
 * - media-selection/hooks.ts - Custom hooks for initialization
 * - media-selection/CoverImageCard.tsx - Cover image card component
 * - media-selection/VolumeCoversPanel.tsx - Volume covers tab panel
 * - media-selection/ChapterCoversPanel.tsx - Chapter covers tab panel
 * - media-selection/GalleryPanel.tsx - Gallery images tab panel
 *
 * Original: 1000 lines → Refactored: ~250 lines (75% reduction)
 */

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';

import {
  Stack,
  Title,
  Tabs,
  Text,
  SimpleGrid,
  Card,
  Image,
  Badge,
  Button,
  Group,
  TextInput,
  Modal
} from '@mantine/core';

import { notify } from '@/utils/notify';

import { ChapterCoversPanel } from './ChapterCoversPanel';
import { CoverImageCard } from './CoverImageCard';
import { GalleryPanel } from './GalleryPanel';
import { useVolumeInitialization, useAutoSelectCover } from './hooks';
import { VolumeCoversPanel } from './VolumeCoversPanel';

import type { MediaSelectionStepProps } from './utils';

/**
 * MediaSelectionStep Component
 *
 * Handles media selection including covers, banners, and galleries.
 * This is step 5 of the UniversalImportWizard.
 */
export const MediaSelectionStep: React.FC<MediaSelectionStepProps> = ({
  mediaGallery,
  setMediaGallery,
  selectedCover,
  setSelectedCover,
  selectedBanner,
  setSelectedBanner,
  selectedVolumes,
  setSelectedVolumes,
  selectedChapters,
  setSelectedChapters,
  selectedGalleryImages,
  setSelectedGalleryImages,
  displayVolumes,
  allChapterUrls,
  provider,
  volumeDisplaySource,
  volumeCoversByProvider,
  logger
}): JSX.Element => {
  // State
  const [editingCoverUrl, setEditingCoverUrl] = useState<string>('');
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Custom hooks
  useVolumeInitialization({
    selectedVolumes,
    setSelectedVolumes,
    volumeDisplaySource,
    provider,
    isInitialized,
    setIsInitialized,
    mediaGallery,
    logger
  });

  useAutoSelectCover({
    selectedCover,
    setSelectedCover,
    mediaGallery,
    provider,
    volumeDisplaySource,
    logger
  });

  // Track previous volumeDisplaySource for chapter selection clearing
  const prevChapterSourceRef = useRef<string>(volumeDisplaySource);

  // Effect to clear chapter selections when provider changes
  useEffect(() => {
    const prevSource = prevChapterSourceRef.current;
    if (prevSource && prevSource !== volumeDisplaySource && selectedChapters.length > 0) {
      logger.info('[MediaSelectionStep] Provider changed, clearing chapter selections:', {
        previousProvider: prevSource,
        newProvider: volumeDisplaySource
      });
      setSelectedChapters([]);
    }
    prevChapterSourceRef.current = volumeDisplaySource;
  }, [volumeDisplaySource, selectedChapters.length, setSelectedChapters, logger]);

  // Event handlers
  const handleCoverSelection = (image: string): void => {
    setSelectedCover(image);
    notify({ severity: 'SUCCESS', title: 'Cover Selected', message: 'Primary cover image has been selected' });
  };

  const handleBannerSelection = (image: string): void => {
    setSelectedBanner(image);
    notify({ severity: 'SUCCESS', title: 'Banner Selected', message: 'Banner image has been selected' });
  };

  const handleEditCover = (index: number, currentUrl: string): void => {
    setEditingIndex(index);
    setEditingCoverUrl(currentUrl);
    setShowEditModal(true);
  };

  const handleSaveEditedCover = (): void => {
    if (editingIndex !== null && editingCoverUrl) {
      const newCovers = [...mediaGallery.covers];
      newCovers[editingIndex] = editingCoverUrl;
      setMediaGallery(prev => ({
        ...prev,
        covers: newCovers
      }));

      if (selectedCover === mediaGallery.covers[editingIndex]) {
        setSelectedCover(editingCoverUrl);
      }

      notify({ severity: 'SUCCESS', title: 'Cover Updated', message: 'Cover image URL has been updated' });
    }
    setShowEditModal(false);
    setEditingIndex(null);
    setEditingCoverUrl('');
  };

  const handleImageLoad = (image: string): void => {
    setLoadingImages(prev => ({ ...prev, [image]: false }));
    setFailedImages(prev => ({ ...prev, [image]: false }));
  };

  const handleImageError = (image: string): void => {
    setLoadingImages(prev => ({ ...prev, [image]: false }));
    setFailedImages(prev => ({ ...prev, [image]: true }));
  };

  const handleRetryImage = (image: string): void => {
    setLoadingImages(prev => ({ ...prev, [image]: true }));
    setFailedImages(prev => ({ ...prev, [image]: false }));
    setTimeout(() => {
      setLoadingImages(prev => ({ ...prev, [image]: false }));
    }, 100);
  };

  return (
    <>
      <Stack>
        <Title order={4}>Media Selection</Title>

        <Tabs defaultValue="covers">
          <Tabs.List>
            <Tabs.Tab value="covers">
              Cover Images ({mediaGallery.covers.length})
            </Tabs.Tab>
            <Tabs.Tab value="banners">
              Banners ({mediaGallery.banners.length})
            </Tabs.Tab>
            <Tabs.Tab value="gallery">
              Gallery ({mediaGallery.gallery.length})
            </Tabs.Tab>
            <Tabs.Tab value="volumes">
              Volume Covers ({selectedVolumes.length})
            </Tabs.Tab>
            <Tabs.Tab value="chapters">
              Chapter Covers ({selectedChapters.length})
            </Tabs.Tab>
          </Tabs.List>

          {/* Covers Tab */}
          <Tabs.Panel value="covers" pt="md">
            <Stack>
              <Text size="sm" fw={500}>Select Primary Cover</Text>
              <SimpleGrid cols={{ base: 3, sm: 4, md: 5 }}>
                {mediaGallery.coversWithProviders && mediaGallery.coversWithProviders.length > 0
                  ? mediaGallery.coversWithProviders.map((coverData, index) => (
                      <CoverImageCard
                        key={index}
                        imageData={coverData}
                        index={index}
                        isSelected={selectedCover === (typeof coverData === 'string' ? coverData : coverData.url)}
                        loadingImages={loadingImages}
                        failedImages={failedImages}
                        onSelect={handleCoverSelection}
                        onEdit={handleEditCover}
                        onRetry={handleRetryImage}
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                        logger={logger}
                      />
                    ))
                  : mediaGallery.covers.map((image, index) => (
                      <CoverImageCard
                        key={index}
                        imageData={image}
                        index={index}
                        isSelected={selectedCover === image}
                        loadingImages={loadingImages}
                        failedImages={failedImages}
                        onSelect={handleCoverSelection}
                        onEdit={handleEditCover}
                        onRetry={handleRetryImage}
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                        logger={logger}
                      />
                    ))
                }
              </SimpleGrid>
              {(mediaGallery.covers.length === 0 &&
               ((!mediaGallery.coversWithProviders) || mediaGallery.coversWithProviders.length === 0)) && (
                <Text c="dimmed">No cover images available</Text>
              )}
            </Stack>
          </Tabs.Panel>

          {/* Banners Tab */}
          <Tabs.Panel value="banners" pt="md">
            <Stack>
              <Text size="sm" fw={500}>Select Banner Image</Text>
              <SimpleGrid cols={{ base: 2, sm: 3 }}>
                {mediaGallery.banners.map((image, index) => {
                  const isSelected = selectedBanner === image;
                  return (
                    <Card
                      key={index}
                      shadow="sm"
                      p="xs"
                      radius="md"
                      style={{
                        position: 'relative',
                        cursor: 'pointer',
                        opacity: isSelected ? 1 : 0.7
                      }}
                      onClick={() => handleBannerSelection(image)}
                    >
                      <Image
                        src={image}
                        height={100}
                        alt={`Banner ${index + 1}`}
                        fit="cover"
                        radius="sm"
                        fallbackSrc="/banner-not-found.jpg"
                        onError={() => {
                          logger.warn(`Failed to load banner: ${image}`);
                        }}
                      />
                      {isSelected && (
                        <Badge
                          size="xs"
                          color="green"
                          variant="filled"
                          style={{ position: 'absolute', top: 4, right: 4 }}
                        >
                          ✓
                        </Badge>
                      )}
                    </Card>
                  );
                })}
              </SimpleGrid>
              {mediaGallery.banners.length === 0 && (
                <Text c="dimmed">No banner images available</Text>
              )}
            </Stack>
          </Tabs.Panel>

          {/* Gallery Tab */}
          <Tabs.Panel value="gallery" pt="md">
            <GalleryPanel
              mediaGallery={mediaGallery}
              selectedGalleryImages={selectedGalleryImages}
              setSelectedGalleryImages={setSelectedGalleryImages}
              loadingImages={loadingImages}
              setLoadingImages={setLoadingImages}
              logger={logger}
            />
          </Tabs.Panel>

          {/* Volumes Tab */}
          <Tabs.Panel value="volumes" pt="md">
            <VolumeCoversPanel
              displayVolumes={displayVolumes}
              selectedVolumes={selectedVolumes}
              setSelectedVolumes={setSelectedVolumes}
              provider={provider}
              volumeDisplaySource={volumeDisplaySource}
              volumeCoversByProvider={volumeCoversByProvider}
              logger={logger}
            />
          </Tabs.Panel>

          {/* Chapters Tab */}
          <Tabs.Panel value="chapters" pt="md">
            <ChapterCoversPanel
              allChapterUrls={allChapterUrls}
              selectedChapters={selectedChapters}
              setSelectedChapters={setSelectedChapters}
              logger={logger}
            />
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* Edit Cover URL Modal */}
      <Modal
        opened={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Cover URL"
      >
        <Stack>
          <TextInput
            label="Cover Image URL"
            value={editingCoverUrl}
            onChange={(e) => setEditingCoverUrl(e.target.value)}
            placeholder="https://..."
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEditedCover}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};

export default MediaSelectionStep;

// Re-export types for external use
export type { MediaSelectionStepProps, MediaGallery, Logger } from './utils';
