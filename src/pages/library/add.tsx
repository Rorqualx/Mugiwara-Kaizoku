/**
 * Add Manga Page
 *
 * Displays a card with a plus icon that opens the add manga modal when clicked.
 * Used for adding new manga to a specific library.
 *
 * @module pages/library/add
 * @requires @mantine/core
 */

import React, { useState, useCallback } from "react";

import { Container, Paper, Card } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { AddMangaModal } from '@/components/addManga/AddMangaModal';
import { toNumberId } from '@/utils/id-converters';

/**
 * Add manga page component
 *
 * Renders a clickable card that opens the add manga modal.
 * Extracts library ID from route parameters.
 *
 * @component
 * @returns {JSX.Element} Add manga page
 */
const AddNewPage = (): JSX.Element => {
  const router = useRouter();
  const { id } = router.query;
  const libraryId = typeof id === 'string' ? toNumberId(id) : undefined;
  const [opened, setOpened] = useState(false);

  const handleClick = useCallback(() => {
    if (libraryId) {
      setOpened(true);
    }
  }, [libraryId]);

  const handleClose = useCallback(() => {
    setOpened(false);
  }, []);

  const handleComplete = useCallback((_mangaId: number) => {
    setOpened(false);
    // Optionally navigate to the manga page or refresh
  }, []);

  /**
   * Render add manga card with plus icon
   * Uses consistent dimensions and styling with manga cards
   */
  return (
    <>
      <Container size="xl" mt={80}>
        <Card shadow="sm" p={0} radius="md" withBorder style={{
          display: 'flex',
          justifyContent: 'center',
          width: '216px'
        }}>
          <Paper onClick={handleClick} style={{
            cursor: 'pointer',
            width: '216px',
            height: '336px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <IconPlus size={64} opacity={0.5} />
          </Paper>
        </Card>
      </Container>

      {/* Render the modal only when we have a valid library ID */}
      {libraryId && (
        <AddMangaModal
          opened={opened}
          onClose={handleClose}
          libraryId={libraryId}
          onComplete={handleComplete}
        />
      )}
    </>
  );
};
export default AddNewPage;