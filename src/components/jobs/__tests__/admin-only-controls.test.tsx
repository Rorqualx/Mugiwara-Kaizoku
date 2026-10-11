/**
 * @jest-environment jsdom
 *
 * Queue-wide job actions are admin-only on the server; these tests pin that the
 * Jobs screens offer them to administrators only, while a regular user keeps
 * the actions that are scoped to their own jobs.
 */
import React from 'react';

import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';

import { JobsHeader } from '@/components/jobs/active-page/JobsHeader';
import { BulkActions } from '@/components/jobs/history/BulkActions';
import { useIsAdmin } from '@/hooks/useIsAdmin';

jest.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: jest.fn() }));

const mockUseIsAdmin = useIsAdmin as jest.Mock;
const idleMutation = { mutate: jest.fn(), isPending: false };

function renderHeader(): void {
  render(
    <MantineProvider>
      <JobsHeader
        totalCount={12}
        completedCount={5}
        failedCount={3}
        activeTab="all"
        deleteAllCompleted={idleMutation}
        deleteAllFailed={idleMutation}
        onTrackDownload={jest.fn()}
      />
    </MantineProvider>,
  );
}

function renderBulkActions(canDeleteByStatus: boolean): void {
  render(
    <MantineProvider>
      <BulkActions
        selectedCount={2}
        completedCount={5}
        failedCount={3}
        onDeleteSelected={jest.fn()}
        onDeleteCompleted={jest.fn()}
        onDeleteFailed={jest.fn()}
        isDeleting={false}
        canDeleteByStatus={canDeleteByStatus}
      />
    </MantineProvider>,
  );
}

describe('Jobs page header', () => {
  it('shows the track-download and clear-all controls to an admin', () => {
    mockUseIsAdmin.mockReturnValue(true);
    renderHeader();

    // Track download + clear completed + clear failed
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByText('12 Total')).toBeInTheDocument();
  });

  it('shows none of the queue-wide controls to a regular user', () => {
    mockUseIsAdmin.mockReturnValue(false);
    renderHeader();

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText('12 Total')).toBeInTheDocument();
  });
});

describe('Job history bulk actions', () => {
  it('offers delete-by-status to an admin', () => {
    renderBulkActions(true);

    expect(screen.getByText('Bulk Actions')).toBeInTheDocument();
    expect(screen.getByText('Delete Selected (2)')).toBeInTheDocument();
  });

  it('keeps delete-selected but hides delete-by-status for a regular user', () => {
    renderBulkActions(false);

    expect(screen.queryByText('Bulk Actions')).not.toBeInTheDocument();
    expect(screen.getByText('Delete Selected (2)')).toBeInTheDocument();
  });
});
