/**
 * API Settings - Hooks Module
 *
 * Custom hooks for tRPC queries, mutations, and form management.
 * Handles all API key and webhook operations.
 *
 * Extracted from: api.tsx (lines 94-257)
 */

import { useForm, type UseFormReturnType } from '@mantine/form';

import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

import type { ApiKeyFormValues, WebhookFormValues } from './types';

// ============================================================================
// Data Hooks
// ============================================================================

/**
 * Hook for fetching API settings data (keys and webhooks)
 */
export function useApiSettingsData(): {
  apiKeys: ReturnType<typeof trpc.api.getApiKeys.useQuery>;
  webhooks: ReturnType<typeof trpc.api.getWebhooks.useQuery>;
} {
  const apiKeys = trpc.api.getApiKeys.useQuery();
  const webhooks = trpc.api.getWebhooks.useQuery();

  return { apiKeys, webhooks };
}

// Alias for backward compatibility
export const useApiKeys = useApiSettingsData;
export const useWebhooks = useApiSettingsData;

// Placeholder for missing handler
export const useApiKeyHandlers = (): {
  onCreateApiKey: () => void;
  onDeleteApiKey: () => void;
} => ({
  // This is a placeholder - implement actual handlers as needed
  onCreateApiKey: () => {},
  onDeleteApiKey: () => {},
});

// ============================================================================
// API Key Mutations
// ============================================================================

/**
 * Hook for API key mutations (create, delete)
 */
export function useApiKeyMutations(
  setShowApiKey: (key: string | null) => void,
  setCreateKeyModalOpen: (open: boolean) => void
): {
  createApiKey: ReturnType<typeof trpc.api.createApiKey.useMutation>;
  deleteApiKey: ReturnType<typeof trpc.api.deleteApiKey.useMutation>;
} {
  const utils = trpc.useUtils();

  const createApiKey = trpc.api.createApiKey.useMutation({
    onSuccess: (data) => {
      setShowApiKey((data as { key: string }).key);
      setCreateKeyModalOpen(false);
      void utils.api.getApiKeys.invalidate();
      notify({ severity: 'SUCCESS', title: 'API Key Created', message: 'Your new API key has been created successfully' });
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Failed to create API key', message: (error instanceof Error ? error.message : String(error)) });
    }
  });

  const deleteApiKey = trpc.api.deleteApiKey.useMutation({
    onSuccess: () => {
      void utils.api.getApiKeys.invalidate();
      notify({ severity: 'SUCCESS', title: 'API Key Deleted', message: 'The API key has been deleted successfully' });
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Failed to delete API key', message: (error instanceof Error ? error.message : String(error)) });
    }
  });

  return { createApiKey, deleteApiKey };
}

// ============================================================================
// Webhook Mutations
// ============================================================================

/**
 * Hook for webhook mutations (create, delete, test)
 */
export function useWebhookMutations(setCreateWebhookModalOpen: (open: boolean) => void): {
  createWebhook: ReturnType<typeof trpc.api.createWebhook.useMutation>;
  deleteWebhook: ReturnType<typeof trpc.api.deleteWebhook.useMutation>;
  testWebhook: ReturnType<typeof trpc.api.testWebhook.useMutation>;
} {
  const utils = trpc.useUtils();

  const createWebhook = trpc.api.createWebhook.useMutation({
    onSuccess: () => {
      setCreateWebhookModalOpen(false);
      void utils.api.getWebhooks.invalidate();
      notify({ severity: 'SUCCESS', title: 'Webhook Created', message: 'Your webhook has been configured successfully' });
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Failed to create webhook', message: (error instanceof Error ? error.message : String(error)) });
    }
  });

  const deleteWebhook = trpc.api.deleteWebhook.useMutation({
    onSuccess: () => {
      void utils.api.getWebhooks.invalidate();
      notify({ severity: 'SUCCESS', title: 'Webhook Deleted', message: 'The webhook has been deleted successfully' });
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Failed to delete webhook', message: (error instanceof Error ? error.message : String(error)) });
    }
  });

  const testWebhook = trpc.api.testWebhook.useMutation({
    onSuccess: () => {
      notify({ severity: 'SUCCESS', title: 'Test Webhook Sent', message: 'Test webhook was sent successfully' });
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Test Failed', message: (error instanceof Error ? error.message : String(error)) });
    }
  });

  return { createWebhook, deleteWebhook, testWebhook };
}

// ============================================================================
// Forms
// ============================================================================

/**
 * Hook for API key form with validation
 */
export function useApiKeyForm(): UseFormReturnType<ApiKeyFormValues> {
  return useForm<ApiKeyFormValues>({
    initialValues: {
      name: '',
      permissions: [] as string[],
      expiresIn: '0' // 0 means no expiration
    },
    validate: {
      name: (value: string) => !value.trim() ? 'Name is required' : null,
      permissions: (value: string[]) => value.length === 0 ? 'At least one permission is required' : null
    }
  });
}

/**
 * Hook for webhook form with validation
 */
export function useWebhookForm(): UseFormReturnType<WebhookFormValues> {
  return useForm<WebhookFormValues>({
    initialValues: {
      url: '',
      events: [] as string[],
      secret: ''
    },
    validate: {
      url: (value: string) => {
        if (!value.trim()) return 'URL is required';
        try {
          new URL(value);
          if (!value.startsWith('https://')) return 'URL must use HTTPS';
          return null;
        } catch {
          return 'Invalid URL';
        }
      },
      events: (value: string[]) => value.length === 0 ? 'At least one event is required' : null
    }
  });
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Create API key handler
 */
export function createHandleCreateApiKey(
  createApiKeyMutation: ReturnType<typeof useApiKeyMutations>['createApiKey']
): (values: ApiKeyFormValues) => void {
  return (values: ApiKeyFormValues): void => {
    const permissions = values.permissions.map((resource) => ({
      resource,
      actions: ['read', 'write'], // Default to read/write for now
      scope: undefined
    }));

    void createApiKeyMutation.mutateAsync({
      name: values.name,
      permissions,
      expiresIn: values.expiresIn === '0' ? undefined : parseInt(values.expiresIn)
    });
  };
}

/**
 * Create webhook handler
 */
export function createHandleCreateWebhook(
  createWebhookMutation: ReturnType<typeof useWebhookMutations>['createWebhook']
): (values: WebhookFormValues) => void {
  return (values: WebhookFormValues): void => {
    void createWebhookMutation.mutateAsync({
      url: values.url,
      events: values.events,
      secret: values.secret
    });
  };
}