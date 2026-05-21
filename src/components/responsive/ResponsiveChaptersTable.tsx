/**
 * Responsive Chapters Table Component
 * 
 * An enhanced version of ChaptersTable with mobile optimizations:
 * - Card view on mobile devices
 * - Optimized column visibility
 * - Touch-friendly interactions
 * - Responsive pagination
 */

import React, { useState } from 'react';

import {
  Badge,
  Group,
  Text,
  Stack,
  Pagination,
  Select,
  Card } from
'@mantine/core';
import { ChapterStatus } from '@prisma/client';
import dayjs from "dayjs";
import { DataTable } from "mantine-datatable";
import prettyBytes from "pretty-bytes";

import { useBreakpoint } from '@/hooks/mobile';


import classes from '../chaptersTable.module.css';

import { ResponsiveTable } from './ResponsiveTable';

import type { Chapter } from '@prisma/client';
type ChapterEntity = Chapter; // Alias for backward compatibility

const PAGE_SIZES = [10, 25, 50, 100];

interface ResponsiveChaptersTableProps {
  manga: {
    chapters: ChapterEntity[];
  };
  /** Page size for desktop view */
  defaultPageSize?: number;
  /** Page size for mobile view */
  mobilePageSize?: number;
  /** Enable chapter selection */
  selectable?: boolean;
  /** Callback when chapters are selected */
  onSelectionChange?: (selected: ChapterEntity[]) => void;
}

export function ResponsiveChaptersTable({
  manga,
  defaultPageSize = 100,
  mobilePageSize = 10,
  selectable = false,
  onSelectionChange
}: ResponsiveChaptersTableProps): React.ReactElement {
  const { isMobile, isTablet } = useBreakpoint();
  const [page, setPage] = useState(1);
  const [selectedRecords, setSelectedRecords] = useState<ChapterEntity[]>([]);

  // Responsive page size
  const pageSize = isMobile ? mobilePageSize : defaultPageSize;
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);

  const records = manga["chapters"].slice(
    (page - 1) * currentPageSize,
    page * currentPageSize
  );

  const totalPages = Math.ceil(manga["chapters"].length / currentPageSize);

  // Column definitions for responsive table
  const columns = [
  {
    accessor: "fileName",
    title: "File Name",
    render: (record: ChapterEntity) =>
    <Text size={isMobile ? "sm" : "md"} truncate>
          {typeof record.fileName === 'string' ? record.fileName : 'Unknown'}
        </Text>,

    mobilePriority: 1,
    showInCard: true
  },
  {
    accessor: "size",
    title: "Size",
    render: (record: ChapterEntity) =>
    <Text size={isMobile ? "sm" : "md"}>
          {typeof record.size === 'number' ? prettyBytes(record.size) : 'Unknown'}
        </Text>,

    mobilePriority: 3,
    showInCard: true,
    hideOnMobile: false
  },
  {
    accessor: "createdAt",
    title: "Date Added",
    render: (record: ChapterEntity) =>
    <Text size={isMobile ? "sm" : "md"}>
          {dayjs(record.createdAt).format(isMobile ? "MM/DD/YY" : "YYYY-MM-DD")}
        </Text>,

    mobilePriority: 4,
    hideOnMobile: false
  },
  {
    accessor: "downloadStatus",
    title: "Status",
    render: (record: ChapterEntity) => {
      const status = record.downloadStatus;
      const color = status === ChapterStatus.COMPLETED ? 'teal' : 'orange';

      return (
        <Badge
          size={isMobile ? "sm" : "md"}
          color={color}
          variant="light">

            {status}
          </Badge>);

    },
    mobilePriority: 2,
    showInCard: true
  }];

  // Mobile card render function
  const mobileCardRender = (record: ChapterEntity): React.ReactElement => {
    const status = record.downloadStatus;
    const statusColor = status === ChapterStatus.COMPLETED ? 'teal' : 'orange';

    return (
      <Card p="sm" withBorder>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" fw={500} truncate style={{ maxWidth: '70%' }}>
              {typeof record.fileName === 'string' ? record.fileName : 'Unknown'}
            </Text>
            <Badge size="sm" color={statusColor} variant="light">
              {status}
            </Badge>
          </Group>
          
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {typeof record.size === 'number' ? prettyBytes(record.size) : 'Unknown'}
            </Text>
            <Text size="xs" c="dimmed">
              {dayjs(record.createdAt).format("MM/DD/YY")}
            </Text>
          </Group>
        </Stack>
      </Card>);

  };

  // Pagination controls
  const paginationControls =
  <Group justify="space-between" mt="md">
      <Group gap="xs">
        <Text size="sm">
          Showing {(page - 1) * currentPageSize + 1} to {Math.min(page * currentPageSize, manga["chapters"].length)} of {manga["chapters"].length}
        </Text>
        {!isMobile &&
      <Select
        size="xs"
        value={currentPageSize.toString()}
        onChange={(value) => {
          setCurrentPageSize(Number(value));
          setPage(1);
        }}
        data={PAGE_SIZES.map((size) => ({ value: size.toString(), label: `${size} per page` }))}
        style={{ width: 120 }} />

      }
      </Group>
      
      <Pagination
      size={isMobile ? "sm" : "md"}
      total={totalPages}
      value={page}
      onChange={setPage}
      boundaries={isMobile ? 0 : 1}
      siblings={isMobile ? 0 : 1} />

    </Group>;

  // Use DataTable for desktop, ResponsiveTable for mobile/tablet
  if (!isMobile && !isTablet) {
    return (
      <>
        <DataTable
          classNames={{
            root: classes['table'],
            header: classes['header']
          }}
          records={records}
          columns={columns as unknown as never[]}
          highlightOnHover
          striped
          {...(selectable && {
            selectedRecords: selectedRecords,
            onSelectedRecordsChange: (records: unknown[]) => {
              const typedRecords = records as ChapterEntity[];
              setSelectedRecords(typedRecords);
              onSelectionChange?.(typedRecords);
            }
          })} />

        {paginationControls}
      </>);

  }

  // Mobile/Tablet view
  return (
    <>
      <ResponsiveTable
        records={records}
        columns={columns}
        idAccessor="id"
        mobileCardView={isMobile}
        mobileCardRender={mobileCardRender}
        mobileExpandable={false}
        highlightOnHover
        striped={!isMobile} />

      {paginationControls}
    </>);

}