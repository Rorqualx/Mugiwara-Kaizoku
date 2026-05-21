/**
 * ComicVine API Key Input Section
 */
import React from 'react';

import { Group, PasswordInput, Box } from '@mantine/core';
import { IconCheck, IconEye, IconEyeOff } from '@tabler/icons-react';

interface ApiKeySectionProps {
  apiKeyInput: string;
  onApiKeyChange: (value: string) => void;
  validationError?: string | undefined;
  onValidationErrorClear: () => void;
  enabled: boolean;
  isLoading: boolean;
  saving?: string | undefined;
}

/**
 * API Key input field with validation display
 */
export function ApiKeySection({
  apiKeyInput,
  onApiKeyChange,
  validationError,
  onValidationErrorClear,
  enabled,
  isLoading,
  saving
}: ApiKeySectionProps): React.ReactElement {
  const hasApiKey = apiKeyInput && apiKeyInput.length > 0;
  // The parent MetadataProviderCard controls enable/disable visibility.
  // The API key field should always be editable when the settings panel is shown.
  const isDisabled = isLoading || !!saving;

  return (
    <Group align="flex-start" grow>
      <PasswordInput
        label="API Key"
        description="Enter your ComicVine API key (get one from comicvine.gamespot.com)"
        placeholder="Your API key"
        value={apiKeyInput}
        onChange={(event) => {
          onApiKeyChange(event.currentTarget.value);
          if (validationError) {
            onValidationErrorClear();
          }
        }}
        error={!apiKeyInput && enabled ? "API key is required" : undefined}
        disabled={isDisabled}
        visibilityToggleIcon={({ reveal }) =>
          reveal ? <IconEyeOff size={16} /> : <IconEye size={16} />
        }
        rightSection={
          hasApiKey ? (
            <Box mr={8}>
              <IconCheck size={18} color="#4CAF50" />
            </Box>
          ) : null
        }
        styles={{
          input: {
            borderColor: hasApiKey
              ? '#4CAF50'
              : !apiKeyInput && enabled
              ? '#fa5252'
              : undefined,
            borderWidth: hasApiKey || (!apiKeyInput && enabled) ? '2px' : undefined,
            backgroundColor: hasApiKey
              ? 'rgba(76, 175, 80, 0.05)'
              : !apiKeyInput && enabled
              ? 'rgba(250, 82, 82, 0.05)'
              : undefined
          },
          wrapper: {
            position: 'relative'
          }
        }}
        aria-required={enabled}
        aria-invalid={!!validationError}
        aria-describedby={validationError ? "api-key-error" : undefined}
        mt="lg"
      />
    </Group>
  );
}
