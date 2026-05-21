'use client';

/**
 * Component for displaying manga search results in a card layout
 * 
 * This component renders a list of search results as cards, each showing
 * manga details including cover image, title, description, and metadata.
 * It handles multiple result types and various display states.
 * 
 * @remarks
 * Visual States:
 * - Loading: "Searching..." text
 * - Error: Red alert with error message
 * - Empty: "No results found" text
 * - Results: Stack of manga cards
 * 
 * Card Layout:
 * - Cover image (left)
 * - Content section (right):
 *   - Title with optional provider badge
 *   - Alternative title if available
 *   - Score and status if available
 *   - Truncated description
 *   - Select button
 * 
 * Error Handling:
 * - Fallback cover image
 * - Error state display
 * - Missing data handling
 * 
 * @example
 * ```tsx
 * // Basic usage with search results
 * <SearchResults
 *   results={searchResults}
 *   onSelect={(manga) => handleMangaSelection(manga)}
 *   isLoading={false}
 * />
 * 
 * // With provider badges
 * <SearchResults
 *   results={searchResults}
 *   onSelect={handleSelect}
 *   isLoading={false}
 *   showProvider={true}
 * />
 * ```
 */
import React from "react";

import { Card, Image, Text, Group, Stack, Button, Alert, Badge } from '@mantine/core';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconAlertCircle } from '@tabler/icons-react';
import { IconRocket } from '@tabler/icons-react';

import type { SearchResult, MangaResult } from '@/types/search.types';
import { logger } from '@/utils/logger';
import { isSearchResult } from '@/utils/search/searchResultGuards';

// ============================================================================
// Helper Functions
// ============================================================================

interface ProviderDisplayInfo {
  color: string;
  displayName: string;
}

/**
 * Get provider display information (badge color and formatted name)
 */
function getProviderDisplayInfo(provider: string): ProviderDisplayInfo {
  const providerLower = provider.toLowerCase();

  if (providerLower.includes('anilist')) {
    return { color: 'blue', displayName: 'AniList' };
  }
  if (providerLower.includes('comicvine')) {
    return { color: 'green', displayName: 'ComicVine' };
  }
  if (providerLower.includes('fandom')) {
    return { color: 'grape', displayName: 'Fandom' };
  }
  if (providerLower.includes('wikipedia')) {
    return { color: 'cyan', displayName: 'Wikipedia' };
  }
  // Default case
  return {
    color: 'blue',
    displayName: provider.charAt(0).toUpperCase() + provider.slice(1).toLowerCase()
  };
}

/**
 * Normalize/repair an invalid search result to ensure required fields exist
 */
function normalizeSearchResult(manga: MangaResult, _index: number): SearchResult {
  const unknownManga = manga as unknown as Record<string, unknown>;
  return {
    id: typeof unknownManga["id"] === 'string' ? unknownManga["id"] : `unknown-${Date.now()}`,
    title: typeof unknownManga["title"] === 'string' ? unknownManga["title"] : 'Unknown Manga',
    cover: typeof unknownManga["cover"] === 'string' ? unknownManga["cover"] : undefined,
    coverImage: typeof unknownManga["coverImage"] === 'string' ? unknownManga["coverImage"] : undefined,
    description: typeof unknownManga["description"] === 'string' ? unknownManga["description"] : 'No description available',
    status: typeof unknownManga["status"] === 'string' ? unknownManga["status"] : 'Unknown',
    alternativeTitles: Array.isArray(unknownManga["alternativeTitles"]) ? (unknownManga["alternativeTitles"] as string[]) : [],
    genres: Array.isArray(unknownManga["genres"]) ? (unknownManga["genres"] as string[]) : [],
    score: typeof unknownManga["score"] === 'number' ? unknownManga["score"] : undefined,
    popularity: typeof unknownManga["popularity"] === 'number' ? unknownManga["popularity"] : undefined,
    provider: typeof unknownManga["provider"] === 'string' ? unknownManga["provider"] : 'unknown',
    url: typeof unknownManga["url"] === 'string' ? unknownManga["url"] : undefined,
    wikiUrl: typeof unknownManga["wikiUrl"] === 'string' ? unknownManga["wikiUrl"] : undefined
  } as SearchResult;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface SearchResultContentProps {
  manga: SearchResult;
  index: number;
  showProvider: boolean;
  truncatedDescription: string;
}

/**
 * Content section of a search result card (title, badges, metadata, description)
 */
function SearchResultContent({
  manga,
  index,
  showProvider,
  truncatedDescription
}: SearchResultContentProps): React.ReactElement {
  // Get provider display info
  let providerText = '';
  let providerInfo: ProviderDisplayInfo = { color: 'blue', displayName: '' };

  if (showProvider && 'provider' in manga && manga.provider) {
    providerText = manga.provider;
    providerInfo = getProviderDisplayInfo(providerText);
  }

  // Check Wikipedia enhancement
  const isWikipediaEnhanced = 'enhancedWithWikipedia' in manga && manga.enhancedWithWikipedia;

  // Debug log for Comic Vine results
  if (providerText.includes('comicvine')) {
    logger.debug(`[SearchResults] Comic Vine result:`, {
      id: manga["id"],
      title: manga["title"],
      hasDescription: Boolean(manga["description"]),
      description: manga["description"]?.substring(0, 50),
      enhancedWithWikipedia: isWikipediaEnhanced,
      hasWikipediaData: 'wikipediaData' in manga && Boolean(manga.wikipediaData)
    });
  }

  const altTitle = manga["title"] || `Result ${index + 1}`;

  return (
    <Stack gap="xs" style={{ flex: 1 }}>
      {/* Title with provider badge */}
      <Group wrap="nowrap" justify="space-between" align="flex-start">
        <Text fw={700} size="lg" c="#eeeeee" lineClamp={2} style={{ flex: 1 }}>
          {altTitle}
        </Text>

        <Group gap="xs">
          {providerText && (
            <Badge color={providerInfo.color} size="md" radius="sm" variant="filled">
              {providerInfo.displayName}
            </Badge>
          )}

          {Boolean(isWikipediaEnhanced) && (
            <Badge color="violet" size="sm" radius="sm" variant="light">
              + Wikipedia
            </Badge>
          )}
        </Group>
      </Group>

      {/* Alternative titles */}
      {manga["alternativeTitles"] && manga["alternativeTitles"].length > 0 && (
        <Text size="sm" c="#aaaaaa" lineClamp={1}>
          Also known as: {manga["alternativeTitles"].slice(0, 2).join(', ')}
        </Text>
      )}

      {/* Score and status */}
      <Group mt={5}>
        {manga.score && (
          <Badge color="cyan" variant="light">
            Score: {manga.score}
          </Badge>
        )}

        {manga["status"] && manga["status"] !== 'UNKNOWN' && (
          <Badge color="yellow" variant="light">
            {manga["status"]}
          </Badge>
        )}

        {manga["genres"] && manga["genres"].length > 0 && (
          <Badge color="indigo" variant="light">
            {manga["genres"].slice(0, 2).join(', ')}
          </Badge>
        )}
      </Group>

      {/* Description */}
      <Text size="sm" c="#cccccc" lineClamp={3} mt={5}>
        {truncatedDescription}
      </Text>
    </Stack>
  );
}

interface SearchResultActionsProps {
  manga: SearchResult;
  enrichingId: string | null | undefined;
  onSelect: (manga: MangaResult) => void;
  onQuickAdd?: ((manga: MangaResult) => void) | undefined;
  isQuickAddEnabled: boolean;
}

/**
 * Action buttons for a search result card
 */
function SearchResultActions({
  manga,
  enrichingId,
  onSelect,
  onQuickAdd,
  isQuickAddEnabled
}: SearchResultActionsProps): React.ReactElement {
  const isEnriching = enrichingId === manga["id"];
  const isDisabled = enrichingId !== null && enrichingId !== manga["id"];
  const isInLibrary = 'inLibrary' in manga && manga.inLibrary;

  const buttonLabel = isEnriching
    ? 'Loading details...'
    : isInLibrary
      ? 'View'
      : 'Select';

  return (
    <Card.Section style={{ padding: '0.75rem', borderTop: '1px solid #444444' }}>
      <Group justify="flex-end">
        <Button
          variant="filled"
          color="blue"
          onClick={() => onSelect(manga)}
          radius="md"
          size="sm"
          loading={isEnriching}
          disabled={isDisabled}
        >
          {buttonLabel}
        </Button>

        {isQuickAddEnabled && onQuickAdd && !isInLibrary && (
          <Button
            variant="filled"
            color="orange"
            onClick={() => onQuickAdd(manga)}
            radius="md"
            size="sm"
            disabled={enrichingId !== null}
            leftSection={<IconRocket size={16} />}
          >
            Quick Add
          </Button>
        )}
      </Group>
    </Card.Section>
  );
}

interface SearchResultItemProps {
  manga: MangaResult;
  index: number;
  showProvider: boolean;
  enrichingId: string | null | undefined;
  onSelect: (manga: MangaResult) => void;
  onQuickAdd?: ((manga: MangaResult) => void) | undefined;
  isQuickAddEnabled: boolean;
}

/**
 * Individual search result card component
 * Extracted to reduce complexity of the main component
 */
function SearchResultItem({
  manga: rawManga,
  index,
  showProvider,
  enrichingId,
  onSelect,
  onQuickAdd,
  isQuickAddEnabled
}: SearchResultItemProps): React.ReactElement {
  // Normalize manga if invalid
  const manga = isSearchResult(rawManga) ? rawManga : (() => {
    logger.warn(`Invalid search result at index ${index} - attempting to repair`, JSON.stringify(rawManga));
    return normalizeSearchResult(rawManga, index);
  })();

  // Handle cover image with fallback
  const coverUrl = manga.coverImage ?? manga.cover;
  const imgSrc = coverUrl ?? '/cover-not-found.jpg';

  // Handle description
  const description = manga["description"] ?? 'No description available';
  const truncatedDescription = description.length > 200
    ? `${description.substring(0, 200).trim()}...`
    : description;

  const altText = manga["title"] || `Result ${index + 1}`;

  return (
    <Card
      data-testid="search-result-item"
      p="md"
      radius="md"
      withBorder
      style={{
        borderColor: '#555555',
        backgroundColor: index % 2 === 0 ? '#333333' : '#2C2C2C'
      }}
    >
      <Card.Section style={{ padding: '1rem', borderBottom: '1px solid #444444' }}>
        <Group wrap="nowrap" align="flex-start">
          {/* Cover image */}
          <Image
            src={imgSrc}
            alt={altText}
            height={150}
            width={100}
            fit="cover"
            radius="md"
            fallbackSrc="/cover-not-found.jpg"
            style={{ border: '1px solid #444444' }}
          />

          {/* Content section */}
          <SearchResultContent
            manga={manga}
            index={index}
            showProvider={showProvider}
            truncatedDescription={truncatedDescription}
          />
        </Group>
      </Card.Section>

      {/* Card actions */}
      <SearchResultActions
        manga={manga}
        enrichingId={enrichingId}
        onSelect={onSelect}
        onQuickAdd={onQuickAdd}
        isQuickAddEnabled={isQuickAddEnabled}
      />
    </Card>
  );
}

/**
 * Props for the SearchResults component
 */
interface SearchResultsProps {
  /** Array of manga search results to display */
  results: MangaResult[];
  /** Handler for manga selection */
  onSelect: (manga: MangaResult) => void;
  /** Whether search is currently in progress */
  isLoading: boolean;
  /** Optional error message to display */
  error?: string | null;
  /** Whether to show provider badges on results */
  showProvider?: boolean;
  /** ID of result currently being enriched */
  enrichingId?: string | null;
  /** Optional callback for quick-add */
  onQuickAdd?: (manga: MangaResult) => void;
  /** Whether quick-add is enabled */
  isQuickAddEnabled?: boolean;
}

/**
 * Displays a list of manga search results
 * 
 * This component handles multiple states:
 * 1. Loading state during search
 * 2. Error state when search fails
 * 3. Empty state when no results found
 * 4. Results display with manga cards
 * 
 * Each manga card displays:
 * - Cover image with fallback
 * - Title and alternative titles
 * - Provider badge (optional)
 * - Score and status if available
 * - Description preview
 * - Selection button
 * 
 * @param props - Component props
 * @returns Stack of manga result cards or appropriate status message
 */
export function SearchResults({ results, onSelect, error, showProvider = false, enrichingId, onQuickAdd, isQuickAddEnabled = false, isLoading }: SearchResultsProps): React.ReactElement {
  // Error state
  if (error) {
    return (
      <div data-testid="search-results">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Search Error"
          color="red"
          radius="md"
          data-testid="search-error">

          {error}
        </Alert>
      </div>);

  }

  // Loading state
  if (isLoading) {
    return (
      <div data-testid="search-results">
        <Group p="xl" justify="center" align="center" data-testid="search-loading">
          <Text c="dimmed" fs="italic" ta="center" size="lg">
            Searching your library...
          </Text>
        </Group>
      </div>);

  }

  // Empty state
  if (results.length === 0) {
    return (
      <div data-testid="search-results">
        <Card p="xl" radius="md" withBorder style={{ borderColor: '#555555' }}>
          <Stack align="center" gap="md">
            <Text c="dimmed" fs="italic" ta="center" size="lg">
              No results found.
            </Text>
            <Text c="dimmed" size="md" ta="center">
              Try these suggestions:
            </Text>
            <Stack ta="center" gap="xs" style={{ color: '#aaaaaa' }}>
              <Text size="sm">• Check for typos in your search term</Text>
              <Text size="sm">• Try a partial title match</Text>
              <Text size="sm">• The manga might not be in your library yet</Text>
            </Stack>
          </Stack>
        </Card>
      </div>);

  }

  // Results display
  return (
    <Stack gap="md" data-testid="search-results">
      {results.map((manga, index) => (
        <SearchResultItem
          key={manga["id"] || `result-${index}`}
          manga={manga}
          index={index}
          showProvider={showProvider}
          enrichingId={enrichingId}
          onSelect={onSelect}
          onQuickAdd={onQuickAdd}
          isQuickAddEnabled={isQuickAddEnabled}
        />
      ))}
    </Stack>
  );
}