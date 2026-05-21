/**
 * ProviderResults Component
 * 
 * Displays search results from metadata providers
 */

import React, { memo, useCallback, useState, useMemo } from 'react';

import {
  Stack,
  Card,
  Group,
  Text,
  Badge,
  Button,
  ActionIcon,
  Collapse,
  SimpleGrid,
  Box,
  Tooltip,
  ScrollArea,
  Center,
  Loader,
  Alert } from
'@mantine/core';
import {
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconExternalLink,
  IconRefresh,
  IconAlertCircle } from
'@tabler/icons-react';

import type { ExtendedMangaSearchResult } from '@/types/search.types';

import { ProviderBadge } from '../core/ProviderBadge';
import { ProgressiveImage } from '../performance/LazyLoad';
import { VirtualList } from '../performance/VirtualList';

interface ProviderResultsProps {
  provider: string;
  results: ExtendedMangaSearchResult[];
  isLoading?: boolean;
  error?: Error | null;
  selectedResult?: ExtendedMangaSearchResult;
  onSelect?: (result: ExtendedMangaSearchResult) => void;
  onRetry?: () => void;
  showConfidence?: boolean;
  maxHeight?: number;
  virtualScroll?: boolean;
  compactMode?: boolean;
}

/**
 * Individual result card
 */
// eslint-disable-next-line complexity -- Complex UI component with multiple conditional renders
const ResultCard = memo(function ResultCard({
  result,
  provider,
  isSelected,
  onSelect,
  showConfidence,
  compact







}: {result: ExtendedMangaSearchResult;provider: string;isSelected: boolean;onSelect: () => void;showConfidence?: boolean;compact?: boolean;}) {
  const [expanded, setExpanded] = useState(false);

  const confidence = useMemo(() => {
    // Calculate confidence based on available fields
    let score = 0;
    let maxScore = 0;

    const checkField = (value: unknown, weight: number = 1): void => {
      maxScore += weight;
      if (value && (Array.isArray(value) ? value.length > 0 : true)) {
        score += weight;
      }
    };

    checkField(result["title"], 3);
    checkField(result["description"], 2);
    checkField(result.cover ?? result.coverImage, 2);
    checkField(result["status"], 1);
    checkField(result["genres"], 1);
    checkField(result["authors"], 1);
    checkField(result.year, 1);

    return maxScore > 0 ? Math.round(score / maxScore * 100) : 0;
  }, [result]);

  if (compact) {
    return (
      <Card
        withBorder
        padding="xs"
        style={{
          borderColor: isSelected ? 'var(--mantine-color-blue-5)' : undefined,
          backgroundColor: isSelected ? 'var(--mantine-color-blue-0)' : undefined,
          cursor: 'pointer'
        }}
        onClick={onSelect}>

        <Group gap="xs" wrap="nowrap">
          <ProgressiveImage
            src={result.cover ?? result.coverImage ?? '/placeholder-cover.jpg'}
            alt={result["title"]}
            width={40}
            height={60} />

          <Stack gap={2} style={{ flex: 1 }}>
            <Text size="sm" fw={500} lineClamp={1}>{result["title"]}</Text>
            <Group gap="xs">
              {result.year &&
              <Text size="xs" c="dimmed">{result.year}</Text>
              }
              {showConfidence &&
              <Badge size="xs" color={confidence > 70 ? 'green' : confidence > 40 ? 'yellow' : 'red'}>
                  {confidence}%
                </Badge>
              }
            </Group>
          </Stack>
          {isSelected &&
          <ActionIcon color="blue" variant="filled" size="sm">
              <IconCheck size={14} />
            </ActionIcon>
          }
        </Group>
      </Card>);

  }

  return (
    <Card
      withBorder
      padding="md"
      style={{
        borderColor: isSelected ? 'var(--mantine-color-blue-5)' : undefined,
        backgroundColor: isSelected ? 'var(--mantine-color-blue-0)' : undefined
      }}>

      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="xs">
            <ProviderBadge provider={provider} size="sm" />
            {showConfidence &&
            <Badge
              size="sm"
              color={confidence > 70 ? 'green' : confidence > 40 ? 'yellow' : 'red'}
              variant="light">

                {confidence}% match
              </Badge>
            }
          </Group>
          <Group gap="xs">
            {result.url &&
            <Tooltip label="View on source">
                <ActionIcon
                size="sm"
                variant="subtle"
                component="a"
                href={result.url}
                target="_blank">

                  <IconExternalLink size={14} />
                </ActionIcon>
              </Tooltip>
            }
            <Button
              size="xs"
              variant={isSelected ? 'filled' : 'light'}
              leftSection={isSelected ? <IconCheck size={14} /> : undefined}
              onClick={onSelect}>

              {isSelected ? 'Selected' : 'Select'}
            </Button>
          </Group>
        </Group>

        <Group gap="md" align="flex-start">
          <ProgressiveImage
            src={result.cover ?? result.coverImage ?? '/placeholder-cover.jpg'}
            alt={result["title"]}
            width={80}
            height={120} />

          
          <Stack gap="xs" style={{ flex: 1 }}>
            <div>
              <Text fw={600} size="md">{result["title"]}</Text>
              {result["alternativeTitles"] && result["alternativeTitles"].length > 0 &&
              <Text size="xs" c="dimmed">
                  Also: {result["alternativeTitles"].slice(0, 2).join(', ')}
                </Text>
              }
            </div>

            {result["description"] &&
            <Text size="sm" c="dimmed" {...(!expanded && { lineClamp: 2 })}>
                {result["description"]}
              </Text>
            }

            <Group gap="xs" wrap="wrap">
              {result["status"] &&
              <Badge size="xs" color="blue" variant="light">
                  {result["status"]}
                </Badge>
              }
              {result.year &&
              <Badge size="xs" color="gray" variant="light">
                  {result.year}
                </Badge>
              }
              {result["genres"]?.slice(0, 3).map((genre, i) =>
              <Badge key={i} size="xs" variant="outline">
                  {genre}
                </Badge>
              )}
            </Group>

            {(result["authors"] ?? result["chapters"] ?? result.volumes) &&
            <Button
              size="xs"
              variant="subtle"
              rightSection={expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
              onClick={() => setExpanded(!expanded)}>

                {expanded ? 'Less' : 'More'} details
              </Button>
            }
          </Stack>
        </Group>

        <Collapse in={expanded}>
          <SimpleGrid cols={2} spacing="xs">
            {result["authors"] && result["authors"].length > 0 &&
            <div>
                <Text size="xs" fw={500} c="dimmed">Authors</Text>
                <Text size="sm">{result["authors"].join(', ')}</Text>
              </div>
            }
            {result["chapters"] &&
            <div>
                <Text size="xs" fw={500} c="dimmed">Chapters</Text>
                <Text size="sm">{result["chapters"]}</Text>
              </div>
            }
            {result.volumes &&
            <div>
                <Text size="xs" fw={500} c="dimmed">Volumes</Text>
                <Text size="sm">{result.volumes}</Text>
              </div>
            }
            {result.startDate &&
            <div>
                <Text size="xs" fw={500} c="dimmed">Started</Text>
                <Text size="sm">{result.startDate ? String(result.startDate) : ''}</Text>
              </div>
            }
          </SimpleGrid>
        </Collapse>
      </Stack>
    </Card>);

});

/**
 * Provider results display component
 */
export default memo(function ProviderResults({
  provider,
  results,
  isLoading = false,
  error = null,
  selectedResult,
  onSelect,
  onRetry,
  showConfidence = true,
  maxHeight = 600,
  virtualScroll = true,
  compactMode = false
}: ProviderResultsProps) {
  const [searchTerm, _setSearchTerm] = useState('');

  // Filter results based on search
  const filteredResults = useMemo(() => {
    if (!searchTerm) return results;

    const term = searchTerm.toLowerCase();
    return results.filter((result) =>
    result["title"].toLowerCase().includes(term) ||
    (result["alternativeTitles"]?.some((alt) => alt.toLowerCase().includes(term)) ??
    result["description"]?.toLowerCase().includes(term))
    );
  }, [results, searchTerm]);

  const renderResult = useCallback((result: ExtendedMangaSearchResult, _index: number) =>
  <Box mb="sm">
      <ResultCard
      result={result}
      provider={provider}
      isSelected={selectedResult?.id === result["id"]}
      onSelect={() => onSelect?.(result)}
      showConfidence={showConfidence}
      compact={compactMode} />

    </Box>,
  [provider, selectedResult, onSelect, showConfidence, compactMode]);

  // Loading state
  if (isLoading) {
    return (
      <Center h={200}>
        <Stack align="center" gap="sm">
          <Loader size="lg" />
          <Text size="sm" c="dimmed">Searching {provider}...</Text>
        </Stack>
      </Center>);

  }

  // Error state
  if (error) {
    return (
      <Alert
        icon={<IconAlertCircle size={16} />}
        title="Search Failed"
        color="red"
        variant="light">

        <Stack gap="xs">
          <Text size="sm">{(error instanceof Error ? error.message : String(error))}</Text>
          {onRetry &&
          <Button
            size="xs"
            variant="light"
            color="red"
            leftSection={<IconRefresh size={14} />}
            onClick={onRetry}>

              Try Again
            </Button>
          }
        </Stack>
      </Alert>);

  }

  // No results
  if (results.length === 0) {
    return (
      <Alert
        icon={<IconAlertCircle size={16} />}
        title="No Results"
        color="gray"
        variant="light">

        <Text size="sm">No manga found from {provider}</Text>
      </Alert>);

  }

  // Results display
  if (virtualScroll && results.length > 10) {
    return (
      <VirtualList
        items={filteredResults}
        height={maxHeight}
        estimateSize={compactMode ? 80 : 200}
        renderItem={renderResult}
        gap={8}
        overscan={3}
        emptyState={
        <Center h={200}>
            <Text c="dimmed">No results match your search</Text>
          </Center>
        } />);


  }

  return (
    <ScrollArea h={maxHeight} type="auto">
      <Stack gap="sm">
        {filteredResults.map((result) =>
        <ResultCard
          key={String(result["id"])}
          result={result}
          provider={provider}
          isSelected={selectedResult?.id === result["id"]}
          onSelect={() => onSelect?.(result)}
          showConfidence={showConfidence}
          compact={compactMode} />

        )}
      </Stack>
    </ScrollArea>);

});