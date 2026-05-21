/**
 * Provider Matching Panel Component
 *
 * This component provides a UI for matching manga across different providers.
 * It can be used in manga detail pages to find and link the same manga
 * on different platforms.
 */
import React, { useState } from 'react';

import { Paper, Title, Text, Button, Group, Stack, Badge, Card, Loader, Alert, ActionIcon, Tooltip, Select, Collapse, Divider } from '@mantine/core';
import { IconSearch, IconLink, IconExternalLink, IconRefresh, IconChevronDown, IconChevronUp, IconAlertCircle} from '@tabler/icons-react';

import { useMangaProviderMatching } from '@/hooks/useProviderMatching';
import type { ProviderMatchResult } from '@/server/services/metadata/providerMatchingService';
import { logger } from '@/utils/logger';
interface ProviderMatchingPanelProps {
    /**
     * Manga ID from database
     */
    mangaId: number;
    /**
     * Manga title
     */
    mangaTitle: string;
    /**
     * Current provider/source
     */
    currentProvider: string;
    /**
     * Whether to show as a compact view
     */
    compact?: boolean;
    /**
     * Callback when a match is selected
     */
    onMatchSelect?: (match: ProviderMatchResult) => void;
}
/**
 * Provider names mapping for display
 */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
    anilist: 'AniList',
    comicvine: 'ComicVine',
    fandom: 'Fandom Wiki'
};
/**
 * Provider colors for badges
 */
const PROVIDER_COLORS: Record<string, string> = {
    anilist: 'blue',
    comicvine: 'red',
    fandom: 'purple'
};
export function ProviderMatchingPanel({ mangaId, mangaTitle, currentProvider, compact = false, onMatchSelect }: ProviderMatchingPanelProps): React.ReactElement {
    const [expanded, setExpanded] = useState(!compact);
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
    const [matchResults, setMatchResults] = useState<Record<string, ProviderMatchResult[]>>({});
    const { isLoading, error, availableProviders, matchWithAllProviders, findOnProvider, getEnrichedMetadata } = useMangaProviderMatching(mangaId, mangaTitle, currentProvider);
    /**
     * Handle finding matches across all providers
     */
    const handleFindMatches = async (): Promise<void> => {
        const result = await matchWithAllProviders();
        if (result !== null && result !== undefined && typeof result === 'object') {
            const resultObj = result as unknown as { matches?: ProviderMatchResult[] };
            const matches = resultObj.matches;
            if (Array.isArray(matches)) {
                // Group matches by provider
                const grouped: Record<string, ProviderMatchResult[]> = {};
                matches.forEach((match: ProviderMatchResult) => {
                    grouped[match.provider] ??= [];
                    const providerMatches = grouped[match.provider];
                    if (providerMatches !== undefined) {
                        providerMatches.push(match);
                    }
                });
                setMatchResults(grouped);
            }
        }
    };
    /**
     * Handle finding match on specific provider
     */
    const handleFindOnProvider = async (): Promise<void> => {
        if (!selectedProvider)
            return;
        const result = await findOnProvider(selectedProvider);
        if (result) {
            setMatchResults((prev) => ({
                ...prev,
                [selectedProvider]: [result]
            }));
        }
    };
    /**
     * Handle enriching metadata
     */
    const handleEnrichMetadata = async (): Promise<void> => {
        const metadata = await getEnrichedMetadata();
        if (metadata) {
            // You can display or use the enriched metadata here
            logger.info('Enriched metadata:', metadata);
        }
    };
    /**
     * Get confidence color
     */
    const getConfidenceColor = (confidence: number): string => {
        if (confidence >= 0.9)
            return 'green';
        if (confidence >= 0.7)
            return 'yellow';
        if (confidence >= 0.5)
            return 'orange';
        return 'red';
    };
    /**
     * Render match card
     */
    const renderMatchCard = (match: ProviderMatchResult): React.ReactElement => <Card key={`${match.provider}-${match.providerId}`} withBorder p="sm">
      <Group justify="space-between" align="flex-start">
        <Stack gap="xs" style={{ flex: 1 }}>
          <Group gap="xs">
            <Badge color={PROVIDER_COLORS[match.provider] ?? 'gray'} variant="filled" size="sm">

              {PROVIDER_DISPLAY_NAMES[match.provider] ?? match.provider}
            </Badge>
            <Badge color={getConfidenceColor(match.confidence)} variant="light" size="sm">

              {(match.confidence * 100).toFixed(0)}% match
            </Badge>
          </Group>
          
          <Text size="sm" fw={500}>{match["title"]}</Text>
          
          {match["metadata"] &&
            <Text size="xs" c="dimmed" lineClamp={2}>
              {match["metadata"]["description"]}
            </Text>}
          
          <Text size="xs" c="dimmed">
            ID: {match.providerId}
          </Text>
        </Stack>
        
        <Group gap="xs">
          {onMatchSelect &&
            <Tooltip label="Use this match">
              <ActionIcon variant="light" color="blue" onClick={() => onMatchSelect(match)}>

                <IconLink size={16}/>
              </ActionIcon>
            </Tooltip>}
          
          <Tooltip label="Open on provider site">
            <ActionIcon variant="light" onClick={() => {
            // Implement opening provider URL
            logger.info('Open on provider:', match);
        }}>

              <IconExternalLink size={16}/>
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Card>;
    return (<Paper p="md" withBorder>
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between">
          <Group gap="xs">
            <Title order={5}>Provider Matching</Title>
            {compact &&
            <ActionIcon variant="subtle" onClick={() => setExpanded(!expanded)} size="sm">

                {expanded ? <IconChevronUp size={16}/> : <IconChevronDown size={16}/>}
              </ActionIcon>}
          </Group>
          
          {!compact &&
            <Badge variant="light">
              Current: {PROVIDER_DISPLAY_NAMES[currentProvider] ?? currentProvider}
            </Badge>}
        </Group>

        <Collapse in={expanded}>
          <Stack gap="md">
            {/* Error Alert */}
            {error &&
            <Alert icon={<IconAlertCircle size={16}/>} color="red" variant="light">

                {(error instanceof Error ? error.message : String(error))}
              </Alert>}

            {/* Action Buttons */}
            <Group>
              <Button leftSection={<IconSearch size={16}/>} onClick={() => { void handleFindMatches(); }} loading={isLoading} variant="filled">

                Find All Matches
              </Button>
              
              <Group gap="xs">
                <Select placeholder="Select provider" data={availableProviders.
            filter((p: string) => p !== currentProvider).
            map((p: string) => ({
            value: p,
            label: PROVIDER_DISPLAY_NAMES[p] ?? p
        }))} value={selectedProvider} onChange={setSelectedProvider} size="sm" style={{ width: 180 }}/>

                
                <Button size="sm" variant="light" onClick={() => { void handleFindOnProvider(); }} disabled={!selectedProvider} loading={isLoading}>

                  Search
                </Button>
              </Group>
              
              <Tooltip label="Get enriched metadata from all sources">
                <Button variant="subtle" leftSection={<IconRefresh size={16}/>} onClick={() => { void handleEnrichMetadata(); }} loading={isLoading}>

                  Enrich
                </Button>
              </Tooltip>
            </Group>

            {/* Results */}
            {Object.keys(matchResults).length > 0 &&
            <>
                <Divider />
                <Stack gap="md">
                  <Text size="sm" fw={500}>
                    Found matches on {Object.keys(matchResults).length} provider(s)
                  </Text>
                  
                  {Object.entries(matchResults).map(([provider, matches]) => <Stack key={provider} gap="sm">
                      <Group gap="xs">
                        <Badge color={PROVIDER_COLORS[provider] ?? 'gray'} variant="light">

                          {PROVIDER_DISPLAY_NAMES[provider] ?? provider}
                        </Badge>
                        <Text size="sm" c="dimmed">
                          {matches.length} match{matches.length !== 1 ? 'es' : ''}
                        </Text>
                      </Group>
                      
                      <Stack gap="xs">
                        {matches.map(renderMatchCard)}
                      </Stack>
                    </Stack>)}
                </Stack>
              </>}

            {/* Loading State */}
            {isLoading &&
            <Stack align="center" py="xl">
                <Loader size="sm"/>
                <Text size="sm" c="dimmed">Searching providers...</Text>
              </Stack>}

            {/* Empty State */}
            {!isLoading && Object.keys(matchResults).length === 0 && !error &&
            <Text size="sm" c="dimmed" ta="center" py="xl">
                No matches found yet. Click "Find All Matches" to search.
              </Text>}
          </Stack>
        </Collapse>
      </Stack>
    </Paper>);
}
