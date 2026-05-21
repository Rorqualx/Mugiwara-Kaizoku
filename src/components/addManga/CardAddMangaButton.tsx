/**
 * CardAddMangaButton Component
 * 
 * Renders a card-style button that opens the AddMangaModal when clicked.
 * This component is typically used in library views to provide a visual
 * way to add new manga to a specific library.
 * 
 * @module components/addManga/CardAddMangaButton
 * @requires AddMangaModal
 */

import React, { useState } from 'react';

import { Card, Text, UnstyledButton, Box, Group } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

import type { ID } from '@/types/search.types';

import { AddMangaModal } from './AddMangaModal';

/**
 * Props for the CardAddMangaButton component
 */
interface CardAddMangaButtonProps {
  /** ID of the library to add manga to */
  libraryId: ID;
  /** Callback fired after adding manga successfully */
  onAdd?: () => void;
  /** Text to display on the button */
  label?: string;
}

/**
 * Card-style Add Manga Button Component
 * 
 * A card-style button that opens the manga addition modal
 * 
 * @param props Component properties
 * @returns React component
 */
export function CardAddMangaButton({
  libraryId,
  onAdd,
  label = 'Add Manga'
}: CardAddMangaButtonProps): React.ReactElement {
  const [modalOpened, setModalOpened] = useState(false);

  const handleAddComplete = (): void => {
    setModalOpened(false);
    if (onAdd) {
      onAdd();
    }
  };

  return (
    <>
      <UnstyledButton
        onClick={() => setModalOpened(true)}
        style={{ width: '100%', height: '100%' }}>

        <Card
          shadow="sm"
          padding="lg"
          radius="md"
          withBorder
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            minHeight: 250,
            cursor: 'pointer',
            border: '1px dashed var(--mantine-color-blue-5)',
            backgroundColor: 'transparent'
          }}
          h="100%">

          <Box
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--mantine-spacing-md)',
              height: '100%'
            }}>

            <Group>
              <IconPlus
                size={48}
                style={{
                  color: 'var(--mantine-color-blue-6)',
                  opacity: 0.8
                }} />

            </Group>
            <Text ta="center" fw={500} size="lg" c="blue.6">
              {label}
            </Text>
          </Box>
        </Card>
      </UnstyledButton>

      {/* Render the modal only when opened */}
      {modalOpened && (
        <AddMangaModal
          opened={modalOpened}
          onClose={() => setModalOpened(false)}
          libraryId={libraryId}
          onComplete={handleAddComplete}
        />
      )}
    </>);

}