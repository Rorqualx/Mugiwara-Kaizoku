/**
 * AccordionControl Component
 *
 * Individual accordion header with preview of selected result.
 * Shows provider name, result count, and selection status.
 *
 * @module components/addManga/steps/wizard/basic-info-step/components
 */

import React from 'react';

import {
  Group,
  Text,
  Badge,
  Image
} from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

import { isRecord } from '@/lib/type-guards';

import { PROVIDER_DISPLAY_NAMES } from '../types';
import { getStringProp } from '../utils';

/**
 * Props for AccordionControl component
 */
export interface AccordionControlProps {
  /** Provider name */
  provider: string;
  /** Selected result metadata */
  selectedResult?: unknown;
  /** Number of results available */
  resultCount: number;
}

/**
 * AccordionControl Component
 *
 * Renders accordion header with provider info and selection preview.
 * Shows cover image and title of selected result if available.
 */
export const AccordionControl: React.FC<AccordionControlProps> = ({
  provider,
  selectedResult,
  resultCount
}): React.ReactElement => {
  const isSelected = !!selectedResult;
  const selectedTitle = isSelected && isRecord(selectedResult)
    ? getStringProp(selectedResult, 'title')
    : null;
  const selectedCover = isSelected && isRecord(selectedResult)
    ? getStringProp(selectedResult, 'coverImage')
    : null;

  return (
    <Group justify="space-between" gap="md" wrap="nowrap" style={{ width: '100%' }}>
      <Group gap="sm">
        <Text fw={600}>{PROVIDER_DISPLAY_NAMES[provider] ?? provider}</Text>
        <Badge size="sm" variant="light">{resultCount} results</Badge>
      </Group>
      <Group gap="xs">
        {isSelected && selectedCover && (
          <Image
            src={selectedCover}
            w={24}
            h={36}
            radius="xs"
            fallbackSrc="/cover-not-found.jpg"
          />
        )}
        {isSelected && selectedTitle && (
          <Text size="sm" c="dimmed" lineClamp={1} maw={120}>
            {selectedTitle}
          </Text>
        )}
        <Badge
          color={isSelected ? 'green' : 'gray'}
          variant={isSelected ? 'filled' : 'outline'}
          size="sm"
          leftSection={isSelected ? <IconCheck size={12} /> : null}
        >
          {isSelected ? 'Selected' : 'No selection'}
        </Badge>
      </Group>
    </Group>
  );
};

export default AccordionControl;
