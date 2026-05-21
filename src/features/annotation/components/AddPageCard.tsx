/**
 * AddPageCard Component
 *
 * Inline form for adding new pages to the annotation system.
 * Supports URLs from Fandom, Wikipedia, AniList, and ComicVine.
 */

import React, { useState, useEffect } from 'react';

import {
  Card,
  Title,
  Text,
  TextInput,
  Button,
  Group,
  Stack,
  Alert,
  Badge,
  Paper,
  Progress,
  Code,
  Autocomplete,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconLink,
  IconPlus,
  IconAlertCircle,
  IconCheck,
  IconWorldWww,
  IconDatabase,
  IconSearch,
} from '@tabler/icons-react';

import { getTrainingTitleOptions, TRAINING_TITLES_COUNT } from '@/server/ml/training/training-titles';
import { api } from '@/utils/api';

import { QuickAddSearchModal } from './QuickAddSearchModal';

// ============================================================================
// Types
// ============================================================================

interface AddPageFormValues {
  url: string;
  mangaTitle: string;
}

type SourceType = 'FANDOM' | 'WIKIPEDIA' | 'ANILIST' | 'COMICVINE';

interface ProcessingState {
  status: 'idle' | 'fetching' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function detectSourceType(url: string): SourceType | null {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('fandom.com') || urlLower.includes('.wikia.com')) return 'FANDOM';
  if (urlLower.includes('wikipedia.org')) return 'WIKIPEDIA';
  if (urlLower.includes('anilist.co')) return 'ANILIST';
  if (urlLower.includes('comicvine.gamespot.com')) return 'COMICVINE';
  return null;
}

function getSourceColor(source: SourceType | null): string {
  const colors: Record<SourceType, string> = {
    FANDOM: 'orange',
    WIKIPEDIA: 'blue',
    ANILIST: 'cyan',
    COMICVINE: 'red',
  };
  return source ? colors[source] : 'gray';
}

function validateUrl(value: string): string | null {
  if (!value.trim()) return 'URL is required';
  try {
    new URL(value);
  } catch {
    return 'Invalid URL format';
  }
  const source = detectSourceType(value);
  if (!source) return 'URL must be from Fandom, Wikipedia, AniList, or ComicVine';
  return null;
}

/**
 * Converts a URL slug to a human-readable title.
 * Examples: "one-piece" -> "One Piece", "One_Piece" -> "One Piece"
 */
function formatSlugToTitle(slug: string): string {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/%20/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

function extractFandomTitle(hostname: string): string | null {
  const subdomain = hostname.split('.')[0];
  if (subdomain && subdomain !== 'www') {
    return formatSlugToTitle(subdomain);
  }
  return null;
}

function extractWikipediaTitle(pathname: string): string | null {
  const pathMatch = pathname.match(/\/wiki\/([^/]+)/);
  if (!pathMatch?.[1]) return null;
  const title = pathMatch[1].replace(/_\([^)]+\)$/, '');
  return formatSlugToTitle(title);
}

function extractAnilistTitle(pathname: string): string | null {
  const pathParts = pathname.split('/').filter(Boolean);
  if (pathParts.length >= 3 && pathParts[2]) {
    return formatSlugToTitle(pathParts[2]);
  }
  return null;
}

function extractComicvineTitle(pathname: string): string | null {
  const pathParts = pathname.split('/').filter(Boolean);
  if (pathParts[0]) {
    return formatSlugToTitle(pathParts[0]);
  }
  return null;
}

/**
 * Extracts manga title from URL based on source type patterns.
 */
function extractMangaTitleFromUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const source = detectSourceType(url);

    if (!source) return null;

    const extractors: Record<SourceType, () => string | null> = {
      FANDOM: () => extractFandomTitle(parsedUrl.hostname),
      WIKIPEDIA: () => extractWikipediaTitle(parsedUrl.pathname),
      ANILIST: () => extractAnilistTitle(parsedUrl.pathname),
      COMICVINE: () => extractComicvineTitle(parsedUrl.pathname),
    };

    return extractors[source]();
  } catch {
    return null;
  }
}

// ============================================================================
// Sub-components
// ============================================================================

function ProcessingAlert({ processing }: { processing: ProcessingState }): React.ReactElement | null {
  if (processing.status === 'idle') return null;

  if (processing.status === 'complete') {
    return (
      <Alert color="green" mb="md" icon={<IconCheck size={16} />}>
        Page added successfully!
      </Alert>
    );
  }

  const isError = processing.status === 'error';

  return (
    <Alert color={isError ? 'red' : 'blue'} mb="md" icon={isError ? <IconAlertCircle size={16} /> : undefined}>
      <Stack gap="xs">
        <Text size="sm">{processing.message}</Text>
        {!isError && <Progress value={processing.progress} size="sm" animated />}
        {processing.error && <Code color="red" block>{processing.error}</Code>}
      </Stack>
    </Alert>
  );
}

function SourceBadges(): React.ReactElement {
  return (
    <Group gap="xs">
      <Badge color="orange" size="sm" leftSection={<IconWorldWww size={10} />}>Fandom</Badge>
      <Badge color="blue" size="sm" leftSection={<IconWorldWww size={10} />}>Wikipedia</Badge>
      <Badge color="cyan" size="sm" leftSection={<IconDatabase size={10} />}>AniList</Badge>
      <Badge color="red" size="sm" leftSection={<IconDatabase size={10} />}>ComicVine</Badge>
    </Group>
  );
}

// ============================================================================
// QuickAddSection Component
// ============================================================================

function QuickAddSection({ onPageAdded }: { onPageAdded?: (() => void) | undefined }): React.ReactElement {
  const [modalOpened, setModalOpened] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState('');
  const [initialSearchQuery, setInitialSearchQuery] = useState('');

  // Training titles for dropdown
  const mangaOptions = React.useMemo(() => getTrainingTitleOptions().map((t) => t.label), []);

  const handleOpenSearch = (title?: string): void => {
    setInitialSearchQuery(title ?? selectedTitle);
    setModalOpened(true);
  };

  return (
    <>
      <Card withBorder p="md">
        <Title order={5} mb="xs">Quick Add</Title>
        <Text size="xs" c="dimmed" mb="sm">
          Select from {TRAINING_TITLES_COUNT} training titles or search providers.
        </Text>

        <Autocomplete
          data={mangaOptions}
          value={selectedTitle}
          onChange={setSelectedTitle}
          placeholder="Type to search titles..."
          size="sm"
          mb="sm"
          limit={20}
          maxDropdownHeight={200}
        />

        <Group gap="xs">
          <Button
            size="xs"
            leftSection={<IconSearch size={12} />}
            onClick={() => handleOpenSearch()}
            disabled={!selectedTitle}
            style={{ flex: 1 }}
          >
            Search "{selectedTitle.slice(0, 15)}{selectedTitle.length > 15 ? '...' : ''}"
          </Button>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconSearch size={12} />}
            onClick={() => handleOpenSearch('')}
          >
            Browse All
          </Button>
        </Group>
      </Card>

      <QuickAddSearchModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        onPageAdded={onPageAdded}
        initialQuery={initialSearchQuery}
      />
    </>
  );
}

// ============================================================================
// Add Page Form
// ============================================================================

function AddPageForm({ onPageAdded }: { onPageAdded?: () => void }): React.ReactElement {
  const [processing, setProcessing] = useState<ProcessingState>({
    status: 'idle',
    progress: 0,
    message: '',
  });

  const addFromUrlMutation = api.annotation.addFromUrl.useMutation({
    onSuccess: () => {
      setProcessing({ status: 'complete', progress: 100, message: 'Page added successfully!' });
      form.reset();
      onPageAdded?.();
      setTimeout(() => setProcessing({ status: 'idle', progress: 0, message: '' }), 3000);
    },
    onError: (error) => {
      setProcessing({ status: 'error', progress: 0, message: 'Failed to add page', error: error.message });
    },
  });

  const form = useForm<AddPageFormValues>({
    initialValues: { url: '', mangaTitle: '' },
    validate: { url: validateUrl },
  });

  // Auto-populate manga title from URL when URL changes and title is empty
  useEffect(() => {
    const url = form.values.url;
    const currentTitle = form.values.mangaTitle;

    // Only auto-populate if mangaTitle is empty
    if (!currentTitle && url) {
      const extractedTitle = extractMangaTitleFromUrl(url);
      if (extractedTitle) {
        form.setFieldValue('mangaTitle', extractedTitle);
      }
    }
  }, [form.values.url]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (values: AddPageFormValues): void => {
    setProcessing({ status: 'fetching', progress: 30, message: 'Fetching and processing page...' });
    addFromUrlMutation.mutate({
      url: values.url,
      mangaTitle: values.mangaTitle ? values.mangaTitle : undefined,
    });
  };

  const detectedSource = form.values.url ? detectSourceType(form.values.url) : null;
  const isProcessing = addFromUrlMutation.isPending || processing.status === 'fetching';

  return (
    <Card withBorder p="md">
      <Title order={4} mb="xs">Add Page</Title>
      <Text size="xs" c="dimmed" mb="md">Enter a URL from supported sources to add for annotation.</Text>

      <ProcessingAlert processing={processing} />

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="sm">
          <TextInput
            label="Page URL"
            placeholder="https://onepiece.fandom.com/wiki/One_Piece"
            leftSection={<IconLink size={14} />}
            rightSection={detectedSource && <Badge color={getSourceColor(detectedSource)} size="xs">{detectedSource}</Badge>}
            size="sm"
            {...form.getInputProps('url')}
            onChange={(e) => form.setFieldValue('url', e.currentTarget.value)}
            required
          />

          <TextInput
            label="Manga Title"
            description="Optional - helps organize pages"
            placeholder="One Piece"
            size="sm"
            {...form.getInputProps('mangaTitle')}
          />

          <Paper withBorder p="xs" bg="gray.0">
            <Text size="xs" c="dimmed" mb="xs">Supported Sources:</Text>
            <SourceBadges />
          </Paper>

          <Button type="submit" leftSection={<IconPlus size={14} />} loading={isProcessing} size="sm">
            Add Page
          </Button>
        </Stack>
      </form>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface AddPageCardProps {
  onPageAdded?: () => void;
}

export function AddPageCard({ onPageAdded }: AddPageCardProps): React.ReactElement {
  return (
    <Group grow align="flex-start" gap="md">
      <AddPageForm {...(onPageAdded ? { onPageAdded } : {})} />
      <QuickAddSection onPageAdded={onPageAdded} />
    </Group>
  );
}
