/**
 * Mock DataTable Component
 *
 * Mock implementation of mantine-datatable for testing.
 * Includes table rendering with columns, rows, and pagination controls.
 *
 * @example
 * jest.mock('mantine-datatable', () => ({
 *   DataTable: mockDataTable
 * }));
 *
 * Extracted from: mockComponents.tsx (lines 803-874)
 */

import React, { ReactNode } from 'react';

import type { MockDataTableProps } from './types';

// ============================================================================
// DataTable Component
// ============================================================================

/**
 * Mock DataTable component
 *
 * @example
 * jest.mock('mantine-datatable', () => ({
 *   DataTable: mockDataTable
 * }));
 */
export const mockDataTable = ({
  records,
  columns,
  page,
  onPageChange,
  totalRecords,
  recordsPerPage,
  ..._props
}: MockDataTableProps): JSX.Element => {
  const hasRecords = records && records.length > 0;

  return (
    <div data-testid="datatable-mock">
      <table className="mantine-datatable-table" data-testid="datatable-table">
        <thead>
          <tr>
            {columns?.map((col, index: number) =>
            <th key={index}>{col['title']}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {hasRecords ? records.map((record, index: number) =>
          <tr key={index} data-testid="datatable-row">
              {columns?.map((col, colIndex: number) =>
            <td key={colIndex}>
                  {col.render ? col.render(record) : col.accessor ? record[col.accessor] as ReactNode : null}
                </td>
            )}
            </tr>
          ) : null}
        </tbody>
      </table>

      {!hasRecords && <div data-testid="no-records">No records</div>}

      {/* Mock pagination controls */}
      {hasRecords &&
       totalRecords !== undefined &&
       recordsPerPage !== undefined &&
       page !== undefined &&
       totalRecords > recordsPerPage &&
      <div data-testid="pagination-controls">
          <span>Page {page} of {Math.ceil(totalRecords / recordsPerPage)}</span>
          <button
          onClick={() => onPageChange?.(page > 1 ? page - 1 : 1)}
          disabled={page <= 1}
          data-testid="pagination-prev">

            Previous
          </button>
          <button
          onClick={() => onPageChange?.(page + 1)}
          disabled={page >= Math.ceil(totalRecords / recordsPerPage)}
          data-testid="pagination-next">

            Next
          </button>
        </div>
      }
    </div>);

};
