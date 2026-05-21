/**
 * Test Setup - Component Mocks
 *
 * Mock implementations of application components.
 * Extracted from: src/test/setup.ts (lines 211-221, 224-230, 235-239, 241-246, 248-253, 371-376, 381-387, 651-654, 656-700)
 *
 * @module test/setup/component-mocks
 */

import { jest } from '@jest/globals';
import * as React from 'react';
import { isRecord, getUnknownProperty } from './foundation';

// MangaDetailView component mock
jest.mock('@/components/manga/MangaDetailView', () => ({
  MangaDetailView: ({ manga }: { manga?: { title?: string; chapters?: unknown[] } }) => React.createElement('div', { 'data-testid': 'manga-detail-view' },
    React.createElement('h1', {}, manga?.title || 'Unknown Manga'),
    React.createElement('div', {}, `${manga?.chapters?.length ?? 0} Pages`),
    React.createElement('div', {}, '11.00 MB'),
    React.createElement('div', {}, '3.00 MB'),
    React.createElement('button', {}, 'Download'),
    React.createElement('button', {}, 'Mark as Read'),
    React.createElement('div', { 'data-testid': 'manga-metadata' }, 'Metadata Information')
  )
}));

// AnilistSettings component mock
jest.mock('@/components/settings/AnilistSettings', () => ({
  AnilistSettings: () => React.createElement('div', { 'data-testid': 'anilist-settings' },
    React.createElement('h2', {}, 'AniList Integration'),
    React.createElement('button', {}, 'Connect to AniList'),
    React.createElement('div', {}, 'Sync your reading progress')
  )
}));

// ErrorHandler component mock
jest.mock('@/components/error/ErrorHandler', () => ({
  ErrorHandler: ({ error, children }: { error?: unknown; children?: React.ReactNode }) => error ?
    React.createElement('div', { 'data-testid': 'error-handler' }, `Error: ${(error instanceof Error ? error.message : String(error))}`) :
    React.createElement('div', {}, children)
}));

// SetupNavigation component mock
jest.mock('@/components/auth/SetupNavigation', () => ({
  SetupNavigation: () => React.createElement('nav', { 'data-testid': 'setup-navigation' },
    React.createElement('a', { href: '/setup' }, 'Setup'),
    React.createElement('a', { href: '/login' }, 'Login')
  )
}));

// SystemNavigation component mock
jest.mock('@/components/system/SystemNavigation', () => ({
  SystemNavigation: () => React.createElement('nav', { 'data-testid': 'system-navigation' },
    React.createElement('a', { href: '/system' }, 'System'),
    React.createElement('a', { href: '/settings' }, 'Settings')
  )
}));

// CSS modules mock
jest.mock('@/components/chaptersTable.module.css', () => ({
  volumeContainer: 'volumeContainer',
  volumeHeader: 'volumeHeader',
  volumeContent: 'volumeContent',
  expandButton: 'expandButton',
  chapterRow: 'chapterRow'
}));

// ApiCallAlert component mock
jest.mock('@/components/apiCallAlert', () => ({
  trackApiCall: jest.fn(),
  ApiCallAlert: () => React.createElement('div', { 'data-testid': 'api-call-alert' }, 'API Call Monitor')
}));

// SearchResults component mock
jest.mock('@/components/search/SearchResults', () => ({
  SearchResults: ({ results, onSelect, _loading, error, showProvider, ...props }: {
    results?: unknown[];
    onSelect?: (result: unknown) => void;
    _loading?: boolean;
    error?: string;
    showProvider?: boolean;
    [key: string]: unknown;
  }) => {
    const restProps: Record<string, unknown> = {};
    if (isRecord(props)) {
      for (const key in props) {
        if (key !== 'showProvider') {
          restProps[key] = props[key];
        }
      }
    }

    return React.createElement('div', {
      'data-testid': 'search-results',
      ...restProps
    }, [
      _loading && React.createElement('div', {
        key: '_loading',
        'data-testid': 'search-_loading'
      }, 'Loading...'),
      error && React.createElement('div', {
        key: 'error',
        'data-testid': 'search-error'
      }, `Error: ${error}`),
      !_loading && !error && Array.isArray(results) && results.map((result: unknown, index: number) => {
        if (!isRecord(result)) return null;
        return React.createElement('div', {
          key: index,
          'data-testid': 'search-result-item',
          onClick: () => onSelect?.(result)
        }, String(getUnknownProperty(result, 'title') || getUnknownProperty(result, 'name') || `Result ${index + 1}`));
      })
    ].filter(Boolean));
  }
}));
