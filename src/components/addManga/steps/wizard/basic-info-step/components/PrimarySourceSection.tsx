/**
 * PrimarySourceSection Component
 *
 * Displays the primary source input section with title and URL fields.
 * Handles metadata extraction from URLs.
 *
 * @module components/addManga/steps/wizard/basic-info-step/components
 */

import React from 'react';

import {
  Stack,
  Title,
  Paper,
  Group,
  TextInput,
  Badge,
  Alert,
  ActionIcon
} from '@mantine/core';
import {
  IconDownload,
  IconInfoCircle
} from '@tabler/icons-react';

/**
 * Props for PrimarySourceSection component
 */
export interface PrimarySourceSectionProps {
  /** Current title value */
  title: string;
  /** Title change handler */
  setTitle: (value: string) => void;
  /** Current URL value */
  url: string;
  /** URL change handler */
  setUrl: (value: string) => void;
  /** Primary provider name */
  provider: string;
  /** URL validation loading state */
  isValidatingUrl: boolean;
  /** URL parse handler */
  onUrlParse: () => void;
}

/**
 * PrimarySourceSection Component
 *
 * Handles primary source input with title and URL fields.
 * Provides metadata extraction button for URL input.
 */
export const PrimarySourceSection: React.FC<PrimarySourceSectionProps> = ({
  title,
  setTitle,
  url,
  setUrl,
  provider,
  isValidatingUrl,
  onUrlParse
}): React.ReactElement => {
  return (
    <Paper p="md">
      <Stack>
        <Group justify="space-between" align="center">
          <Title order={5}>Primary Source</Title>
          {provider && (
            <Badge variant="filled" color="blue" size="lg">
              {provider.charAt(0).toUpperCase() + provider.slice(1)}
            </Badge>
          )}
        </Group>

        <TextInput
          label="Title"
          placeholder="Enter manga title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <TextInput
          label="URL (Optional)"
          placeholder="Enter a URL to extract metadata..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          rightSection={
            <ActionIcon
              onClick={() => { void onUrlParse(); }}
              loading={isValidatingUrl}
              disabled={!url}
              size="lg"
            >
              <IconDownload size={18} />
            </ActionIcon>
          }
          description="Paste any manga URL from supported providers to auto-fill metadata"
        />

        {isValidatingUrl && (
          <Alert icon={<IconInfoCircle size={16} />} color="blue">
            Parsing URL and extracting metadata...
          </Alert>
        )}
      </Stack>
    </Paper>
  );
};

export default PrimarySourceSection;
