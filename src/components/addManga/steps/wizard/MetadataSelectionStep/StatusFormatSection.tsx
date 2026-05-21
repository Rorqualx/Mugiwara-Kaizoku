/**
 * StatusFormatSection Component
 *
 * Renders Status and Format selection fields for metadata selection.
 * Handles extraction of actual values from provider-suffixed options
 * (e.g., "ONGOING::anilist" -> "ONGOING").
 */

import React from 'react';

import { Stack, Title, Paper, Grid, Select } from '@mantine/core';

import type { StatusFormatSectionProps } from './types';

export const StatusFormatSection: React.FC<StatusFormatSectionProps> = ({
  selectedMetadata,
  setSelectedMetadata,
  statusOptions,
  formatOptions
}): JSX.Element => {
  return (
    <Paper p="md">
      <Stack>
        <Title order={5}>Status & Format</Title>
        <Grid>
          <Grid.Col span={6}>
            <Select
              label="Status"
              value={(() => {
                // If we have a selected status, we need to find its unique value
                if (selectedMetadata.status) {
                  const options = statusOptions;
                  // Find the option that starts with our status value
                  const matchingOption = options.find(opt =>
                    opt.value.startsWith(selectedMetadata.status + '::')
                  );
                  return matchingOption ? matchingOption.value : selectedMetadata.status;
                }
                return '';
              })()}
              onChange={value => {
                // Extract the actual status from the unique value (e.g., "ONGOING::anilist" -> "ONGOING")
                let actualStatus = value ?? '';
                if (actualStatus.includes('::')) {
                  actualStatus = actualStatus.split('::')[0] ?? '';
                }
                setSelectedMetadata(prev => ({
                  ...prev,
                  status: actualStatus
                }));
              }}
              placeholder="Select status from available sources"
              data={statusOptions}
              searchable
              clearable
              allowDeselect
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <Select
              label="Format"
              value={(() => {
                // If we have a selected format, we need to find its unique value
                if (selectedMetadata.format) {
                  const options = formatOptions;
                  // Find the option that starts with our format value
                  const matchingOption = options.find(opt =>
                    opt.value.startsWith(selectedMetadata.format + '::')
                  );
                  return matchingOption ? matchingOption.value : selectedMetadata.format;
                }
                return '';
              })()}
              onChange={value => {
                // Extract the actual format from the unique value (e.g., "MANGA::fandom" -> "MANGA")
                let actualFormat = value ?? '';
                if (actualFormat.includes('::')) {
                  actualFormat = actualFormat.split('::')[0] ?? '';
                }
                setSelectedMetadata(prev => ({
                  ...prev,
                  format: actualFormat
                }));
              }}
              placeholder="Select format from available sources"
              data={formatOptions}
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
