/**
 * VolumesChaptersSection Component
 *
 * Renders Volumes and Chapters count selection UI with state synchronization.
 * Manages the selection and validation of total volumes and chapters counts
 * from multiple metadata provider sources.
 */

import React, { useState, useEffect } from 'react';

import { Stack, Title, Paper, Grid, Select } from '@mantine/core';

import type { WizardFormData } from '@/types/universalImportWizard.types';

import { extractValue } from './utils';

import type { VolumesChaptersSectionProps } from './types';

/**
 * VolumesChaptersSection
 *
 * Provides UI for selecting total volumes and chapters counts.
 * Synchronizes raw Select values with the parsed numeric values in metadata.
 */
export const VolumesChaptersSection: React.FC<VolumesChaptersSectionProps> = ({
  selectedMetadata,
  setSelectedMetadata,
  getFieldOptions
}): JSX.Element => {
  // State to track the full selected values with provider suffix for volumes and chapters
  const [selectedVolumesRaw, setSelectedVolumesRaw] = useState<string>('');
  const [selectedChaptersRaw, setSelectedChaptersRaw] = useState<string>('');

  // Initialize volumes raw value based on selected metadata
  useEffect(() => {
    if (selectedMetadata.volumes && !selectedVolumesRaw) {
      const options = getFieldOptions('volumes');
      const matchingOption = options.find(opt => {
        const extractedValue = extractValue(opt.value);
        return extractedValue === String(selectedMetadata.volumes);
      });
      if (matchingOption) {
        setSelectedVolumesRaw(matchingOption.value);
      }
    }
  }, [selectedMetadata.volumes, selectedVolumesRaw, getFieldOptions]);

  // Extract chapters value for dependency tracking
  const selectedChapters = selectedMetadata.chapters;

  // Initialize chapters raw value based on selected metadata
  useEffect(() => {
    if (selectedChapters && !selectedChaptersRaw) {
      const options = getFieldOptions('chapters');
      const matchingOption = options.find(opt => {
        const extractedValue = extractValue(opt.value);
        return extractedValue === String(selectedChapters);
      });
      if (matchingOption) {
        setSelectedChaptersRaw(matchingOption.value);
      }
    }
  }, [selectedChapters, selectedChaptersRaw, getFieldOptions]);

  return (
    <Paper p="md">
      <Stack>
        <Title order={5}>Volumes & Chapters</Title>
        <Grid>
          <Grid.Col span={6}>
            <Select
              label="Total Volumes"
              value={selectedVolumesRaw}
              onChange={(value): void => {
                // Store the full raw value for the Select component
                setSelectedVolumesRaw(value ?? '');

                // Extract and store the numeric value in metadata
                let actualVolumes = value ?? '';
                if (actualVolumes.includes('::')) {
                  actualVolumes = actualVolumes.split('::')[0] ?? '';
                }
                setSelectedMetadata(prev => {
                  const updated: Partial<WizardFormData> = { ...prev };
                  if (actualVolumes) updated.volumes = Number(actualVolumes);
                  return updated;
                });
              }}
              placeholder="Select volume count from sources"
              data={getFieldOptions('volumes')}
              searchable
              clearable
              allowDeselect
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <Select
              label="Total Chapters"
              value={selectedChaptersRaw}
              onChange={(value): void => {
                // Store the full raw value for the Select component
                setSelectedChaptersRaw(value ?? '');

                // Extract and store the numeric value in metadata
                let actualChapters = value ?? '';
                if (actualChapters.includes('::')) {
                  actualChapters = actualChapters.split('::')[0] ?? '';
                }
                setSelectedMetadata(prev => {
                  const updated: Partial<WizardFormData> = { ...prev };
                  if (actualChapters) updated.chapters = Number(actualChapters);
                  return updated;
                });
              }}
              placeholder="Select chapter count from sources"
              data={getFieldOptions('chapters')}
              searchable
              clearable
              allowDeselect
            />
          </Grid.Col>
        </Grid>
      </Stack>
    </Paper>
  );
};
