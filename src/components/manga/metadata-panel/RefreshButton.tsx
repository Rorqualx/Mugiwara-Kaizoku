/**
 * Refresh Button Component
 *
 * Button to trigger metadata refresh with loading state
 */

import React from 'react';

import { Button, Loader } from '@mantine/core';

interface RefreshButtonProps {
  isLoading: boolean;
  onRefresh: () => void;
}

export function RefreshButton({ isLoading, onRefresh }: RefreshButtonProps): React.ReactElement {
  return (
    <Button
      variant="light"
      onClick={onRefresh}
      disabled={isLoading}
      leftSection={isLoading ? <Loader size="xs" /> : null}
      title={isLoading ? "Fetching latest metadata..." : "Update metadata from configured providers"}
      aria-busy={isLoading ? "true" : "false"}
      aria-label={isLoading ? "Refreshing metadata..." : "Refresh metadata"}
    >
      {isLoading ? "Refreshing..." : "Refresh Metadata"}
    </Button>
  );
}
