/**
 * PublicationSection Component
 *
 * Renders publication details: Publisher, Demographic, Start Date, End Date.
 */

import React from 'react';

import { Stack, Title, Paper, Grid, Select } from '@mantine/core';

import { extractValue, findMatchingOptionValue } from './utils';

import type { PublicationSectionProps } from './types';

export const PublicationSection: React.FC<PublicationSectionProps> = ({
  selectedMetadata,
  setSelectedMetadata,
  getFieldOptions
}): JSX.Element => {
  return (
    <Paper p="md">
      <Stack>
        <Title order={5}>Publication Details</Title>
        <Grid>
          <Grid.Col span={6}>
            <Select
              label="Publisher"
              value={findMatchingOptionValue(selectedMetadata.publisher, getFieldOptions('publisher'))}
              onChange={value => {
                const extractedValue = extractValue(value);
                setSelectedMetadata(prev => ({ ...prev, publisher: extractedValue }));
              }}
              placeholder="Select publisher"
              data={getFieldOptions('publisher')}
              searchable
              clearable
              allowDeselect
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <Select
              label="Demographic"
              value={findMatchingOptionValue(selectedMetadata.demographic, getFieldOptions('demographic'), true)}
              onChange={value => {
                let actualDemographic = value ?? '';
                if (actualDemographic.includes('::')) {
                  actualDemographic = actualDemographic.split('::')[0] ?? '';
                }
                setSelectedMetadata(prev => ({ ...prev, demographic: actualDemographic }));
              }}
              placeholder="Select demographic from available sources"
              data={getFieldOptions('demographic')}
              searchable
              clearable
              allowDeselect
            />
          </Grid.Col>
        </Grid>

        <Grid>
          <Grid.Col span={6}>
            <Select
              label="Start Date"
              value={findMatchingOptionValue(selectedMetadata.startDate, getFieldOptions('startDate'), true)}
              onChange={value => {
                let actualDate = value ?? '';
                if (actualDate.includes('::')) {
                  actualDate = actualDate.split('::')[0] ?? '';
                }
                setSelectedMetadata(prev => ({ ...prev, startDate: actualDate }));
              }}
              placeholder="Select start date from available sources"
              data={getFieldOptions('startDate')}
              searchable
              clearable
              allowDeselect
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <Select
              label="End Date"
              value={findMatchingOptionValue(selectedMetadata.endDate, getFieldOptions('endDate'), true)}
              onChange={value => {
                let actualDate = value ?? '';
                if (actualDate.includes('::')) {
                  actualDate = actualDate.split('::')[0] ?? '';
                }
                setSelectedMetadata(prev => ({ ...prev, endDate: actualDate }));
              }}
              placeholder="Select end date from available sources"
              data={getFieldOptions('endDate')}
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
