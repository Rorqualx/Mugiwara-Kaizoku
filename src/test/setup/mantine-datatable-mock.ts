/**
 * Test Setup - Mantine DataTable Mock
 *
 * Mock implementation of the Mantine DataTable component.
 * Extracted from: src/test/setup.ts (lines 389-429)
 */

import { jest } from '@jest/globals';
import * as React from 'react';
import { isRecord, getUnknownProperty } from './foundation';

jest.mock('mantine-datatable', () => ({
  DataTable: ({
    records,
    columns,
    ...props
  }: {
    records?: unknown[];
    columns?: unknown[];
    [key: string]: unknown;
  }) => {
    const safeProps: Record<string, unknown> = {};
    ['id', 'className', 'style', 'data-testid', 'role', 'aria-label'].forEach((prop) => {
      if (isRecord(props) && prop in props) {
        safeProps[prop] = props[prop];
      }
    });
    return React.createElement(
      'div',
      { ...safeProps, 'data-testid': 'data-table', className: 'mantine-datatable' },
      React.createElement('table', {},
        React.createElement('thead', {},
          React.createElement('tr', {}, Array.isArray(columns) && columns.map((col: unknown, idx: number) => {
            if (!isRecord(col)) return null;
            return React.createElement('th', { key: idx }, String(getUnknownProperty(col, 'accessor') ?? getUnknownProperty(col, 'title') ?? ''));
          }))
        ),
        React.createElement('tbody', {}, Array.isArray(records) && records.map((record: unknown, idx: number) =>
          React.createElement('tr', { key: idx }, Array.isArray(columns) && columns.map((col: unknown, colIdx: number) => {
            if (!isRecord(col) || !isRecord(record)) return null;
            const accessor = getUnknownProperty(col, 'accessor');
            return React.createElement('td', { key: colIdx }, String((typeof accessor === 'string' ? getUnknownProperty(record, accessor) : '') ?? ''));
          }))
        ))
      )
    );
  },
}));
