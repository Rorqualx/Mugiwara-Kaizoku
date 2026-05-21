/**
 * HomeActionBar component for the application's home page
 *
 * Simplified to contain only the Search Downloads button.
 * View, Sort, and Filter controls have been moved to the library page.
 */

import React from 'react';

import { Group, Box } from '@mantine/core';
import { IconCloud } from '@tabler/icons-react';

import { ActionBarButton } from './components';
import { useSearchDownload } from './hooks';

/**
 * Home action bar with search downloads button only
 */
export function HomeActionBar(): React.JSX.Element {
  // Get search download functionality
  const { handleSearchDownload, isSearching, hasSelection, selectedCount } = useSearchDownload();

  return (
    <Box
      style={{
        width: '100%',
        height: '56px',
        backgroundColor: '#333333',
        borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
        boxShadow: 'var(--mantine-shadow-md)',
        zIndex: 200,
      }}
    >
      <Group justify="flex-start" h="100%" w="100%" pl="xs">
        {/* Search Downloads Button */}
        <ActionBarButton
          icon={<IconCloud size={20} />}
          label={hasSelection ? `Search (${selectedCount})` : 'Search'}
          onClick={() => {
            void handleSearchDownload();
          }}
          loading={isSearching}
          title={
            hasSelection
              ? `Search downloads for ${selectedCount} selected manga`
              : 'Search downloads for all monitored manga'
          }
        />
      </Group>
    </Box>
  );
}
