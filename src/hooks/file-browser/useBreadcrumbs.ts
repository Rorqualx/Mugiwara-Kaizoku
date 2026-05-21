/**
 * useBreadcrumbs Hook
 *
 * Generates breadcrumbs from current path for file browser navigation
 */

import { useMemo } from 'react';

import type { BreadcrumbsResult, Breadcrumb } from './types';

/**
 * Hook for generating breadcrumbs from current path
 */
export function useBreadcrumbs(displayPath?: string): BreadcrumbsResult {
  const breadcrumbs = useMemo((): Breadcrumb[] => {
    if (!displayPath) return [];

    const parts = displayPath.split('/').filter(Boolean);
    const breadcrumbs: Breadcrumb[] = [
      { label: 'Root', path: '/' }
    ];

    let currentPathBuild = '';
    for (const part of parts) {
      currentPathBuild += '/' + part;
      breadcrumbs.push({
        label: part,
        path: currentPathBuild
      });
    }

    return breadcrumbs;
  }, [displayPath]);

  return {
    breadcrumbs,
    displayPath: displayPath || ''
  };
}