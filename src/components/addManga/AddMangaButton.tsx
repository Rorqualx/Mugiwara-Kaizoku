/**
 * AddMangaButton Component
 *
 * A reusable button component that triggers the manga addition workflow.
 * This component is used throughout the application to provide a consistent
 * entry point for adding new manga to the library.
 *
 * @module components/addManga/AddMangaButton
 */
import React from 'react';

import { Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

import { logger } from '@/utils/logger';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility

/**
 * Props for the AddMangaButton component
 */
export interface AddMangaButtonProps {
    /** Library ID to add manga to (optional if onClick is provided) */
    libraryId?: string | number;
    /** Callback function to execute after adding manga (optional if onClick is provided) */
    onAdd?: () => void;
    /** Direct click handler (alternative to onAdd + libraryId pattern) */
    onClick?: () => void;
    /** Optional button variant */
    variant?: 'filled' | 'light' | 'outline' | 'subtle' | 'default' | 'transparent' | 'white';
    /** Optional button size */
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}
/**
 * AddMangaButton component that renders a button with a plus icon
 *
 * This component provides a consistent UI element for initiating the manga
 * addition workflow. It uses Mantine's Button component with a light variant
 * and includes a plus icon from Tabler Icons.
 *
 * @param props - Component props
 * @returns The rendered button component
 *
 * @example
 * // Basic usage
 * <AddMangaButton onClick={() => openAddMangaModal()} />
 *
 * @example
 * // Usage with navigation
 * <AddMangaButton onClick={() => router.push('/add-manga')} />
 */
export function AddMangaButton({ libraryId, onAdd, onClick, variant = 'light', size = 'md' }: AddMangaButtonProps): React.ReactElement {
    const handleClick = (): void => {
        if (onClick) {
            // Use direct click handler if provided
            onClick();
        }
        else if (libraryId && onAdd) {
            // Use legacy pattern if libraryId and onAdd are provided
            logger.info(`Adding manga to library: ${libraryId}`);
            onAdd();
        }
        else {
            logger.warn('AddMangaButton: Either onClick or both libraryId and onAdd should be provided');
        }
    };
    return (<Button variant={variant} size={size} leftSection={<IconPlus size={20}/>} onClick={handleClick}>
      Add Manga
    </Button>);
}
