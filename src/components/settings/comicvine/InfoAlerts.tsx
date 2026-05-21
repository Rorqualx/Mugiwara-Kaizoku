/**
 * ComicVine Information Alerts
 */
import React from 'react';

import { Alert, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

import { safeRender } from '@/utils/safe-render';

interface InfoAlertsProps {
  error?: string | undefined;
  validationError?: string | undefined;
}

/**
 * Display information and error alerts
 */
export function InfoAlerts({ error, validationError }: InfoAlertsProps): React.ReactElement {
  return (
    <>
      <Alert title="About ComicVine Integration" color="blue" mb="md" role="status">
        ComicVine is a comprehensive comic database that can be used as a metadata source for your
        manga. To use this provider, you need to obtain an API key from ComicVine.
      </Alert>

      {(error || validationError) && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error"
          color="red"
          role="alert"
        >
          {safeRender(validationError ?? error ?? '')}
        </Alert>
      )}

      <Text size="sm" c="dimmed" role="note">
        Note: ComicVine enforces a rate limit of approximately 200 requests per hour.
        Excess requests will fail until the limit resets.
      </Text>
    </>
  );
}
