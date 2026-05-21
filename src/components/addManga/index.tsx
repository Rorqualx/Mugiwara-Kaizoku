"use client";
/**
 * Add Manga Components
 *
 * This module provides components and hooks for adding manga to a library:
 * - AddManga: A button component that opens the add manga modal
 * - useAddMangaModal: A hook for managing the add manga modal state
 *
 * @module components/addManga
 */
import React, { useState, useCallback } from "react";

import { Box, Paper } from "@mantine/core";
import { IconPlus } from '@tabler/icons-react';

import { logger } from '@/utils/logger';

import { Tooltip } from '../Tooltip/client';

import { useAddMangaModal } from './AddMangaModal';
import { AddMangaModal } from './AddMangaModal';
/**
 * Props for the AddManga component
 *
 * @interface AddMangaProps
 * @property {() => void} onAdd - Callback function to execute after successfully adding a manga
 * @property {number} libraryId - ID of the library to add the manga to
 */
interface AddMangaProps {
    onAdd: () => void;
    libraryId: number;
}
export { useAddMangaModal };
/**
 * AddManga Component
 *
 * A button component that opens a modal for adding manga to a library.
 * Displays as a card with a plus icon and hover effects.
 *
 * @param {AddMangaProps} props - Component props
 * @returns {JSX.Element} The rendered component
 *
 * @example
 * ```tsx
 * <AddManga
 *   libraryId={1}
 *   onAdd={() => {
 *     // Refresh library or update UI
 *     refetchLibrary();
 *   }}
 * />
 * ```
 */
export function AddManga(props: AddMangaProps): React.ReactElement {
    const { onAdd, libraryId } = props;
    const [opened, setOpened] = useState(false);

    /**
     * Handle click event on the add manga button
     */
    const handleClick = useCallback(() => {

        if (typeof window !== 'undefined') {
            logger.debug('Opening add manga modal for library:', libraryId);
            setOpened(true);
        }
    }, [libraryId]);

    const handleClose = useCallback(() => {
        setOpened(false);
    }, []);

    const handleComplete = useCallback((_mangaId: number) => {
        setOpened(false);
        onAdd();
    }, [onAdd]);

    return (
        <>
            <Tooltip label="Add a new manga" position="bottom">
              <Paper shadow="lg" p="md" radius="md" h={320} w={200} display="flex" style={{
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: 'var(--mantine-color-gray-4)',
                    cursor: "pointer",
                    transition: "transform 150ms ease, box-shadow 150ms ease",
                    '&:hover': {
                        transform: "scale(1.01)",
                        boxShadow: 'var(--mantine-shadow-md)',
                    },
                    '@media (prefersColorScheme: dark)': {
                        backgroundColor: 'var(--mantine-color-dark-4)',
                    },
                }} onClick={handleClick}>
                <Box style={{
                    color: 'var(--mantine-color-dark-4)',
                    '@media (prefersColorScheme: dark)': {
                        color: 'var(--mantine-color-gray-4)',
                    },
                }}>
                  <IconPlus opacity={0.5} size={96}/>
                </Box>
              </Paper>
            </Tooltip>

            {/* Render the modal only when opened */}
            {opened && (
                <AddMangaModal
                    opened={opened}
                    onClose={handleClose}
                    libraryId={libraryId}
                    onComplete={handleComplete}
                />
            )}
        </>
    );
}
