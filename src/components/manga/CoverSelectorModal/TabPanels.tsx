/**
 * Tab Panels Component
 * Contains all tab panels for cover/banner selection
 */

import React from 'react';

import {
  Tabs,
  Stack,
  Alert,
  Text,
  Box,
  Group,
  ActionIcon,
  Divider
} from '@mantine/core';
import { IconCheck, IconInfoCircle } from '@tabler/icons-react';

import type { ImageOption } from '@/types/provider-metadata.types';

import { ImageGrid } from './ImageGrid';
import { QuickActions } from './QuickActions';

interface TabPanelsProps {
  // Image collections
  coverOptions: ImageOption[];
  wizardImages: ImageOption[];
  volumeImages: ImageOption[];
  chapterImages: ImageOption[];
  providerImages: ImageOption[];
  galleryImages: ImageOption[];
  bannerOptions: ImageOption[];

  // Selection state
  selectedCover: string;
  selectedBanner: string;
  currentCover: string;
  currentBanner: string;
  tempSelectedImage: string;

  // Handlers
  onImageSelect: (url: string) => void;
  onSetSelectedBanner: (url: string) => void;
  onUseCover: () => void;
  onUseBanner: () => void;
}

export const TabPanels = ({
  coverOptions,
  wizardImages,
  volumeImages,
  chapterImages,
  providerImages,
  galleryImages,
  bannerOptions,
  selectedCover,
  selectedBanner,
  currentCover,
  currentBanner,
  tempSelectedImage,
  onImageSelect,
  onSetSelectedBanner,
  onUseCover,
  onUseBanner
}: TabPanelsProps): React.ReactElement => {
  return (
    <>
      {/* All Covers Tab */}
      <Tabs.Panel value="all-covers" pt="md">
        <ImageGrid
          images={coverOptions}
          emptyMessage="No cover images available from any source"
          selectedUrl={tempSelectedImage || selectedCover}
          isBanner={false}
          onSelect={onImageSelect}
        />
        <QuickActions
          tempSelectedImage={tempSelectedImage}
          currentCover={currentCover}
          currentBanner={currentBanner}
          onUseCover={onUseCover}
          onUseBanner={onUseBanner}
        />
      </Tabs.Panel>

      {/* Wizard Selections Tab */}
      {wizardImages.length > 0 && (
        <Tabs.Panel value="wizard" pt="md">
          <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light" mb="md">
            <Text size="sm">Images you selected during the import wizard</Text>
          </Alert>
          <ImageGrid
            images={wizardImages}
            emptyMessage="No wizard selections available"
            selectedUrl={tempSelectedImage || selectedCover}
            isBanner={false}
            onSelect={onImageSelect}
          />
          <QuickActions
            tempSelectedImage={tempSelectedImage}
            currentCover={currentCover}
            currentBanner={currentBanner}
            onUseCover={onUseCover}
            onUseBanner={onUseBanner}
          />
        </Tabs.Panel>
      )}

      {/* Volume Covers Tab */}
      {volumeImages.length > 0 && (
        <Tabs.Panel value="volumes" pt="md">
          <Alert icon={<IconInfoCircle size={16} />} color="green" variant="light" mb="md">
            <Text size="sm">Individual volume covers organized by volume number</Text>
          </Alert>
          <ImageGrid
            images={volumeImages}
            emptyMessage="No volume covers available"
            selectedUrl={tempSelectedImage || selectedCover}
            isBanner={false}
            onSelect={onImageSelect}
          />
          <QuickActions
            tempSelectedImage={tempSelectedImage}
            currentCover={currentCover}
            currentBanner={currentBanner}
            onUseCover={onUseCover}
            onUseBanner={onUseBanner}
          />
        </Tabs.Panel>
      )}

      {/* Chapter Covers Tab */}
      {chapterImages.length > 0 && (
        <Tabs.Panel value="chapters" pt="md">
          <Alert icon={<IconInfoCircle size={16} />} color="cyan" variant="light" mb="md">
            <Text size="sm">Individual chapter covers organized by chapter number</Text>
          </Alert>
          <ImageGrid
            images={chapterImages}
            emptyMessage="No chapter covers available"
            selectedUrl={tempSelectedImage || selectedCover}
            isBanner={false}
            onSelect={onImageSelect}
          />
          <QuickActions
            tempSelectedImage={tempSelectedImage}
            currentCover={currentCover}
            currentBanner={currentBanner}
            onUseCover={onUseCover}
            onUseBanner={onUseBanner}
          />
        </Tabs.Panel>
      )}

      {/* Provider Images Tab */}
      {providerImages.length > 0 && (
        <Tabs.Panel value="providers" pt="md">
          <Alert icon={<IconInfoCircle size={16} />} color="orange" variant="light" mb="md">
            <Text size="sm">Official covers from AniList, ComicVine, Fandom, and Wikipedia</Text>
          </Alert>
          <ImageGrid
            images={providerImages}
            emptyMessage="No provider images available"
            selectedUrl={tempSelectedImage || selectedCover}
            isBanner={false}
            onSelect={onImageSelect}
          />
          <QuickActions
            tempSelectedImage={tempSelectedImage}
            currentCover={currentCover}
            currentBanner={currentBanner}
            onUseCover={onUseCover}
            onUseBanner={onUseBanner}
          />
        </Tabs.Panel>
      )}

      {/* Gallery Tab */}
      <Tabs.Panel value="gallery" pt="md">
        <Alert icon={<IconInfoCircle size={16} />} color="grape" variant="light" mb="md">
          <Text size="sm">Promotional art, character art, and gallery images</Text>
        </Alert>
        <ImageGrid
          images={galleryImages}
          emptyMessage="No gallery images available"
          selectedUrl={tempSelectedImage || selectedCover}
          isBanner={false}
          onSelect={onImageSelect}
        />
        <QuickActions
          tempSelectedImage={tempSelectedImage}
          currentCover={currentCover}
          currentBanner={currentBanner}
          onUseCover={onUseCover}
          onUseBanner={onUseBanner}
        />
      </Tabs.Panel>

      {/* Banner Tab */}
      <Tabs.Panel value="banner" pt="md">
        <Stack gap="md">
          <Alert icon={<IconInfoCircle size={16} />} color="violet" variant="light">
            <Text size="sm">
              Select a wide banner image for the manga page header, or choose "No Banner" to use the cover
            </Text>
          </Alert>

          {/* No Banner Option */}
          <Box
            style={{
              border: !selectedBanner
                ? '3px solid var(--mantine-color-blue-5)'
                : '1px solid var(--mantine-color-gray-7)',
              borderRadius: 'var(--mantine-radius-md)',
              padding: '16px',
              cursor: 'pointer',
              background: !selectedBanner ? 'var(--mantine-color-dark-7)' : 'transparent'
            }}
            onClick={() => onSetSelectedBanner('')}
          >
            <Group>
              {!selectedBanner && (
                <ActionIcon color="blue" variant="filled" size="sm">
                  <IconCheck size={14} />
                </ActionIcon>
              )}
              <Text size="sm" fw={500}>
                No Banner (Use Cover Image)
              </Text>
            </Group>
          </Box>

          <Divider label="Available Banners" labelPosition="center" />

          <ImageGrid
            images={bannerOptions}
            emptyMessage="No banner images available"
            selectedUrl={tempSelectedImage || selectedBanner}
            isBanner={true}
            onSelect={onImageSelect}
          />
          <QuickActions
            tempSelectedImage={tempSelectedImage}
            currentCover={currentCover}
            currentBanner={currentBanner}
            onUseCover={onUseCover}
            onUseBanner={onUseBanner}
          />
        </Stack>
      </Tabs.Panel>
    </>
  );
};
