/**
 * Cover Selector Modal Component (Refactored)
 *
 * Allows users to select and update cover and banner images for manga
 * from available metadata sources with categorized, organized display.
 */


import React, { useState, useMemo } from 'react';

import {
  Modal,
  Stack,
  Button,
  Group,
  Badge,
  ScrollArea,
  Tabs,
  Text,
  ActionIcon,
  Image,
  Box,
  Tooltip
} from '@mantine/core';
import { IconX } from '@tabler/icons-react';

import { extractAllImages } from '@/services/imageExtractor';
import { proxyImageUrl } from '@/utils/image-proxy';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

import { TabPanels } from './TabPanels';

import type { CoverSelectorModalProps } from './types';

export function CoverSelectorModal({
  opened,
  onClose,
  mangaId,
  currentCover,
  metadata,
  providerMetadata,
  onCoverSelected
}: CoverSelectorModalProps): React.ReactElement {
  // currentBanner is the saved banner from the DB; we compare against this to detect dirty state.
  const currentBanner = metadata?.bannerImage ?? '';
  const [selectedCover, setSelectedCover] = useState<string>(currentCover);
  const [selectedBanner, setSelectedBanner] = useState<string>(currentBanner);
  const [activeTab, setActiveTab] = useState<string>('all-covers');
  // Preview-only state: clicking an image only previews it. The user must
  // click "Stage as Cover" / "Stage as Banner" to commit the choice.
  const [tempSelectedImage, setTempSelectedImage] = useState<string>('');

  const utils = trpc.useUtils();
  const updateMutation = trpc.manga.updateMetadata.useMutation({
    onSuccess: async () => {
      notify({ severity: 'SUCCESS', title: 'Success', message: 'Cover images updated successfully' });
      // Invalidate the manga.get query so the page re-renders with the new
      // cover/banner URLs. Without this, React Query's 30s staleTime keeps
      // serving the old metadata and the user thinks the update did nothing.
      await utils.manga.get.invalidate({ id: mangaId });
      if (onCoverSelected) {
        onCoverSelected(selectedCover);
      }
      onClose();
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Error', message: `Failed to update cover: ${error instanceof Error ? error.message : String(error)}` });
    }
  });

  // Extract all images using the service
  const { coverOptions, bannerOptions } = useMemo(() => {
    // Build metadata object with only truthy string values (exactOptionalPropertyTypes compliance)
    const standardMetadata = metadata ? {
      ...(metadata.coverExtraLarge && { coverExtraLarge: metadata.coverExtraLarge }),
      ...(metadata.coverLarge && { coverLarge: metadata.coverLarge }),
      ...(metadata.coverMedium && { coverMedium: metadata.coverMedium }),
      ...(metadata.cover && { cover: metadata.cover }),
      // Phase 1: coverUrl column dropped.
      ...(metadata.bannerImage && { bannerImage: metadata.bannerImage })
    } : undefined;

    return extractAllImages(providerMetadata ?? null, standardMetadata);
  }, [providerMetadata, metadata]);

  // Get category-specific images
  const wizardImages = useMemo(() =>
    coverOptions.filter(img => img.category === 'wizard'),
    [coverOptions]
  );

  const galleryImages = useMemo(() =>
    coverOptions.filter(img => img.category === 'gallery'),
    [coverOptions]
  );

  const volumeImages = useMemo(() =>
    coverOptions.filter(img => img.category === 'volume').sort((a, b) => {
      const aVol = a.volumeNumber ?? 0;
      const bVol = b.volumeNumber ?? 0;
      return aVol - bVol;
    }),
    [coverOptions]
  );

  const chapterImages = useMemo(() =>
    coverOptions.filter(img => img.category === 'chapter').sort((a, b) => {
      const aChap = a.chapterNumber ?? 0;
      const bChap = b.chapterNumber ?? 0;
      return aChap - bChap;
    }),
    [coverOptions]
  );

  const providerImages = useMemo(() =>
    coverOptions.filter(img => img.category === 'provider'),
    [coverOptions]
  );

  const handleUpdate = async (): Promise<void> => {
    try {
      // Only include changed fields
      const metadataUpdate: Record<string, string> = {};

      if (selectedCover !== currentCover) {
        metadataUpdate['coverLarge'] = selectedCover;
        metadataUpdate['coverMedium'] = selectedCover;
        metadataUpdate['cover'] = selectedCover;
      }

      // Only include banner if it's different from current
      if (selectedBanner && selectedBanner !== currentBanner) {
        metadataUpdate['bannerImage'] = selectedBanner;
      } else if (!selectedBanner && currentBanner) {
        // Clear banner if user selected "No Banner"
        metadataUpdate['bannerImage'] = '';
      }

      await updateMutation.mutateAsync({
        id: mangaId,
        metadata: metadataUpdate
      });
    } catch (_error) {
      // Error handling is done in mutation callbacks
    }
  };

  // Click only previews. Use the explicit "Stage as Cover"/"Stage as Banner"
  // buttons to commit the selection. The Banner tab still allows direct
  // banner-staging because that's the only thing that tab does.
  const handleImageSelect = (url: string): void => {
    setTempSelectedImage(url);
    if (activeTab.startsWith('banner')) {
      setSelectedBanner(url);
    }
  };

  const handleUseCover = (): void => {
    setSelectedCover(tempSelectedImage);
  };

  const handleUseBanner = (): void => {
    setSelectedBanner(tempSelectedImage);
  };

  const isCoverDirty = selectedCover !== currentCover;
  const isBannerDirty = selectedBanner !== currentBanner;
  const hasChanges = isCoverDirty || isBannerDirty;

  const saveLabel = (() => {
    if (isCoverDirty && isBannerDirty) return 'Save Cover & Banner';
    if (isCoverDirty) return 'Save Cover';
    if (isBannerDirty) return 'Save Banner';
    return 'Save Selection';
  })();

  const renderStagedThumb = (
    rawUrl: string,
    label: string,
    onRevert: () => void,
  ): React.ReactElement => {
    const display = proxyImageUrl(rawUrl) ?? rawUrl;
    return (
      <Group gap="xs" align="center">
        <Box
          style={{
            width: 36, height: 48, borderRadius: 6, overflow: 'hidden',
            border: '1px solid var(--mantine-color-gray-7)', flexShrink: 0,
          }}
        >
          <Image src={display} alt={`${label} preview`} h={48} w={36} fit="cover" />
        </Box>
        <Text size="xs" c="dimmed">{label} (staged)</Text>
        <Tooltip label={`Revert ${label}`}>
          <ActionIcon size="sm" variant="subtle" color="gray" onClick={onRevert}>
            <IconX size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={() => { void onClose(); }}
      title="Select Cover & Banner Images"
      size="xl"
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Stack gap="lg">
        <Tabs value={activeTab} onChange={(value) => setActiveTab(value ?? 'all-covers')}>
          <Tabs.List>
            <Tabs.Tab value="all-covers">
              All Covers
              <Badge size="sm" ml="xs" variant="light">
                {coverOptions.length}
              </Badge>
            </Tabs.Tab>

            {wizardImages.length > 0 && (
              <Tabs.Tab value="wizard">
                Wizard
                <Badge size="sm" ml="xs" variant="light">
                  {wizardImages.length}
                </Badge>
              </Tabs.Tab>
            )}

            {volumeImages.length > 0 && (
              <Tabs.Tab value="volumes">
                Volumes
                <Badge size="sm" ml="xs" variant="light" color="green">
                  {volumeImages.length}
                </Badge>
              </Tabs.Tab>
            )}

            {chapterImages.length > 0 && (
              <Tabs.Tab value="chapters">
                Chapters
                <Badge size="sm" ml="xs" variant="light" color="cyan">
                  {chapterImages.length}
                </Badge>
              </Tabs.Tab>
            )}

            {providerImages.length > 0 && (
              <Tabs.Tab value="providers">
                Providers
                <Badge size="sm" ml="xs" variant="light" color="orange">
                  {providerImages.length}
                </Badge>
              </Tabs.Tab>
            )}

            <Tabs.Tab value="gallery">
              Gallery
              <Badge size="sm" ml="xs" variant="light" color="grape">
                {galleryImages.length}
              </Badge>
            </Tabs.Tab>

            <Tabs.Tab value="banner">
              Banners
              <Badge size="sm" ml="xs" variant="light" color="violet">
                {bannerOptions.length}
              </Badge>
            </Tabs.Tab>
          </Tabs.List>

          <TabPanels
            coverOptions={coverOptions}
            wizardImages={wizardImages}
            volumeImages={volumeImages}
            chapterImages={chapterImages}
            providerImages={providerImages}
            galleryImages={galleryImages}
            bannerOptions={bannerOptions}
            selectedCover={selectedCover}
            selectedBanner={selectedBanner}
            currentCover={currentCover}
            currentBanner={currentBanner}
            tempSelectedImage={tempSelectedImage}
            onImageSelect={handleImageSelect}
            onSetSelectedBanner={setSelectedBanner}
            onUseCover={handleUseCover}
            onUseBanner={handleUseBanner}
          />
        </Tabs>

        {/* Staged-changes preview strip */}
        {(isCoverDirty || isBannerDirty) && (
          <Group justify="flex-end" gap="lg" mt="xs">
            {isCoverDirty && renderStagedThumb(selectedCover, 'Cover', () => setSelectedCover(currentCover))}
            {isBannerDirty && renderStagedThumb(selectedBanner, 'Banner', () => setSelectedBanner(currentBanner))}
          </Group>
        )}

        {/* Action Buttons */}
        <Group justify="space-between" mt="md">
          <Group>
            <Text size="sm" c="dimmed">
              {coverOptions.length} covers • {galleryImages.length} gallery • {volumeImages.length} volumes
            </Text>
          </Group>
          <Group>
            <Button variant="default" onClick={() => { void onClose(); }}>
              Cancel
            </Button>
            <Button
              onClick={() => { void handleUpdate(); }}
              loading={updateMutation.isPending}
              disabled={!hasChanges}
            >
              {saveLabel}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
