import React, { useState, useCallback } from 'react';

import {
  Stack,
  Group,
  Button,
  TextInput,
  Text,
  Badge,
  ActionIcon,
  Box,
  Paper,
  CloseButton,
  Menu
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconCheck,
  IconDots,
  IconEdit
} from '@tabler/icons-react';

import { BUILT_IN_PRESETS } from '@/store/libraryViewSlice';
import type { FilterPreset, FilterOption, AdvancedFilter, SortOption } from '@/store/libraryViewSlice';
import { notify } from '@/utils/notify';
interface PresetListProps {
  filterPresets: FilterPreset[];
  activePresetId: string | null;
  currentFilters: FilterOption[];
  currentAdvancedFilters: AdvancedFilter;
  currentSortBy?: SortOption | undefined;
  onSavePreset: (preset: Omit<FilterPreset, 'id'>) => void;
  onApplyPreset: (id: string) => void;
  onUpdatePreset: (id: string, updates: Partial<FilterPreset>) => void;
  onDeletePreset: (id: string) => void;
}

export function PresetList({
  filterPresets,
  activePresetId,
  currentFilters,
  currentAdvancedFilters,
  currentSortBy,
  onSavePreset,
  onApplyPreset,
  onUpdatePreset,
  onDeletePreset
}: PresetListProps): React.ReactElement {
  const [presetName, setPresetName] = useState('');
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingPresetName, setEditingPresetName] = useState('');

  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) {
      notify({ severity: 'ERROR', title: 'Invalid Name', message: 'Please enter a name for the preset' });
      return;
    }

    const presetData: Omit<FilterPreset, 'id'> = {
      name: presetName.trim(),
      filters: currentFilters,
      advancedFilters: currentAdvancedFilters,
      ...(currentSortBy !== undefined && { sortBy: currentSortBy })
    };
    onSavePreset(presetData);

    notify({ severity: 'SUCCESS', title: 'Preset Saved', message: `Filter preset "${presetName}" saved successfully` });

    setPresetName('');
  }, [presetName, currentFilters, currentAdvancedFilters, currentSortBy, onSavePreset]);

  const handleUpdatePresetName = useCallback((id: string) => {
    if (!editingPresetName.trim()) return;

    onUpdatePreset(id, { name: editingPresetName.trim() });
    setEditingPresetId(null);
    setEditingPresetName('');

    notify({ severity: 'SUCCESS', title: 'Preset Updated', message: 'Filter preset name updated' });
  }, [editingPresetName, onUpdatePreset]);

  const handleDeletePreset = useCallback((preset: FilterPreset) => {
    onDeletePreset(preset.id);
    notify({ severity: 'ERROR', title: 'Preset Deleted', message: `Filter preset "${preset.name}" deleted` });
  }, [onDeletePreset]);

  return (
    <Stack gap="md">
      <Box>
        <Text size="xs" c="dimmed" fw={500} mb="xs">Quick Presets</Text>
        <Group gap={6}>
          {BUILT_IN_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              size="xs"
              variant={activePresetId === preset.id ? 'filled' : 'light'}
              onClick={() => onApplyPreset(preset.id)}
            >
              {preset.name}
            </Button>
          ))}
        </Group>
      </Box>

      <Paper p="sm" withBorder>
        <Group>
          <TextInput
            placeholder="Enter preset name..."
            value={presetName}
            onChange={(e) => setPresetName(e.currentTarget.value)}
            style={{ flex: 1 }}
            size="sm"
          />
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleSavePreset}
            disabled={!presetName.trim()}
            size="sm"
          >
            Save Current
          </Button>
        </Group>
      </Paper>

      {filterPresets.length === 0 ? (
        <Text ta="center" c="dimmed" py="xl">
          No custom presets saved yet
        </Text>
      ) : (
        <Stack gap="xs">
          {filterPresets.map((preset) => (
            <Paper
              key={preset.id}
              p="sm"
              withBorder
              style={{
                borderColor: activePresetId === preset.id ? 'var(--mantine-color-blue-5)' : undefined,
                backgroundColor: activePresetId === preset.id ? 'rgba(25, 113, 194, 0.1)' : undefined
              }}
            >
              <Group justify="space-between">
                <Box style={{ flex: 1 }}>
                  {editingPresetId === preset.id ? (
                    <Group gap="xs">
                      <TextInput
                        value={editingPresetName}
                        onChange={(e) => setEditingPresetName(e.currentTarget.value)}
                        size="xs"
                        style={{ flex: 1 }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleUpdatePresetName(preset.id);
                          } else if (e.key === 'Escape') {
                            setEditingPresetId(null);
                            setEditingPresetName('');
                          }
                        }}
                      />
                      <ActionIcon
                        size="sm"
                        variant="filled"
                        color="green"
                        onClick={() => handleUpdatePresetName(preset.id)}
                      >
                        <IconCheck size={14} />
                      </ActionIcon>
                      <CloseButton
                        size="sm"
                        onClick={() => {
                          setEditingPresetId(null);
                          setEditingPresetName('');
                        }}
                      />
                    </Group>
                  ) : (
                    <>
                      <Text size="sm" fw={500}>
                        {preset.name}
                      </Text>
                      <Group gap={4} mt={4}>
                        {preset.filters.length > 0 && (
                          <Badge size="xs" variant="light">
                            {preset.filters.length} filters
                          </Badge>
                        )}
                        {preset.advancedFilters && Object.keys(preset.advancedFilters).length > 0 && (
                          <Badge size="xs" variant="light" color="blue">
                            Advanced
                          </Badge>
                        )}
                        {preset.sortBy && (
                          <Badge size="xs" variant="light" color="green">
                            Sort: {preset.sortBy}
                          </Badge>
                        )}
                      </Group>
                    </>
                  )}
                </Box>
                <Group gap={4}>
                  <Button
                    size="xs"
                    variant={activePresetId === preset.id ? 'filled' : 'light'}
                    onClick={() => onApplyPreset(preset.id)}
                  >
                    {activePresetId === preset.id ? 'Active' : 'Apply'}
                  </Button>
                  <Menu width={150}>
                    <Menu.Target>
                      <ActionIcon size="sm" variant="subtle">
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconEdit size={14} />}
                        onClick={() => {
                          setEditingPresetId(preset.id);
                          setEditingPresetName(preset.name);
                        }}
                      >
                        Rename
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconTrash size={14} />}
                        color="red"
                        onClick={() => handleDeletePreset(preset)}
                      >
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
