/**
 * ChecklistCategory Component
 *
 * Displays a single category with its items in an accordion.
 */
import React from 'react';

import { Accordion, Group, Text, Badge } from '@mantine/core';

import { ChecklistItem } from '../checklist-items';

import { ChecklistItemDisplay } from './ChecklistItemDisplay';

export interface ChecklistCategoryProps {
  /** Category name */
  category: string;
  /** Items in this category */
  items: ChecklistItem[];
  /** Whether checks have been run */
  hasRun: boolean;
}

export function ChecklistCategory({
  category,
  items,
  hasRun,
}: ChecklistCategoryProps): React.ReactElement {
  const passedCount = items.filter((item) => item.status === 'pass').length;
  const totalCount = items.length;

  return (
    <Accordion.Item value={category}>
      <Accordion.Control>
        <Group justify="space-between">
          <Text fw={500}>{category}</Text>
          {hasRun && (
            <Badge
              color={passedCount === totalCount ? 'green' : 'gray'}
              variant="light"
            >
              {passedCount}/{totalCount}
            </Badge>
          )}
        </Group>
      </Accordion.Control>

      <Accordion.Panel>
        {items.map((item) => (
          <ChecklistItemDisplay
            key={item.id}
            item={item}
          />
        ))}
      </Accordion.Panel>
    </Accordion.Item>
  );
}