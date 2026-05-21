/**
 * Selector Type Toggle Component
 *
 * Allows users to switch between CSS and XPath selector syntax.
 *
 * @module components/shared/annotation/visual-inspector/components/SelectorTypeToggle
 */

import { SegmentedControl, Tooltip } from '@mantine/core';

import type { SelectorTypeToggleProps } from '../types';

/**
 * Toggle between CSS and XPath selector types
 */
export function SelectorTypeToggle({
  value,
  onChange
}: SelectorTypeToggleProps): React.ReactElement {
  return (
    <Tooltip
      label="CSS selectors are recommended for most use cases. XPath provides more powerful querying for complex scenarios."
      multiline
      w={280}
    >
      <SegmentedControl
        value={value}
        onChange={(newValue) => {
          if (newValue === 'css' || newValue === 'xpath') {
            onChange(newValue);
          }
        }}
        data={[
          { value: 'css', label: 'CSS' },
          { value: 'xpath', label: 'XPath' }
        ]}
        size="sm"
      />
    </Tooltip>
  );
}
