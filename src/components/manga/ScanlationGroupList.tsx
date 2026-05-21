/**
 * Scanlation Group List Component
 *
 * Displays scanlation groups for a manga with preference controls.
 * Allows users to mark groups as preferred, excluded, or neutral.
 *
 * @module components/manga/ScanlationGroupList
 */

import React from 'react';

import {
  ActionIcon,
  Badge,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Title,
  Tooltip
} from '@mantine/core';
import {
  IconCheck,
  IconExternalLink,
  IconStar,
  IconStarFilled,
  IconX
} from '@tabler/icons-react';

import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

interface ScanlationGroupListProps {
  mangaId: number;
  language?: string;
}

export function ScanlationGroupList({
  mangaId,
  language = 'en'
}: ScanlationGroupListProps): React.ReactElement {
  const utils = trpc.useUtils();

  // Fetch groups for this manga
  const { data: groups, isLoading, error } = trpc.scanlationGroup.getMangaGroups.useQuery({
    mangaId,
    language
  });

  // Mutation for setting group preference
  const setPreference = trpc.scanlationGroup.setGroupPreference.useMutation({
    onSuccess: () => {
      notify({ severity: 'SUCCESS', title: 'Preference Updated', message: 'Group preference has been saved' });
      void utils.scanlationGroup.getMangaGroups.invalidate({ mangaId, language });
    },
    onError: (err) => {
      notify({ severity: 'ERROR', title: 'Update Failed', message: err.message });
    }
  });

  const handlePreferenceChange = (
    groupId: string,
    currentPreference: 'preferred' | 'excluded' | 'neutral',
    action: 'prefer' | 'exclude' | 'clear'
  ): void => {
    let newPreference: 'preferred' | 'excluded' | 'neutral';

    if (action === 'prefer') {
      newPreference = currentPreference === 'preferred' ? 'neutral' : 'preferred';
    } else if (action === 'exclude') {
      newPreference = currentPreference === 'excluded' ? 'neutral' : 'excluded';
    } else {
      newPreference = 'neutral';
    }

    setPreference.mutate({
      mangaId,
      groupId,
      preference: newPreference,
      language
    });
  };

  if (isLoading) {
    return (
      <Card withBorder>
        <Stack align="center" p="md">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Loading scanlation groups...</Text>
        </Stack>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder>
        <Text c="red" size="sm">Failed to load groups: {error.message}</Text>
      </Card>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <Card withBorder>
        <Text c="dimmed" size="sm">No scanlation groups found for this manga.</Text>
      </Card>
    );
  }

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={5}>Scanlation Groups</Title>
          <Text size="xs" c="dimmed">{groups.length} group{groups.length !== 1 ? 's' : ''}</Text>
        </Group>

        {groups.map((item) => (
          <Card key={item.group.id} withBorder p="xs">
            <Group justify="space-between" wrap="nowrap">
              <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                <Group gap="xs">
                  <Text size="sm" fw={500} truncate>
                    {item.group.name}
                  </Text>
                  {item.group.isOfficial && (
                    <Badge size="xs" color="blue" variant="light">Official</Badge>
                  )}
                  {item.group.isInactive && (
                    <Badge size="xs" color="gray" variant="light">Inactive</Badge>
                  )}
                </Group>

                <Group gap="xs">
                  <Text size="xs" c="dimmed">
                    {item.chapterCount} chapter{item.chapterCount !== 1 ? 's' : ''}
                  </Text>
                  {item.lastActivity && (
                    <Text size="xs" c="dimmed">
                      · Last active: {new Date(item.lastActivity).toLocaleDateString()}
                    </Text>
                  )}
                </Group>

                {item.group.focusedLanguages.length > 0 && (
                  <Group gap={4}>
                    {item.group.focusedLanguages.slice(0, 3).map((lang: string) => (
                      <Badge key={lang} size="xs" variant="outline">
                        {lang.toUpperCase()}
                      </Badge>
                    ))}
                  </Group>
                )}
              </Stack>

              <Group gap={4} wrap="nowrap">
                {item.group.website && (
                  <Tooltip label="Visit Website">
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      component="a"
                      href={item.group.website}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <IconExternalLink size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}

                <Tooltip label={item.preference === 'preferred' ? 'Remove preference' : 'Prefer this group'}>
                  <ActionIcon
                    variant={item.preference === 'preferred' ? 'filled' : 'subtle'}
                    color={item.preference === 'preferred' ? 'yellow' : 'gray'}
                    size="sm"
                    onClick={() => handlePreferenceChange(item.group.id, item.preference, 'prefer')}
                    loading={setPreference.isPending}
                  >
                    {item.preference === 'preferred' ? (
                      <IconStarFilled size={14} />
                    ) : (
                      <IconStar size={14} />
                    )}
                  </ActionIcon>
                </Tooltip>

                <Tooltip label={item.preference === 'excluded' ? 'Remove exclusion' : 'Exclude this group'}>
                  <ActionIcon
                    variant={item.preference === 'excluded' ? 'filled' : 'subtle'}
                    color={item.preference === 'excluded' ? 'red' : 'gray'}
                    size="sm"
                    onClick={() => handlePreferenceChange(item.group.id, item.preference, 'exclude')}
                    loading={setPreference.isPending}
                  >
                    {item.preference === 'excluded' ? (
                      <IconX size={14} />
                    ) : (
                      <IconX size={14} />
                    )}
                  </ActionIcon>
                </Tooltip>

                {item.preference !== 'neutral' && (
                  <Tooltip label="Clear preference">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      onClick={() => handlePreferenceChange(item.group.id, item.preference, 'clear')}
                      loading={setPreference.isPending}
                    >
                      <IconCheck size={14} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Group>
          </Card>
        ))}
      </Stack>
    </Card>
  );
}
