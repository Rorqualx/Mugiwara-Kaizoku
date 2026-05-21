/**
 * ComicVine Action Buttons
 */
import React from 'react';

import { Group, Button } from '@mantine/core';
import { IconTestPipe } from '@tabler/icons-react';

interface ActionButtonsProps {
  onSave: () => void;
  onTestApi: () => void;
  enabled: boolean;
  isLoading: boolean;
  saving?: string | undefined;
  testing: boolean;
  apiKeyInput: string;
  currentApiKey: string;
}

/**
 * Action buttons for save and test API connection.
 */
export function ActionButtons({
  onSave,
  onTestApi,
  enabled,
  isLoading,
  saving,
  testing,
  apiKeyInput,
  currentApiKey,
}: ActionButtonsProps): React.ReactElement {
  // Save itself enables ComicVine (handleSave sets enabled: true), so requiring
  // `enabled` would be a chicken-and-egg. Allow save when the input differs
  // from what's persisted, OR when ComicVine is currently disabled (so the
  // button can re-enable an already-saved key).
  const saveDisabled = !apiKeyInput || (apiKeyInput === currentApiKey && enabled);

  return (
    <Group align="center" grow mt="md">
      <Button
        onClick={onSave}
        loading={isLoading || saving === 'apiKey'}
        disabled={saveDisabled}
        aria-label="Save API key"
      >
        Save API Key
      </Button>

      <Button
        variant="light"
        onClick={onTestApi}
        loading={testing}
        disabled={!apiKeyInput}
        leftSection={<IconTestPipe size={16} />}
        aria-label="Test API connection"
      >
        Test API
      </Button>
    </Group>
  );
}
