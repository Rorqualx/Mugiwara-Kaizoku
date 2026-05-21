/**
 * Page List Modal Component
 *
 * Modal displaying thumbnail grid of all pages with reading progress indicators.
 *
 * Extracted from: MobileReader.tsx
 */

import React from 'react';

import { Modal, SimpleGrid, Box, Text } from '@mantine/core';

import { ProgressiveImage } from '@/components/images/ProgressiveImage';

import type { PageListModalProps } from './types';

/**
 * Page list modal with thumbnail grid
 */
export function PageListModal({
  opened,
  onClose,
  pages,
  currentPage,
  readingProgress,
  onPageSelect
}: PageListModalProps): React.ReactElement {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Pages"
      size="lg"
      fullScreen>

      <SimpleGrid cols={{ base: 3, sm: 4, md: 6 }} spacing="sm">
        {pages.map((page, index) =>
        <Box
          key={page.id}
          style={{
            position: 'relative',
            cursor: 'pointer',
            border: index === currentPage ? '2px solid var(--mantine-color-blue-6)' : undefined,
            borderRadius: 'var(--mantine-radius-sm)',
            overflow: 'hidden'
          }}
          onClick={() => { onPageSelect(index); }}>

            <ProgressiveImage
            src={page.thumbnailUrl ?? page.url}
            alt={`Page ${page.pageNumber}`}
            aspectRatio={page.width / page.height}
            style={{
              width: '100%',
              height: 'auto'
            }} />


            <Box
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'rgba(0,0,0,0.7)',
              padding: '4px',
              textAlign: 'center'
            }}>

              <Text size="xs" c="white">
                {page.pageNumber}
              </Text>
            </Box>

            {readingProgress.has(index) &&
          <Box
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'var(--mantine-color-green-6)'
            }} />

          }
          </Box>
        )}
      </SimpleGrid>
    </Modal>
  );
}
