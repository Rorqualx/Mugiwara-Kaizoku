// File: src/components/headerContent.tsx

/**
 * Header content component with search functionality
 * 
 * This component provides the main header content including logo,
 * search functionality, and system menu. Features include:
 * - Integrated search with popover results
 * - Logo and title navigation
 * - System menu integration
 * - Responsive design
 * - Provider selection for search
 */

import React from "react";
import { useState, useCallback } from "react";

import {
  Box,
  Group,
  Title,
  UnstyledButton,
  TextInput,
  Popover,
  Paper,
  Text,
  Center,
  Loader } from
"@mantine/core";
import { IconSearch, IconMenu2 } from '@tabler/icons-react';
import Image from "next/image";
import Link from "next/link";

import { useNavigation } from "@/hooks/useNavigation";

// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { useSearch } from "../hooks/useSearch";

import { NotificationsDropdown } from "./NotificationsDropdown";
import { SearchResults } from "./search/SearchResults";
import { SystemMenu } from "./systemMenu";

import type { UseSearchResult } from "../hooks/useSearch";
import type { SearchResult } from "../types/search.types";



interface LibrarySearchResult extends SearchResult {
  inLibrary: true;
  libraryId: number;
}

function isLibraryManga(manga: SearchResult): manga is LibrarySearchResult {
  const m = manga as unknown as Record<string, unknown>;
  return m['inLibrary'] === true && typeof m['libraryId'] === 'number';
}

export type SearchSource = 'main' | 'modal';

/**
 * Props for the KaizokuHeaderContent component
 */
export interface KaizokuHeaderContentProps {
  /** 
   * Search source to use. Determines which search context to use.
   * @default 'main'
   */
  searchSource?: SearchSource;
  /** 
   * Whether to show the menu button (for tablet/mobile)
   * @default false
   */
  showMenuButton?: boolean;
  /**
   * Callback when menu button is clicked
   */
  onMenuClick?: () => void;
}

/**
 * Header content component with search functionality and navigation elements
 * 
 * @param props - Component props
 * @returns Header content component with search, logo, and menu
 */
export function KaizokuHeaderContent({
  searchSource = 'main',
  showMenuButton = false,
  onMenuClick
}: KaizokuHeaderContentProps): React.ReactNode {
  // State for search popover visibility
  const [searchOpened, setSearchOpened] = useState<boolean>(false);

  // Navigation hook
  const { navigateTo } = useNavigation();

  /**
   * Search hook integration for manga search functionality
   * Provides search state and handlers
   */
  const {
    query,
    setQuery,
    results,
    isLoading,
    error,
    handleMangaSelect
  }: UseSearchResult = useSearch(searchSource);

  /**
   * Handler for search input changes
   * Controls popover visibility based on input
   * 
   * @param event - Input change event
   */
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = event.currentTarget.value;
    setQuery(value);

    // Open the popover when there's text in the search field (minimum 1 character)
    setSearchOpened(value.length >= 1);
  }, [setQuery]);

  /**
   * Handler for manga selection from search results
   * Resets search state after selection
   * For library manga, navigates to the manga detail page
   *
   * @param manga - Selected manga search result
   */
  const handleMangaSelection = useCallback((manga: SearchResult): void => {
    if (isLibraryManga(manga)) {
      void navigateTo(`/manga/${manga.libraryId}`);
    } else {
      handleMangaSelect(manga);
    }
    setSearchOpened(false);
    setQuery('');
  }, [handleMangaSelect, setQuery, navigateTo]);

  /**
   * Handler for popover state changes
   * 
   * @param opened - New popover open state
   */
  const handlePopoverChange = useCallback((opened: boolean): void => {
    setSearchOpened(opened);
  }, []);


  return (
    <Box
      style={{
        height: '3.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingLeft: '0',
        paddingRight: '16px',
        width: '100%',
        backgroundColor: '#4a4a4a'
      }}>

        <Group>
          {/* Menu Button (for tablets/mobile) */}
          {showMenuButton &&
        <UnstyledButton
          onClick={onMenuClick}
          style={{
            padding: '8px',
            color: 'var(--mantine-color-gray-0)'
          }}>

              <IconMenu2 size={24} />
            </UnstyledButton>
        }

          {/* Logo and Title */}
          <Link href="/" passHref legacyBehavior>
            <UnstyledButton style={{ paddingLeft: showMenuButton ? '0px' : '8px' }}>
              <Group gap="0.625rem">
                <Image
                alt="Mugiwara-Kaizoku Logo"
                src="/kaizoku.png"
                height={48}
                width={48}
                style={{ objectFit: 'contain' }}
                unoptimized
                priority />

                <Title
                order={2}
                style={{
                  '@media (maxWidth: 768px)': {
                    display: 'none'
                  },
                  fontFamily: 'Ninja Naruto Regular, Inter',
                  lineHeight: '3.5rem',
                  fontWeight: 300,
                  marginTop: '0.625rem',
                  color: 'var(--mantine-color-gray-0)',
                  fontSize: '1.3rem'
                }}>

                  Mugiwara-Kaizoku
                </Title>
              </Group>
            </UnstyledButton>
          </Link>


          {/* Search Input */}
          <Box style={{ width: '280px' }}>
          <Popover
            width="target"
            position="bottom"
            shadow="md"
            opened={searchOpened && query.length >= 1} // Show when query is at least 1 char
            onChange={handlePopoverChange}>

            <Popover.Target>
              <TextInput
                placeholder="Search your library..."
                leftSection={<IconSearch size={16} />}
                value={query}
                onChange={handleSearchChange}
                size="xs"
                styles={{
                  root: {
                    width: '100%'
                  },
                  input: {
                    backgroundColor: 'transparent',
                    color: '#e0e0e0',
                    border: 'none',
                    borderBottom: '1px solid #777',
                    borderRadius: '0',
                    height: '28px',
                    fontSize: '0.85rem',
                    paddingLeft: '24px',
                    '&:focus': {
                      borderColor: 'transparent',
                      borderBottom: '1px solid #aaa',
                      boxShadow: 'none'
                    },
                    '&::placeholder': {
                      color: '#aaa',
                      fontStyle: 'italic',
                      fontSize: '0.8rem'
                    }
                  },
                  section: {
                    color: '#aaa',
                    paddingLeft: '0',
                    position: 'absolute',
                    left: '0',
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }
                }} />

            </Popover.Target>
            <Popover.Dropdown style={{ backgroundColor: '#333333', border: '1px solid #555' }}>
              <Paper style={{ maxHeight: '400px', overflow: 'auto' }}>
                {/* Show loading, error, or results */}
                {error ?
                <Text size="sm" c="red" ta="center" p="md">
                    {error}
                  </Text> :
                isLoading ?
                <Center p="md">
                    <Loader size="sm" />
                  </Center> :
                results.length === 0 ?
                <Text size="sm" c="dimmed" ta="center" p="md">
                    No results found for "{query}"
                  </Text> :

                <SearchResults
                  results={results}
                  onSelect={handleMangaSelection}
                  isLoading={isLoading}
                  error={error} />

                }
              </Paper>
            </Popover.Dropdown>
          </Popover>
        </Box>

        </Group>

        {/* System Menu */}
        <Group gap="0.3125rem" justify="flex-end">
          <NotificationsDropdown />
          <SystemMenu />
        </Group>
    </Box>);

}