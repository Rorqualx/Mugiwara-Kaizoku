/**
 * VolumeContent Component
 *
 * DataTable wrapper with transition animations for chapter display.
 *
 * @module components/volumeChapters/volume-table-components/VolumeContent
 */

import { memo } from 'react';

import { Box } from '@mantine/core';
import { DataTable } from 'mantine-datatable';

import classes from '@/components/chaptersTable.module.css';

import type { VolumeContentProps } from './types';

/**
 * Volume content area with animated expansion and DataTable
 */
export const VolumeContent = memo(({
  isExpanded,
  records,
  columns,
  chaptersCount
}: VolumeContentProps): JSX.Element => (
  <Box className={classes['volumeContent']} style={{
    padding: isExpanded ? '0.75rem' : '0',
    backgroundColor: 'var(--mantine-color-dark-7)',
    opacity: isExpanded ? 1 : 0,
    maxHeight: isExpanded ? 'none' : '0',
    overflow: isExpanded ? 'visible' : 'hidden',
    transition: 'opacity 300ms ease-in-out, padding 300ms ease-in-out',
    willChange: 'opacity',
    contain: 'content',
    transform: 'translateZ(0)'
  }}>
    <DataTable
      classNames={{
        root: classes.table,
        header: classes.header,
        tr: (classes as Record<string, string>)["chapterRow"]
      }}
      minHeight={100}
      rowBorderColor="var(--mantine-color-dark-5)"
      records={records}
      columns={columns as Parameters<typeof DataTable>[0]['columns']}
      highlightOnHover={false}
      striped
      paginationActiveBackgroundColor="var(--mantine-color-blue-6)"
      recordsPerPage={chaptersCount > 50 ? 20 : chaptersCount}
      {...(chaptersCount > 50 ? { recordsPerPageOptions: [20, 50, 100] } : {})}
    />
  </Box>
));

VolumeContent.displayName = 'VolumeContent';
