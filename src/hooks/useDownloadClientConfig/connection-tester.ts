/**
 * Download Client Connection Tester
 *
 * Function to test download client connections.
 * Creates a connection tester that validates connectivity
 * to various download clients (Transmission, Deluge, SABnzbd, NZBGet).
 *
 * Extracted from: useDownloadClientConfig.ts
 * Type safety fixes applied.
 */

import type { Dispatch, SetStateAction } from 'react';

import { showSuccessNotification, showErrorNotification, formatErrorMessage } from './utils';

import type {
  DownloadClientConfig,
  DownloadClientType,
  TestConnectionState,
  TransmissionConfig,
  DelugeConfig,
  SabnzbdConfig,
  NzbgetConfig
} from './types';

// ============================================================================
// Response Types
// ============================================================================

/**
 * Response type for test connection API
 *
 * This interface provides type safety for the JSON response
 * from the test connection endpoint.
 */
export interface TestConnectionResponse {
  success: boolean;
  message?: string;
}

// ============================================================================
// Connection Tester Factory
// ============================================================================

/**
 * Create a connection tester function
 *
 * Factory function that creates a connection tester bound to the current
 * download client configuration state. The returned function can test
 * connectivity to any of the supported download clients.
 *
 * @param downloadClientConfig - Current config state
 * @param setTestState - State setter for test state
 * @returns Function to test client connection
 *
 * @example
 * ```typescript
 * const testConnection = createConnectionTester(config, setTestState);
 * await testConnection('transmission');
 * ```
 */
export function createConnectionTester(
  downloadClientConfig: DownloadClientConfig,
  setTestState: Dispatch<SetStateAction<TestConnectionState>>
): (clientType: DownloadClientType) => Promise<void> {
  return async (clientType: DownloadClientType): Promise<void> => {
    setTestState({
      client: clientType,
      status: 'testing',
      message: 'Testing connection...'
    });

    try {
      // Get client config based on type
      let clientConfig: TransmissionConfig | DelugeConfig | SabnzbdConfig | NzbgetConfig;

      switch (clientType) {
        case 'transmission':
          clientConfig = downloadClientConfig.transmission;
          break;
        case 'deluge':
          clientConfig = downloadClientConfig.deluge;
          break;
        case 'sabnzbd':
          clientConfig = downloadClientConfig.sabnzbd;
          break;
        case 'nzbget':
          clientConfig = downloadClientConfig.nzbget;
          break;
        default:
          throw new Error(`Unknown client type: ${String(clientType)}`);
      }

      // Call the test endpoint
      const response = await fetch('/api/settings/test-client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientType,
          config: clientConfig
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Connection test failed');
      }

      // Type the JSON response properly to avoid `any` type
      const result = await response.json() as TestConnectionResponse;

      // Update test state with success
      setTestState({
        client: clientType,
        status: 'success',
        message: result.message ?? 'Connection successful'
      });

      // Show success notification
      showSuccessNotification(
        'Connection Test Successful',
        `Successfully connected to ${clientType}`
      );
    } catch (err: unknown) {
      const errorMessage = formatErrorMessage(err);

      // Update test state with error
      setTestState({
        client: clientType,
        status: 'error',
        message: errorMessage
      });

      // Show error notification
      showErrorNotification(
        'Connection Test Failed',
        `Failed to connect to ${clientType}: ${errorMessage}`
      );
    }
  };
}
