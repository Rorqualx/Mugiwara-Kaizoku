/**
 * Breadcrumbs Component for File Browser
 *
 * Displays navigation breadcrumbs for the current directory path
 */

import React from 'react';

import { Breadcrumbs as MantineBreadcrumbs, Anchor } from '@mantine/core';
import { IconChevronRight, IconHome } from '@tabler/icons-react';

import { BreadcrumbsProps } from './types';

/**
 * Breadcrumbs Component
 */
export function Breadcrumbs({
  breadcrumbs,
  onNavigate
}: BreadcrumbsProps): React.ReactElement {
  return (
    <MantineBreadcrumbs separator={<IconChevronRight size={12} />}>
      {breadcrumbs.map((crumb, index) => (
        <Anchor
          key={crumb.path}
          size="sm"
          onClick={() => onNavigate(crumb.path)}
          style={{ cursor: 'pointer' }}
        >
          {index === 0 ? <IconHome size={14} /> : crumb.label}
        </Anchor>
      ))}
    </MantineBreadcrumbs>
  );
}