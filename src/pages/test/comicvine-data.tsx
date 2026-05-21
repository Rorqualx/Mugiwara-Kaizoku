import { useState, useEffect } from 'react';

import { Container, Title, TextInput, Button, Stack, Paper, Text, ScrollArea, Group, Badge, Alert, Loader, Tabs, JsonInput, Image, Grid, Card } from '@mantine/core';
import { IconSearch, IconDatabase, IconList, IconInfoCircle, IconPhoto } from '@tabler/icons-react';

import {
  isComicVineImage,
  isArrayItemWithImage,
  isSearchResult
} from '@/types/test/comicvine-data-types';
import { logger } from '@/utils/logging';
import { trpc } from '@/utils/trpc-client';

export default function ComicVineDataTest(): React.ReactElement {
    const [searchTerm, setSearchTerm] = useState('Fire Force');
    const [query, setQuery] = useState('');
    const [selectedVolumeId, setSelectedVolumeId] = useState('');
    const [volumeDetails, setVolumeDetails] = useState<unknown>(null);
    const [issues, setIssues] = useState<unknown>(null);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);
    const [isFetchingIssues, setIsFetchingIssues] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // tRPC hooks
    const { data: searchResults, isLoading: isSearching, refetch: _searchComicVine } = trpc.search.withProvider.useQuery(
        { provider: 'COMICVINE', query: query },
        {
            enabled: query.length >= 3
        }
    );
    
    // Handle success and error effects
    useEffect(() => {
        if (searchResults && searchResults.length > 0) {
            logger.info(`Comic Vine search returned ${searchResults.length} results`);
            // Auto-select first result if available
            const firstResult = searchResults[0];
            if (firstResult) {
                setSelectedVolumeId(firstResult.id);
            }
        }
    }, [searchResults]);
    
    const volumeDetailsMutation = trpc["metadata"].fetchComicvineVolumeDetails.useMutation();
    const issuesMutation = trpc["metadata"].fetchComicVineIssues.useMutation();

    const handleSearch = (): void => {
        setError(null);
        setVolumeDetails(null);
        setIssues(null);
        
        logger.info(`Searching Comic Vine for: ${searchTerm}`);
        setQuery(searchTerm);
    };

    const fetchVolumeDetails = async (volumeId: string): Promise<void> => {
        setIsFetchingDetails(true);
        setVolumeDetails(null);
        
        try {
            logger.info(`Fetching Comic Vine volume details for ID: ${volumeId}`);
            const result = await volumeDetailsMutation.mutateAsync({ id: volumeId });
            
            logger.info('Comic Vine volume details received:', result);
            setVolumeDetails(result);
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to fetch volume details';
            logger.error('Comic Vine volume details error:', errorMsg);
            setError(errorMsg);
        } finally {
            setIsFetchingDetails(false);
        }
    };

    const fetchIssues = async (volumeId: string): Promise<void> => {
        setIsFetchingIssues(true);
        setIssues(null);
        
        try {
            logger.info(`Fetching Comic Vine issues for volume ID: ${volumeId}`);
            const result = await issuesMutation.mutateAsync({ volumeId });
            
            logger.info('Comic Vine issues received:', result);
            setIssues(result);
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to fetch issues';
            logger.error('Comic Vine issues error:', errorMsg);
            setError(errorMsg);
        } finally {
            setIsFetchingIssues(false);
        }
    };

    const handleVolumeSelect = async (volumeId: string): Promise<void> => {
        setSelectedVolumeId(volumeId);
        await Promise.all([
            fetchVolumeDetails(volumeId),
            fetchIssues(volumeId)
        ]);
    };

    const extractImageUrl = (imageData: unknown): string | null => {
        if (!imageData) return null;

        // Handle direct string URL
        if (typeof imageData === 'string') {
            return imageData;
        }

        // Handle Comic Vine image object structure
        if (isComicVineImage(imageData)) {
            // Try different possible image URLs in order of preference
            return imageData.super_url ??
                   imageData.screen_large_url ??
                   imageData.medium_url ??
                   imageData.small_url ??
                   imageData.thumb_url ??
                   imageData.icon_url ??
                   imageData.original_url ??
                   imageData.cover ??
                   null;
        }

        return null;
    };

    const renderFieldValue = (value: unknown, fieldName: string): React.ReactElement => {
        if (value === null) {
            return <Text c="dimmed" size="sm">null</Text>;
        }
        
        // Special handling for image fields
        if (fieldName.toLowerCase().includes('image') || fieldName.toLowerCase().includes('cover')) {
            const imageUrl = extractImageUrl(value);
            if (imageUrl) {
                return (
                    <Stack gap="xs">
                        <Image
                            src={imageUrl}
                            alt={fieldName}
                            height={200}
                            fit="contain"
                            fallbackSrc="https://via.placeholder.com/200x300?text=No+Image"
                        />
                        <Text size="xs" c="dimmed">URL: {imageUrl}</Text>
                        {typeof value === 'object' && (
                            <JsonInput
                                value={JSON.stringify(value, null, 2)}
                                readOnly
                                minRows={1}
                                maxRows={10}
                                label="Raw image data:"
                            />
                        )}
                    </Stack>
                );
            }
        }
        
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return <Text c="dimmed" size="sm">[] (empty array)</Text>;
            }
            
            // Check if array contains images
            const hasImages = value.some(item => isArrayItemWithImage(item));

            if (hasImages) {
                return (
                    <Stack gap="xs">
                        <Text size="sm" fw={500}>Array ({value.length} items):</Text>
                        <Grid>
                            {value.map((item, index) => {
                                if (!isArrayItemWithImage(item)) return null;
                                const imageUrl = extractImageUrl(item.image ?? item.cover ?? item);
                                return (
                                    <Grid.Col key={index} span={{ base: 12, sm: 6, md: 4 }}>
                                        <Card p="xs" withBorder>
                                            {imageUrl && (
                                                <Image
                                                    src={imageUrl}
                                                    alt={`${fieldName} ${index}`}
                                                    height={150}
                                                    fit="contain"
                                                    fallbackSrc="https://via.placeholder.com/150x200?text=No+Image"
                                                />
                                            )}
                                            {item.name && <Text size="xs" mt="xs">{item.name}</Text>}
                                            {item.issue_number && <Text size="xs">Issue #{item.issue_number}</Text>}
                                        </Card>
                                    </Grid.Col>
                                );
                            })}
                        </Grid>
                    </Stack>
                );
            }
            
            return (
                <Stack gap="xs">
                    <Text size="sm" fw={500}>Array ({value.length} items):</Text>
                    <ScrollArea h={200}>
                        <Stack gap="xs">
                            {value.map((item, index) => (
                                <Paper key={index} p="xs" withBorder>
                                    {typeof item === 'object' ? (
                                        <JsonInput
                                            value={JSON.stringify(item, null, 2)}
                                            readOnly
                                            minRows={1}
                                            maxRows={10}
                                        />
                                    ) : (
                                        <Text size="sm">{String(item)}</Text>
                                    )}
                                </Paper>
                            ))}
                        </Stack>
                    </ScrollArea>
                </Stack>
            );
        }
        
        if (typeof value === 'object') {
            return (
                <JsonInput
                    value={JSON.stringify(value, null, 2)}
                    readOnly
                    minRows={1}
                    maxRows={20}
                />
            );
        }
        
        if (typeof value === 'string' && value.length > 500) {
            return (
                <ScrollArea h={150}>
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                        {value}
                    </Text>
                </ScrollArea>
            );
        }
        
        return <Text size="sm">{String(value)}</Text>;
    };

    const renderDataSection = (data: unknown, title: string): React.ReactElement => {
        if (!data) return <></>;
        if (typeof data !== 'object') return <></>;

        const entries = Object.entries(data as Record<string, unknown>);
        
        return (
            <Paper p="md" withBorder>
                <Title order={4} mb="md">{title}</Title>
                <Stack gap="md">
                    {entries.map(([key, value]) => (
                        <div key={key}>
                            <Group justify="space-between" mb="xs">
                                <Text fw={600} size="sm">{key}:</Text>
                                <Badge size="xs" variant="light">
                                    {typeof value} {Array.isArray(value) && `[${value.length}]`}
                                </Badge>
                            </Group>
                            {renderFieldValue(value, key)}
                        </div>
                    ))}
                </Stack>
            </Paper>
        );
    };

    return (
        <Container size="xl" py="xl">
            <Stack gap="lg">
                <Title order={2}>Comic Vine Data Test Page</Title>
                
                {error && (
                    <Alert color="red" title="Error" onClose={() => setError(null)} withCloseButton>
                        {error}
                    </Alert>
                )}
                
                <Paper p="md" withBorder>
                    <Stack gap="md">
                        <Title order={4}>Search Comic Vine</Title>
                        <Group>
                            <TextInput
                                placeholder="Enter manga title..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                style={{ flex: 1 }}
                                leftSection={<IconSearch size={16} />}
                            />
                            <Button 
                                onClick={() => { void handleSearch(); }} 
                                loading={isSearching}
                                leftSection={<IconSearch size={16} />}
                            >
                                Search
                            </Button>
                        </Group>
                    </Stack>
                </Paper>

                {searchResults && (
                    <Paper p="md" withBorder>
                        <Title order={4} mb="md">
                            Search Results ({searchResults.length})
                        </Title>
                        <ScrollArea h={500}>
                            <Stack gap="sm">
                                {searchResults.map((result: unknown): React.ReactElement | null => {
                                    if (!isSearchResult(result)) return null;
                                    const coverUrl = extractImageUrl(result.image ?? result.coverImage);
                                    return (
                                        <Paper
                                            key={result.id}
                                            p="sm"
                                            withBorder
                                            style={{
                                                cursor: 'pointer',
                                                backgroundColor: selectedVolumeId === result.id ? 'var(--mantine-color-blue-light)' : undefined
                                            }}
                                            onClick={() => { void handleVolumeSelect(result.id); }}
                                        >
                                            <Group align="flex-start">
                                                {coverUrl && (
                                                    <Image
                                                        src={coverUrl}
                                                        alt={result.title ?? 'Cover'}
                                                        width={80}
                                                        height={120}
                                                        fit="cover"
                                                        fallbackSrc="https://via.placeholder.com/80x120?text=No+Cover"
                                                    />
                                                )}
                                                <div style={{ flex: 1 }}>
                                                    <Group justify="space-between">
                                                        <div>
                                                            <Text fw={500}>{result.title ?? 'Untitled'}</Text>
                                                            <Text size="xs" c="dimmed">ID: {result.id}</Text>
                                                        </div>
                                                        <Badge>{result.provider ?? 'Unknown'}</Badge>
                                                    </Group>
                                                    <Text size="sm" mt="xs" lineClamp={2}>{result.description ?? ''}</Text>
                                                    <Group gap="xs" mt="xs">
                                                        {result.volumes ? <Badge variant="light">Volumes: {String(result.volumes)}</Badge> : null}
                                                        {result.chapters ? <Badge variant="light">Chapters: {String(result.chapters)}</Badge> : null}
                                                        {result.year ? <Badge variant="light">Year: {String(result.year)}</Badge> : null}
                                                        {result.genres && result.genres.length > 0 ? (
                                                            <Badge variant="light" color="grape">
                                                                {result.genres.length} genres
                                                            </Badge>
                                                        ) : null}
                                                        {result.authors && result.authors.length > 0 ? (
                                                            <Badge variant="light" color="cyan">
                                                                {result.authors.length} authors
                                                            </Badge>
                                                        ) : null}
                                                    </Group>
                                                </div>
                                            </Group>
                                        </Paper>
                                    );
                                })}
                            </Stack>
                        </ScrollArea>
                    </Paper>
                )}

                {selectedVolumeId && (
                    <Tabs defaultValue="raw-search">
                        <Tabs.List>
                            <Tabs.Tab value="raw-search" leftSection={<IconDatabase size={14} />}>
                                Raw Search Result
                            </Tabs.Tab>
                            <Tabs.Tab value="volume-details" leftSection={<IconInfoCircle size={14} />}>
                                Volume Details {isFetchingDetails && <Loader size="xs" ml="xs" />}
                            </Tabs.Tab>
                            <Tabs.Tab value="issues" leftSection={<IconList size={14} />}>
                                Issues {isFetchingIssues && <Loader size="xs" ml="xs" />}
                            </Tabs.Tab>
                            <Tabs.Tab value="images" leftSection={<IconPhoto size={14} />}>
                                Images
                            </Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="raw-search" pt="md">
                            {searchResults && selectedVolumeId && (
                                renderDataSection(
                                    searchResults.find((r: unknown) => isSearchResult(r) && r.id === selectedVolumeId),
                                    `Raw Search Result for Volume ${selectedVolumeId}`
                                )
                            )}
                        </Tabs.Panel>

                        <Tabs.Panel value="volume-details" pt="md">
                            {isFetchingDetails ? (
                                <Paper p="xl" withBorder ta="center">
                                    <Loader />
                                    <Text mt="md">Fetching volume details...</Text>
                                </Paper>
                            ) : volumeDetails ? (
                                <Stack gap="md">
                                    {renderDataSection(volumeDetails, 'Volume Details Response')}
                                    {(volumeDetails as Record<string, unknown>)["data"] ? renderDataSection((volumeDetails as Record<string, unknown>)["data"], 'Volume Details Data') : null}
                                </Stack>
                            ) : (
                                <Paper p="xl" withBorder ta="center">
                                    <Text c="dimmed">Click a search result to fetch details</Text>
                                </Paper>
                            )}
                        </Tabs.Panel>

                        <Tabs.Panel value="issues" pt="md">
                            {isFetchingIssues ? (
                                <Paper p="xl" withBorder ta="center">
                                    <Loader />
                                    <Text mt="md">Fetching issues...</Text>
                                </Paper>
                            ) : issues ? (
                                <Stack gap="md">
                                    {renderDataSection(issues, 'Issues Response')}
                                    {(issues as Record<string, unknown>)["data"] ? renderDataSection((issues as Record<string, unknown>)["data"], 'Issues Data') : null}
                                    {((issues as Record<string, unknown>)["data"] as Record<string, unknown> | undefined)?.["issues"] ? (
                                        <Paper p="md" withBorder>
                                            <Title order={4} mb="md">Individual Issues ({(((issues as Record<string, unknown>)["data"] as Record<string, unknown>)["issues"] as unknown[]).length})</Title>
                                            <ScrollArea h={400}>
                                                <Stack gap="sm">
                                                    {(((issues as Record<string, unknown>)["data"] as Record<string, unknown>)["issues"] as unknown[]).map((issue: unknown, index: number) => (
                                                        <Paper key={index} p="sm" withBorder>
                                                            {renderDataSection(issue, `Issue #${(issue as Record<string, unknown>)["issue_number"] as string ?? index + 1}`)}
                                                        </Paper>
                                                    ))}
                                                </Stack>
                                            </ScrollArea>
                                        </Paper>
                                    ) : null}
                                </Stack>
                            ) : (
                                <Paper p="xl" withBorder ta="center">
                                    <Text c="dimmed">Click a search result to fetch issues</Text>
                                </Paper>
                            )}
                        </Tabs.Panel>

                        <Tabs.Panel value="images" pt="md">
                            <Paper p="md" withBorder>
                                <Title order={4} mb="md">All Images</Title>
                                <Grid>
                                    {searchResults && selectedVolumeId ? (() => {
                                        // Main volume cover
                                        const selectedResult = searchResults.find((r: unknown) => isSearchResult(r) && r.id === selectedVolumeId);
                                        if (!selectedResult || !isSearchResult(selectedResult)) return null;
                                        // Cast to ComicVineSearchResult after type guard validation
                                        const typedResult = selectedResult as import('@/types/test/comicvine-data-types').ComicVineSearchResult;
                                        const mainImageUrl = extractImageUrl(typedResult.image ?? typedResult.coverImage);
                                        if (mainImageUrl) {
                                            return (
                                                <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                                                    <Card p="xs" withBorder>
                                                        <Text size="sm" fw={500} mb="xs">Main Cover</Text>
                                                        <Image
                                                            src={mainImageUrl}
                                                            alt="Main Cover"
                                                            height={300}
                                                            fit="contain"
                                                            fallbackSrc="https://via.placeholder.com/200x300?text=No+Image"
                                                        />
                                                        <Text size="xs" c="dimmed" mt="xs">{mainImageUrl}</Text>
                                                    </Card>
                                                </Grid.Col>
                                            );
                                        }
                                        return null;
                                    })() : null}
                                    {(volumeDetails as Record<string, unknown> | undefined)?.["image"] ? (() => {
                                        // Volume details images
                                        const detailImageUrl = extractImageUrl((volumeDetails as Record<string, unknown>)["image"]);
                                        if (detailImageUrl) {
                                            return (
                                                <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                                                    <Card p="xs" withBorder>
                                                        <Text size="sm" fw={500} mb="xs">Volume Detail Cover</Text>
                                                        <Image
                                                            src={detailImageUrl}
                                                            alt="Volume Detail Cover"
                                                            height={300}
                                                            fit="contain"
                                                            fallbackSrc="https://via.placeholder.com/200x300?text=No+Image"
                                                        />
                                                        <Text size="xs" c="dimmed" mt="xs">{detailImageUrl}</Text>
                                                    </Card>
                                                </Grid.Col>
                                            );
                                        }
                                        return null;
                                    })() : null}
                                    {((issues as Record<string, unknown> | undefined)?.["data"] as Record<string, unknown> | undefined)?.["issues"] ? (((issues as Record<string, unknown>)["data"] as Record<string, unknown>)["issues"] as unknown[]).map((issue: unknown, index: number) => {
                                        // Issue covers
                                        const issueRecord = issue as Record<string, unknown>;
                                        const issueImageUrl = extractImageUrl(issueRecord["image"]);
                                        if (issueImageUrl) {
                                            return (
                                                <Grid.Col key={index} span={{ base: 12, sm: 6, md: 4 }}>
                                                    <Card p="xs" withBorder>
                                                        <Text size="sm" fw={500} mb="xs">
                                                            Issue #{(issueRecord["issue_number"] as string) ?? index + 1}
                                                        </Text>
                                                        <Image
                                                            src={issueImageUrl}
                                                            alt={`Issue ${(issueRecord["issue_number"] as string)}`}
                                                            height={300}
                                                            fit="contain"
                                                            fallbackSrc="https://via.placeholder.com/200x300?text=No+Image"
                                                        />
                                                        {issueRecord["name"] ? <Text size="xs" mt="xs">{issueRecord["name"] as string}</Text> : null}
                                                        <Text size="xs" c="dimmed" mt="xs">{issueImageUrl}</Text>
                                                    </Card>
                                                </Grid.Col>
                                            );
                                        }
                                        return null;
                                    }) : null}
                                </Grid>
                            </Paper>
                        </Tabs.Panel>
                    </Tabs>
                )}
            </Stack>
        </Container>
    );
}