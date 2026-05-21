/**
 * Provider Tabs Component
 *
 * Displays search results from multiple metadata providers in a tabbed interface.
 * Allows users to switch between different provider results and select the best match.
 */

import React from 'react';

import {
  Tabs,
  Badge,
  Group,
  Text,
  Card,
  Stack,
  Image,
  Button,
  ScrollArea,
  Loader,
  Alert,
  SimpleGrid} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';

interface ProviderResults {
  isLoading?: boolean;
  error?: string | Error;
  results?: unknown[];
}

interface ProviderTabsProps {
  providers: string[];
  providerResults: Record<string, unknown>;
  activeTab: string | null;
  selectedProvider: string;
  selectedSources: Record<string, unknown>;
  onTabChange: (value: string | null) => void;
  onProviderSelect: (provider: string) => void;
  onResultSelect: (provider: string, result: unknown) => void;
}

// Helper to safely access provider results
function getProviderResults(results: unknown): ProviderResults {
  if (!results || typeof results !== 'object') {
    return {};
  }

  const record = results as Record<string, unknown>;
  const providerResults: ProviderResults = {};

  if (typeof record['isLoading'] === 'boolean') {
    providerResults.isLoading = record['isLoading'];
  }

  if (record['error']) {
    providerResults.error = record['error'] as string | Error;
  }

  if (Array.isArray(record['results'])) {
    providerResults.results = record['results'];
  }

  return providerResults;
}

// Helper to get safe result ID
function getResultId(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') {
    return undefined;
  }
  const record = result as Record<string, unknown>;
  const id = record['id'];
  return typeof id === 'string' || typeof id === 'number' ? String(id) : undefined;
}

// Helper to get safe result property
function getResultProperty(result: unknown, key: string): string | undefined {
  if (!result || typeof result !== 'object') {
    return undefined;
  }
  const record = result as Record<string, unknown>;
  const value = record[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

export function ProviderTabs({
  providers,
  providerResults,
  activeTab,
  selectedProvider,
  selectedSources,
  onTabChange,
  onProviderSelect,
  onResultSelect
}: ProviderTabsProps): React.ReactElement {
  return (
    <Tabs value={activeTab} onChange={onTabChange}>
      <Tabs.List>
        {providers.map((provider) => {
          const rawResults = providerResults[provider];
          const results = getProviderResults(rawResults);
          const isSelected = selectedProvider === provider;
          const hasSelection = !!selectedSources[provider];

          return (
            <Tabs.Tab
              key={provider}
              value={provider}
              rightSection={
                <Group gap={4}>
                  {results.isLoading && <Loader size="xs" />}
                  {results.error && <IconAlertCircle size={14} color="red" />}
                  {hasSelection && <IconCheck size={14} color="green" />}
                  {results.results && (
                    <Badge size="sm" variant="filled">
                      {results.results.length}
                    </Badge>
                  )}
                </Group>
              }
            >
              <Text fw={isSelected ? 700 : 400}>
                {provider}
              </Text>
            </Tabs.Tab>
          );
        })}
      </Tabs.List>

      {providers.map((provider) => {
        const rawResults = providerResults[provider];
        const results = getProviderResults(rawResults);

        return (
          <Tabs.Panel key={provider} value={provider} pt="md">
            {results.isLoading && (
              <Stack align="center" py="xl">
                <Loader />
                <Text c="dimmed">Searching {provider}...</Text>
              </Stack>
            )}

            {results.error && (
              <Alert icon={<IconAlertCircle />} color="red" variant="light">
                Error searching {provider}: {String(results.error)}
              </Alert>
            )}

            {results.results && results.results.length > 0 && (
              <ScrollArea h={400}>
                <SimpleGrid cols={1} spacing="md">
                  {results.results.map((result: unknown, index: number) => {
                    const resultId = getResultId(result);
                    const selectedSource = selectedSources[provider];
                    const selectedId = selectedSource && typeof selectedSource === 'object' ? getResultId(selectedSource) : undefined;
                    const isSelected = resultId !== undefined && selectedId !== undefined && resultId === selectedId;
                    
                    const title = getResultProperty(result, 'title');
                    const coverImage = getResultProperty(result, 'coverImage');
                    const author = getResultProperty(result, 'author');
                    const year = getResultProperty(result, 'year');
                    const chapters = getResultProperty(result, 'chapters');
                    const status = getResultProperty(result, 'status');
                    const source = getResultProperty(result, 'source');

                    return (
                      <Card
                        key={`${provider}-${resultId ?? index}`}
                        shadow="sm"
                        padding="md"
                        radius="md"
                        withBorder={isSelected}
                        style={{
                          borderColor: isSelected ? 'var(--mantine-color-blue-6)' : undefined,
                          cursor: 'pointer'
                        }}
                        onClick={() => onResultSelect(provider, result)}
                      >
                        <Group gap="md" wrap="nowrap">
                          {coverImage && (
                            <Image
                              src={coverImage}
                              alt={title ?? 'Manga cover'}
                              width={60}
                              height={90}
                              fit="cover"
                              radius="sm"
                            />
                          )}

                          <Stack gap="xs" style={{ flex: 1 }}>
                            <Group justify="space-between">
                              <Text fw={600} size="md">
                                {title ?? 'Unknown Title'}
                              </Text>
                              {isSelected && (
                                <Badge color="blue" variant="filled">
                                  Selected
                                </Badge>
                              )}
                            </Group>

                            {author && (
                              <Text size="sm" c="dimmed">
                                By {author}
                              </Text>
                            )}

                            {year && (
                              <Text size="sm" c="dimmed">
                                Year: {year}
                              </Text>
                            )}

                            {chapters && (
                              <Text size="sm" c="dimmed">
                                Chapters: {chapters}
                              </Text>
                            )}

                            <Group gap="xs">
                              {status && (
                                <Badge size="sm" variant="light">
                                  {status}
                                </Badge>
                              )}
                              {source && (
                                <Badge size="sm" variant="dot">
                                  {source}
                                </Badge>
                              )}
                            </Group>
                          </Stack>
                        </Group>
                      </Card>
                    );
                  })}
                </SimpleGrid>
              </ScrollArea>
            )}

            {results.results?.length === 0 && (
              <Alert icon={<IconAlertCircle />} color="yellow" variant="light">
                No results found on {provider}
              </Alert>
            )}
            
            <Group justify="center" mt="md">
              <Button
                variant={selectedProvider === provider ? 'filled' : 'light'}
                onClick={() => onProviderSelect(provider)}
                disabled={!selectedSources[provider]}
              >
                Use {provider} Data
              </Button>
            </Group>
          </Tabs.Panel>
        );
      })}
    </Tabs>
  );
}