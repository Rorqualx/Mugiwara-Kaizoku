/**
 * AddComicWizard
 *
 * Page-level UI for adding a Western comicbook series. Owns the page chrome
 * (title, feature-flag gate, library picker) and delegates the search/grid
 * to the embeddable `ComicbookSearchPanel`. Same panel is reused inside the
 * `AddMangaModal` Comicbook tab — keeping the two entry points in sync by
 * sharing one component.
 *
 * On successful add, navigates to the new series detail page.
 */

import React, { useEffect, useState } from 'react';

import {
  Alert,
  Button,
  Container,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { ComicbookSearchPanel } from '@/components/comicbook/ComicbookSearchPanel';
import { useComicvineConfig } from '@/hooks/useComicvineConfig';
import { trpc } from '@/utils/trpc-client/index';

interface LibraryOption {
  value: string;
  label: string;
}

function useLibraryOptions(): LibraryOption[] {
  const librariesQuery = trpc.library.list.useQuery();
  const data = (librariesQuery.data ?? []) as Array<{ id: number; name: string }>;
  return data.map((lib) => ({ value: String(lib.id), label: lib.name }));
}

function FeatureDisabledNotice(): React.ReactElement {
  return (
    <Container size="xl" py="lg">
      <Stack gap="md">
        <Title order={2}>Add a Comicbook Series</Title>
        <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
          Comicbook tracking is disabled. Enable it under
          <Text span fw={500}> Settings → Metadata → ComicVine</Text>.
        </Alert>
        <Button component="a" href="/settings/metadata" variant="light" w="fit-content">
          Open ComicVine settings
        </Button>
      </Stack>
    </Container>
  );
}

export function AddComicWizard(): React.ReactElement {
  const router = useRouter();
  const [libraryId, setLibraryId] = useState<string | null>(null);

  const { config: cvConfig, isLoading: cvConfigLoading } = useComicvineConfig();
  const featureEnabled = cvConfig.comicbookTrackingEnabled;

  const libraryOptions = useLibraryOptions();
  const queryLibraryId = typeof router.query['libraryId'] === 'string' ? router.query['libraryId'] : null;
  useEffect(() => {
    if (libraryId) return;
    if (queryLibraryId) {
      setLibraryId(queryLibraryId);
      return;
    }
    const first = libraryOptions[0];
    if (first) setLibraryId(first.value);
  }, [libraryOptions, libraryId, queryLibraryId]);

  const handleComplete = (mangaId: number): void => {
    void router.push(`/manga/${mangaId}`);
  };

  if (!cvConfigLoading && !featureEnabled) {
    return <FeatureDisabledNotice />;
  }

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        <Title order={2}>Add a Comicbook Series</Title>
        <Text c="dimmed" size="sm">
          Search ComicVine for a Western comicbook series. Issues will be fetched
          automatically the first time you open the series.
        </Text>
        <Select
          label="Library"
          placeholder="Pick a library"
          data={libraryOptions}
          value={libraryId}
          onChange={setLibraryId}
          disabled={libraryOptions.length === 0}
          w={240}
        />
        {libraryId !== null && (
          <ComicbookSearchPanel libraryId={Number(libraryId)} onComplete={handleComplete} />
        )}
      </Stack>
    </Container>
  );
}
