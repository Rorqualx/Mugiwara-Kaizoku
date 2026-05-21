/**
 * Test Setup - Tabler Icons Mock
 *
 * Dynamic mock generator for all Tabler Icon components using Proxy.
 * Extracted from: src/test/setup.ts (lines 702-762)
 */

import { jest } from '@jest/globals';
import * as React from 'react';
import { isRecord, getUnknownProperty } from './foundation';

/**
 * Extract multiple optional props from a props object.
 * Reduces complexity by batching prop extraction.
 */
function extractOptionalProps(props: unknown, keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const value = isRecord(props) ? getUnknownProperty(props, key) : undefined;
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Generate unique paths for different icons based on icon name hash.
 */
function generateIconPath(iconName: string): string {
  const hash = iconName.split('').reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);
  const x = Math.abs(hash % 20) + 2;
  const y = Math.abs(hash % 20) + 2;
  return `M${x} ${y}l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L${x} ${y}z`;
}

jest.mock('@tabler/icons-react', () => {
  const iconProps = {
    'data-testid': 'tabler-icon',
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  };

  const optionalPropKeys = ['id', 'style', 'fill', 'stroke', 'strokeWidth', 'onClick', 'onMouseEnter', 'onMouseLeave'];

  return new Proxy({} as Record<string, React.ComponentType<unknown>>, {
    get: (target, prop) => {
      if (typeof prop === 'string' && prop.startsWith('Icon')) {
        return (props?: Record<string, unknown>) => {
          const size = isRecord(props) ? (getUnknownProperty(props, 'size') || 24) : 24;
          const defaultTestId = `icon-${prop.slice(4).replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`;
          const optionalProps = extractOptionalProps(props, optionalPropKeys);

          return React.createElement('svg', {
            ...iconProps,
            width: (isRecord(props) ? getUnknownProperty(props, 'width') : null) || size,
            height: (isRecord(props) ? getUnknownProperty(props, 'height') : null) || size,
            'data-icon': prop.toLowerCase(),
            'data-testid': (isRecord(props) ? getUnknownProperty(props, 'data-testid') : null) || defaultTestId,
            className: `tabler-icon ${isRecord(props) ? (getUnknownProperty(props, 'className') ?? '') : ''}`,
            ...optionalProps
          },
          React.createElement('path', {
            d: generateIconPath(prop),
            'data-icon-name': prop
          })
          );
        };
      }
      return target[prop as keyof typeof target];
    }
  });
});
