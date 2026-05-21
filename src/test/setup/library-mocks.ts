/**
 * Test Setup - External Library Mocks
 *
 * Mock implementations of external utility libraries.
 * Extracted from: src/test/setup.ts (lines 329-368)
 */

import { jest } from '@jest/globals';

// Mock pretty-bytes
jest.mock('pretty-bytes', () => jest.fn((bytes: number) => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}));

// Mock contrast-color
jest.mock('contrast-color', () => ({
  contrastColor: jest.fn(({ bgColor }: { bgColor?: string }) => bgColor === '#000000' ? '#ffffff' : '#000000')
}));

// Mock string-to-color
jest.mock('string-to-color', () => jest.fn((str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = Math.abs(hash).toString(16).substring(0, 6).padEnd(6, '0');
  return `#${color}`;
}));

// Mock dayjs
jest.mock('dayjs', () => {
  const mockDayjs = jest.fn(() => ({
    format: jest.fn(() => '2023-01-01'),
    fromNow: jest.fn(() => '2 days ago'),
    diff: jest.fn(() => 1000),
    isValid: jest.fn(() => true)
  }));

  // @ts-ignore - Adding extend method to function
  mockDayjs.extend = jest.fn();

  return mockDayjs;
});
