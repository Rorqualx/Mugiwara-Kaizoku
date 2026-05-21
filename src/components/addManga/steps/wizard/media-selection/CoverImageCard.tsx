/**
 * Cover Image Card Component
 *
 * Displays a selectable cover image card with provider badge,
 * edit action, and loading/error states.
 *
 * Extracted from: MediaSelectionStep.tsx (lines 258-396)
 */

import React from 'react';

import {
  Card,
  Badge,
  Group,
  ActionIcon,
  Box,
  Loader,
  Center
} from '@mantine/core';
import { IconEdit, IconReload } from '@tabler/icons-react';

import { ProviderBadge } from '@/components/addManga/components/core/ProviderBadge';

import type { Logger } from './utils';

/** Image data can be either a simple URL string or an object with URL and provider */
type ImageData = string | { url: string; provider: string };

interface CoverImageCardProps {
  imageData: ImageData;
  index: number;
  isSelected: boolean;
  loadingImages: Record<string, boolean>;
  failedImages: Record<string, boolean>;
  onSelect: (image: string) => void;
  onEdit: (index: number, url: string) => void;
  onRetry: (image: string) => void;
  onLoad: (image: string) => void;
  onError: (image: string) => void;
  logger: Logger;
}

export const CoverImageCard = ({
  imageData,
  index,
  isSelected,
  loadingImages,
  failedImages,
  onSelect,
  onEdit,
  onRetry,
  onLoad,
  onError,
  logger
}: CoverImageCardProps): JSX.Element => {
  const image = typeof imageData === 'string' ? imageData : imageData.url;
  const provider = typeof imageData === 'string' ? null : imageData.provider;

  return (
    <Card
      shadow="sm"
      p="xs"
      radius="md"
      style={{
        position: 'relative',
        cursor: 'pointer',
        opacity: isSelected ? 1 : 0.7,
        overflow: 'visible'
      }}
      onClick={() => onSelect(image)}
    >
      {/* Provider badge */}
      {provider && (
        <Box
          style={{
            position: 'absolute',
            top: 5,
            left: 5,
            zIndex: 10
          }}
        >
          <ProviderBadge
            provider={provider}
            size="xs"
            variant="filled"
          />
        </Box>
      )}

      {/* Edit action */}
      <Group
        style={{
          position: 'absolute',
          top: 5,
          right: 5,
          zIndex: 10
        }}
        gap={4}
      >
        <ActionIcon
          size="sm"
          variant="subtle"
          color="gray"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onEdit(index, image);
          }}
        >
          <IconEdit size={14} />
        </ActionIcon>
      </Group>

      {/* Loading state */}
      {loadingImages[image] && (
        <Center h={200}>
          <Loader size="sm" />
        </Center>
      )}

      {/* Image */}
      {!loadingImages[image] && (
        <Box
          style={{
            width: '100%',
            height: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'visible'
          }}
        >
          {/* Using native img for better aspect ratio control with external URLs */}
          <img
            src={image}
            alt={`Cover ${index + 1}`}
            style={{
              maxWidth: '100%',
              maxHeight: 200,
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: 'var(--mantine-radius-sm)'
            }}
            onLoad={() => {
              logger.info(`[MediaSelection] Cover loaded successfully: ${image}`);
              onLoad(image);
            }}
            onError={(e) => {
              logger.warn(`[MediaSelection] Failed to load cover: ${image}`);
              // Set fallback image - DOM manipulation required for immediate fallback display
              // eslint-disable-next-line no-param-reassign
              (e.currentTarget as HTMLImageElement).src = '/cover-not-found.jpg';
              onError(image);
            }}
          />
        </Box>
      )}

      {/* Retry button for failed images */}
      {failedImages[image] && (
        <Center
          style={{
            position: 'absolute',
            bottom: 5,
            right: 5,
            zIndex: 10
          }}
        >
          <ActionIcon
            size="sm"
            variant="filled"
            color="red"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onRetry(image);
            }}
            title="Retry loading image"
          >
            <IconReload size={14} />
          </ActionIcon>
        </Center>
      )}

      {/* Selected badge */}
      {isSelected && (
        <Badge
          size="xs"
          color="green"
          variant="filled"
          style={{
            position: 'absolute',
            top: 4,
            right: 4
          }}
        >
          Selected
        </Badge>
      )}
    </Card>
  );
};

export default CoverImageCard;
