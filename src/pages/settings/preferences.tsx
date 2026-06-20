/**
 * My Preferences Page (per-user)
 *
 * Every authenticated user can set their own download/language/content
 * preferences here. Each value overrides the admin's global default for THIS
 * user only (stored in `UserConfig`); "Reset" reverts to the global value.
 * Backed by the `userSettings` tRPC router.
 *
 * @module pages/settings/preferences
 */
import React from 'react';
import type { ReactElement } from 'react';

import {
  Container,
  Title,
  Text,
  Stack,
  Card,
  Group,
  Switch,
  Select,
  MultiSelect,
  Button,
  Badge,
  Loader,
  Center,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import SettingsLayout from '@/components/layouts/SettingsLayout';
import { trpc } from '@/utils/trpc-client';

type FieldKind = 'boolean' | 'select' | 'multiselect';

interface PrefField {
  key: string;
  label: string;
  description: string;
  kind: FieldKind;
  options?: { value: string; label: string }[];
}

const LANGS: { value: string; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
  { value: 'es', label: 'Spanish' },
  { value: 'es-la', label: 'Spanish (LatAm)' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt-br', label: 'Portuguese (BR)' },
  { value: 'it', label: 'Italian' },
  { value: 'ru', label: 'Russian' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
];

const CONTENT_RATINGS: { value: string; label: string }[] = [
  { value: 'safe', label: 'Safe' },
  { value: 'suggestive', label: 'Suggestive' },
  { value: 'erotica', label: 'Erotica' },
  { value: 'pornographic', label: 'Pornographic' },
];

const FIELDS: PrefField[] = [
  {
    key: 'download.mode',
    label: 'Download mode',
    description: 'Bias downloads toward volume packs, individual chapters, or a mix.',
    kind: 'select',
    options: [
      { value: 'mix', label: 'Mix (default)' },
      { value: 'prefer-volume', label: 'Prefer volumes' },
      { value: 'prefer-chapter', label: 'Prefer chapters' },
    ],
  },
  {
    key: 'mangadex.preferredLanguage',
    label: 'Preferred language (MangaDex)',
    description: 'Scanlation language preferred for your downloads.',
    kind: 'select',
    options: LANGS,
  },
  {
    key: 'comicvine.preferredLanguage',
    label: 'Preferred language (ComicVine)',
    description: 'Preferred language for ComicVine metadata/results.',
    kind: 'select',
    options: LANGS,
  },
  {
    key: 'mangadex.includeAdult',
    label: 'Include adult content (MangaDex)',
    description: 'Allow adult-rated results in MangaDex queries.',
    kind: 'boolean',
  },
  {
    key: 'mangadex.defaultContentRating',
    label: 'Content ratings (MangaDex)',
    description: 'Which content ratings to include by default.',
    kind: 'multiselect',
    options: CONTENT_RATINGS,
  },
  {
    key: 'anilist.filterAdultContent',
    label: 'Filter adult content (AniList)',
    description: 'Hide adult-rated titles from AniList browse/discover.',
    kind: 'boolean',
  },
  {
    key: 'anilist.filterWebtoons',
    label: 'Filter webtoons (AniList)',
    description: 'Hide webtoons from AniList browse/discover.',
    kind: 'boolean',
  },
  {
    key: 'anilist.filterKoreanManhwa',
    label: 'Filter Korean manhwa (AniList)',
    description: 'Hide Korean manhwa from AniList browse/discover.',
    kind: 'boolean',
  },
];

interface EffectiveRow {
  key: string;
  value: unknown;
  globalValue: unknown;
  isOverride: boolean;
}

interface PrefFieldCardProps {
  field: PrefField;
  row: EffectiveRow | undefined;
  onSet: (key: string, value: unknown) => void;
  onReset: (key: string) => void;
}

/** Render the right control for one preference field. */
function PrefControl({ field, value, onSet }: {
  field: PrefField;
  value: unknown;
  onSet: (key: string, value: unknown) => void;
}): React.ReactElement {
  if (field.kind === 'boolean') {
    return (
      <Switch
        checked={value === true}
        onChange={(e) => onSet(field.key, e.currentTarget.checked)}
      />
    );
  }
  if (field.kind === 'multiselect') {
    return (
      <MultiSelect
        data={field.options ?? []}
        value={Array.isArray(value) ? (value as string[]) : []}
        onChange={(v) => onSet(field.key, v)}
        w={260}
        clearable
      />
    );
  }
  return (
    <Select
      data={field.options ?? []}
      value={typeof value === 'string' ? value : null}
      onChange={(v) => { if (v !== null) onSet(field.key, v); }}
      w={200}
      allowDeselect={false}
      searchable
    />
  );
}

function PrefFieldCard({ field, row, onSet, onReset }: PrefFieldCardProps): React.ReactElement {
  const isOverride = row?.isOverride ?? false;
  return (
    <Card withBorder padding="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div style={{ flex: 1 }}>
          <Group gap="xs">
            <Text fw={600}>{field.label}</Text>
            {isOverride && <Badge size="xs" color="blue" variant="light">Custom</Badge>}
          </Group>
          <Text size="sm" c="dimmed">{field.description}</Text>
        </div>
        <Group gap="sm" align="center" wrap="nowrap">
          <PrefControl field={field} value={row?.value} onSet={onSet} />
          {isOverride && (
            <Button size="xs" variant="subtle" color="gray" onClick={() => onReset(field.key)}>
              Reset
            </Button>
          )}
        </Group>
      </Group>
    </Card>
  );
}

function PreferencesPage(): React.ReactElement {
  const utils = trpc.useUtils();
  const effective = trpc.userSettings.getEffective.useQuery();
  const setMutation = trpc.userSettings.set.useMutation({
    onSuccess: () => { void utils.userSettings.getEffective.invalidate(); },
    onError: (e) => notifications.show({ color: 'red', title: 'Could not save', message: e.message }),
  });
  const resetMutation = trpc.userSettings.reset.useMutation({
    onSuccess: () => { void utils.userSettings.getEffective.invalidate(); },
  });

  const byKey = new Map((effective.data ?? []).map((e) => [e.key, e]));
  const onSet = (key: string, value: unknown): void => { setMutation.mutate({ key, value }); };
  const onReset = (key: string): void => { resetMutation.mutate({ key }); };

  return (
    <SettingsLayout title="My Preferences">
      <Container size="md" py="xl">
        <Title order={2} mb="xs">My Preferences</Title>
        <Text c="dimmed" mb="xl">
          These apply to your account only. Each overrides the system default;
          reset any of them to fall back to the admin&apos;s global setting.
        </Text>

        {effective.isLoading ? (
          <Center py="xl"><Loader /></Center>
        ) : (
          <Stack gap="md">
            {FIELDS.map((field) => (
              <PrefFieldCard
                key={field.key}
                field={field}
                row={byKey.get(field.key)}
                onSet={onSet}
                onReset={onReset}
              />
            ))}
          </Stack>
        )}
      </Container>
    </SettingsLayout>
  );
}

PreferencesPage.getLayout = function getLayout(page: ReactElement): React.ReactElement {
  return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};

export default PreferencesPage;
