/**
 * Manga Search Results Component
 * 
 * This module provides components for displaying and selecting manga search results:
 * - MangaSearchResults: Main component for displaying a grid of selectable manga results
 * - ImageCheckbox: Reusable component for displaying a selectable manga item with image and details
 * 
 * @module components/addManga/mangaSearchResults
 */

"use client";

import React from "react";
import { useEffect, useState } from 'react';

import {
  Grid,
  Group,
  Image,
  ScrollArea,
  Text,
  UnstyledButton,
  Box } from
'@mantine/core';
import { useUncontrolled } from '@mantine/hooks';

/**
 * Interface representing a manga search result item
 * 
 * @interface IMangaSearchResult
 * @property {number} id - Unique identifier for the manga
 * @property {string} title - Title of the manga
 * @property {string} cover - URL of the manga's cover image
 * @property {string} description - Description or summary of the manga
 * @property {string} status - Publication status of the manga (e.g., 'Ongoing', 'Completed')
 */
export interface IMangaSearchResult {
  id: number;
  title: string;
  cover: string;
  description: string;
  status: string;
}

/**
 * Props for the MangaSearchResults component
 * 
 * @interface MangaSearchResultProps
 * @property {IMangaSearchResult[] | null} items - Array of manga search results to display
 * @property {(selected: IMangaSearchResult | null) => void} onSelect - Callback function when a manga is selected/deselected
 */
interface MangaSearchResultProps {
  items: IMangaSearchResult[] | null;
  onSelect: (selected: IMangaSearchResult | null) => void;
}

/**
 * Props for the ImageCheckbox component
 * 
 * @interface ImageCheckboxProps
 * @property {boolean} [checked] - Controlled checked state
 * @property {boolean} [defaultChecked] - Default checked state for uncontrolled usage
 * @property {(checked: boolean) => void} [onChange] - Callback when checked state changes
 * @property {string} title - Title to display
 * @property {string} description - Description to display
 * @property {string} image - Image URL
 * @property {boolean} [disabled] - Whether the checkbox is disabled
 */
interface ImageCheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  title: string;
  description: string;
  image: string;
  disabled?: boolean;
}

/**
 * ImageCheckbox Component
 * 
 * A custom checkbox component that displays an image with title and description.
 * Supports both controlled and uncontrolled usage through the Mantine useUncontrolled hook.
 * 
 * @param {ImageCheckboxProps} props - Component props
 * @returns {JSX.Element} The rendered component
 * 
 * @example
 * ```tsx
 * <ImageCheckbox
 *   image="/manga-cover.jpg"
 *   title="One Piece"
 *   description="Ongoing"
 *   checked={isSelected}
 *   onChange={handleSelect}
 * />
 * ```
 */
function ImageCheckbox({
  checked,
  defaultChecked,
  onChange,
  title,
  description,
  image,
  disabled = false,
  ...others
}: ImageCheckboxProps): React.ReactElement {
  const [value, handleChange] = useUncontrolled({
    value: checked ?? false,
    defaultValue: defaultChecked ?? false,
    finalValue: false,
    onChange: (newValue) => onChange?.(newValue)
  });

  const handleClick = (): void => {
    if (!disabled) handleChange(!value);
  };

  return (
    <UnstyledButton
      {...others}
      onClick={handleClick}
      data-disabled={disabled}
      aria-checked={value}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        transition: 'all 150ms ease',
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 'var(--mantine-radius-sm)',
        padding: 'var(--mantine-spacing-sm)',
        backgroundColor: value ?
        'var(--mantine-primary-color-light)' :
        'var(--mantine-color-white)',
        borderColor: value ?
        'var(--mantine-primary-color)' :
        'var(--mantine-color-gray-3)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        '&:hover': {
          backgroundColor: disabled ?
          undefined :
          value ?
          'var(--mantine-primary-color-light-hover)' :
          'var(--mantine-color-gray-0)'
        },
        ...(disabled && {
          backgroundColor: 'var(--mantine-color-gray-1)'
        })
      }}>

      <Image
        src={image || '/cover-not-found.jpg'}
        w={42}
        h={64}
        alt={`Cover for ${title}`}
        fallbackSrc="/cover-not-found.jpg" />


      <Box ml="md" style={{ flex: 1 }}>
        <Text
          c="dimmed"
          lh={1}
          size="xs"
          mb={5}
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>

          {description || 'No description available'}
        </Text>
        <Text
          fw={500}
          lh={1}
          size="sm"
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>

          {title}
        </Text>
      </Box>
    </UnstyledButton>);

}

/**
 * MangaSearchResults Component
 * 
 * Displays a grid of manga search results as selectable items.
 * Only one manga can be selected at a time, and selecting a new manga will deselect the previous one.
 * 
 * @param {MangaSearchResultProps} props - Component props
 * @returns {JSX.Element} The rendered component
 * 
 * @example
 * ```tsx
 * <MangaSearchResults
 *   items={searchResults}
 *   onSelect={(selected) => {
 *     if (selected) {
 *       logger.info(`Selected manga: ${selected["title"]}`);
 *     }
 *   }}
 * />
 * ```
 */
export default function MangaSearchResults({ items, onSelect }: MangaSearchResultProps): React.ReactElement {
  const [selected, setSelected] = useState<IMangaSearchResult | null>(null);

  useEffect(() => {
    if (!(items ?? []).some((item) => item["id"] === selected?.id)) {
      setSelected(null);
      onSelect(null);
    }
  }, [items, selected, onSelect]);

  const handleSelect = (item: IMangaSearchResult, checked: boolean): void => {
    const newSelected = checked ? item : null;
    setSelected(newSelected);
    onSelect(newSelected);
  };

  return (
    <ScrollArea>
      <Group gap="md" grow>
        {(items ?? []).map((item) =>
        <Grid.Col key={item["id"]} span={6}>
            <ImageCheckbox
            image={item.cover}
            title={item["title"]}
            description={item["status"] || 'Unknown status'}
            checked={selected?.id === item["id"]}
            disabled={!!selected && selected["id"] !== item["id"]}
            onChange={(checked) => handleSelect(item, checked)} />

          </Grid.Col>
        )}
      </Group>
    </ScrollArea>);

}