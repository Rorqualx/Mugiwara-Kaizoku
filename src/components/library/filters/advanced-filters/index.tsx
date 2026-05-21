import React, { useCallback } from 'react';

import {
  Modal,
  Stack,
  Group,
  Button,
  Tabs
} from '@mantine/core';
import {
  IconFilter,
  IconBookmark
} from '@tabler/icons-react';

import { useLibraryViewStore } from '@/store/index';
import { notify } from '@/utils/notify';

import { ChapterCountSection } from './ChapterCountSection';
import { DateFiltersSection } from './DateFiltersSection';
import { GenreTagsSection } from './GenreTagsSection';
import { PresetList } from './PresetList';
import { RatingSection } from './RatingSection';
import { StatusSection } from './StatusSection';

interface AdvancedFiltersProps {
  opened: boolean;
  onClose: () => void;
  availableGenres?: string[];
  availableTags?: string[];
}

export function AdvancedFilters({
  opened,
  onClose,
  availableGenres = [],
  availableTags = []
}: AdvancedFiltersProps): React.ReactElement {
  const {
    advancedFilters,
    filterPresets,
    activePresetId,
    filterBy,
    sortBy,
    updateAdvancedFilter,
    clearAdvancedFilters,
    saveFilterPreset,
    deleteFilterPreset,
    applyFilterPreset,
    updateFilterPreset
  } = useLibraryViewStore();

  const handleApplyFilters = useCallback(() => {
    onClose();
    notify({ severity: 'INFO', title: 'Filters Applied', message: 'Advanced filters have been applied' });
  }, [onClose]);

  const handleClearAll = useCallback(() => {
    clearAdvancedFilters();
    notify({ severity: 'INFO', title: 'Filters Cleared', message: 'All advanced filters have been cleared' });
  }, [clearAdvancedFilters]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Advanced Filters"
      size="lg"
      padding="md"
    >
      <Tabs defaultValue="filters">
        <Tabs.List>
          <Tabs.Tab value="filters" leftSection={<IconFilter size={16} />}>
            Filters
          </Tabs.Tab>
          <Tabs.Tab value="presets" leftSection={<IconBookmark size={16} />}>
            Presets ({filterPresets.length})
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="filters" pt="md">
          <Stack gap="md">
            <DateFiltersSection
              dateAddedFrom={advancedFilters.dateAddedFrom}
              dateAddedTo={advancedFilters.dateAddedTo}
              lastReadFrom={advancedFilters.lastReadFrom}
              lastReadTo={advancedFilters.lastReadTo}
              onUpdateFilter={(key, value) => updateAdvancedFilter(key, value)}
            />

            <ChapterCountSection
              chaptersMin={advancedFilters.chaptersMin}
              chaptersMax={advancedFilters.chaptersMax}
              onUpdateFilter={(key, value) => updateAdvancedFilter(key, value)}
            />

            <GenreTagsSection
              genres={advancedFilters.genres ?? []}
              tags={advancedFilters.tags ?? []}
              excludeGenres={advancedFilters.excludeGenres ?? []}
              excludeTags={advancedFilters.excludeTags ?? []}
              availableGenres={availableGenres}
              availableTags={availableTags}
              onUpdateFilter={(key, value) => updateAdvancedFilter(key, value)}
            />

            <StatusSection
              publicationStatus={advancedFilters.publicationStatus ?? []}
              readingStatus={advancedFilters.readingStatus ?? []}
              monitored={advancedFilters.monitored ?? null}
              onUpdatePublicationStatus={(v) => updateAdvancedFilter('publicationStatus', v)}
              onUpdateReadingStatus={(v) => updateAdvancedFilter('readingStatus', v)}
              onUpdateMonitored={(v) => updateAdvancedFilter('monitored', v)}
            />

            <RatingSection
              ratingMin={advancedFilters.ratingMin}
              ratingMax={advancedFilters.ratingMax}
              onUpdateFilter={(key, value) => updateAdvancedFilter(key, value)}
            />

            <Group justify="space-between" mt="md">
              <Button
                variant="subtle"
                color="red"
                onClick={handleClearAll}
                size="sm"
              >
                Clear All
              </Button>
              <Group gap="xs">
                <Button variant="default" onClick={onClose} size="sm">
                  Cancel
                </Button>
                <Button onClick={handleApplyFilters} size="sm">
                  Apply Filters
                </Button>
              </Group>
            </Group>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="presets" pt="md">
          <PresetList
            filterPresets={filterPresets}
            activePresetId={activePresetId}
            currentFilters={filterBy}
            currentAdvancedFilters={advancedFilters}
            currentSortBy={sortBy}
            onSavePreset={(preset) => saveFilterPreset({
              name: preset.name,
              filters: preset.filters,
              ...(preset.advancedFilters !== undefined && { advancedFilters: preset.advancedFilters }),
              ...(preset.sortBy !== undefined && { sortBy: preset.sortBy })
            })}
            onApplyPreset={applyFilterPreset}
            onUpdatePreset={updateFilterPreset}
            onDeletePreset={deleteFilterPreset}
          />
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}
