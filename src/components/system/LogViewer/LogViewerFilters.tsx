import React from 'react';

import { Group, Select, TextInput, ActionIcon } from '@mantine/core';
import { IconFilter, IconFileText, IconSearch, IconX } from '@tabler/icons-react';

import type { LogViewerFiltersProps } from './types';

export function LogViewerFilters({
  logLevel,
  setLogLevel,
  selectedLogFile,
  setSelectedLogFile,
  limit,
  setLimit,
  search,
  setSearch,
  logFileOptions,
  isLoadingFiles
}: LogViewerFiltersProps): JSX.Element {
  return (
    <Group mb="md" align="end">
      <Select
        label="Log Level"
        placeholder="Select log level"
        value={logLevel}
        onChange={(value): void => setLogLevel(value ?? 'all')}
        data={[
          { value: 'all', label: 'All Levels' },
          { value: 'error', label: 'Error' },
          { value: 'warn', label: 'Warning' },
          { value: 'info', label: 'Info' },
          { value: 'debug', label: 'Debug' },
          { value: 'trace', label: 'Trace' }
        ]}
        leftSection={<IconFilter size={16} />}
        style={{ width: '150px' }}
      />

      <Select
        label="Log File"
        placeholder="Select log file"
        value={selectedLogFile ?? ''}
        onChange={(value): void => setSelectedLogFile(value)}
        data={logFileOptions}
        leftSection={<IconFileText size={16} />}
        style={{ width: '250px' }}
        disabled={isLoadingFiles || logFileOptions.length <= 1}
      />

      <Select
        label="Limit"
        placeholder="Number of logs"
        value={limit.toString()}
        onChange={(value): void => {
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            setLimit(numValue);
          }
        }}
        data={[
          { value: '50', label: '50 logs' },
          { value: '100', label: '100 logs' },
          { value: '200', label: '200 logs' },
          { value: '500', label: '500 logs' }
        ]}
        style={{ width: '120px' }}
      />

      <TextInput
        label="Search"
        placeholder="Search logs..."
        value={search}
        onChange={(e): void => setSearch(e.currentTarget.value)}
        leftSection={<IconSearch size={16} />}
        rightSection={
          search ? (
            <ActionIcon onClick={(): void => setSearch('')} size="sm">
              <IconX size={16} />
            </ActionIcon>
          ) : null
        }
        style={{ flex: 1 }}
      />
    </Group>
  );
}
