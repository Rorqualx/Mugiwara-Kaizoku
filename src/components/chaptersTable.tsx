/**
 * ChaptersTable component for displaying manga chapter information
 * 
 * This component provides a paginated data table view of manga chapters,
 * including file details, size, dates, and download status. Features include:
 * - Paginated chapter list
 * - File size formatting
 * - Date formatting
 * - Status indicators
 * - Hover and stripe effects
 * 
 * @remarks
 * Table Columns:
 * - File Name: Chapter file name
 * - Size: Formatted file size
 * - Date Added: Formatted creation date
 * - Status: Download status with visual indicator
 * 
 * Pagination:
 * - 100 records per page
 * - Page navigation controls
 * - Total records display
 * 
 * @example
 * ```tsx
 * <ChaptersTable
 *   manga={{
 *     chapters: [
 *       { fileName: 'chapter-1.cbz', size: 1024000, createdAt: new Date(), downloadStatus: 'COMPLETED' }
 *     ]
 *   }}
 * />
 * ```
 */

import React from "react";
import { useState } from 'react';

import { Badge } from '@mantine/core';
import { ChapterStatus } from '@prisma/client';
import dayjs from "dayjs";
import { DataTable } from "mantine-datatable";
import prettyBytes from "pretty-bytes";


import classes from './chaptersTable.module.css';

import type { Chapter } from '@prisma/client';

type ChapterEntity = Chapter; // Alias for backward compatibility

/** Number of chapters to display per page */
const PAGE_SIZE = 100;

/**
 * Props for the ChaptersTable component
 */
interface ChaptersTableProps {
  /** Manga object containing chapter array */
  manga: {
    /** Array of chapter objects */
    chapters: ChapterEntity[];
  };
}

export function ChaptersTable({ manga }: ChaptersTableProps): React.ReactElement {
  const [page, setPage] = useState(1);
  const records = manga["chapters"].slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  return (
    <DataTable
      classNames={{
        root: classes['table'],
        header: classes['header']
      }}
      records={records}
      columns={[
      {
        accessor: "fileName",
        title: "File Name",
        render: (record: ChapterEntity) =>
        <span className={classes['fileName']}>
              {typeof record.fileName === 'string' ? record.fileName : 'Unknown'}
            </span>

      },
      {
        accessor: "size",
        title: "Size",
        render: (record: ChapterEntity) =>
        <span className={classes['size']}>
              {typeof record.size === 'number' ? prettyBytes(record.size) : 'Unknown size'}
            </span>

      },
      {
        accessor: "createdAt",
        title: "Date Added",
        render: (record: ChapterEntity) => dayjs(record.createdAt).format("YYYY-MM-DD")
      },
      {
        accessor: "downloadStatus",
        title: "Status",
        render: (record: ChapterEntity) => {
          // Get the status with proper type safety
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defensive: downloadStatus may be undefined at runtime
          const status = record.downloadStatus ?? ChapterStatus.PENDING;

          // Determine color based on status with enum comparison
          const color = status === ChapterStatus.COMPLETED ? 'teal' : 'orange';

          return (
            <Badge
              className={classes['statusBadge']}
              color={color}
              variant="light">

                {status}
              </Badge>);

        }
      }]
      }
      totalRecords={manga["chapters"].length}
      recordsPerPage={PAGE_SIZE}
      page={page}
      onPageChange={setPage}
      highlightOnHover
      striped />);


}