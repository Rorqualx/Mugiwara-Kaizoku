/**
 * Config Hook Factory
 *
 * Factory pattern for creating type-safe configuration hooks with tRPC integration.
 * Eliminates code duplication across multiple config hooks while maintaining type safety.
 *
 * Features:
 * - Automatic tRPC query/mutation generation
 * - Built-in AsyncResult error handling
 * - Type-safe configuration schemas
 * - Optimistic updates support
 * - Cache invalidation
 *
 * @module hooks/factories/createConfigHook
 */

import React, { useCallback, useMemo } from 'react';

import { z } from 'zod';

import type {
  AsyncResult} from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  isSuccess,
  isError,
} from '@/utils/async-result';
import { getErrorMessage } from '@/utils/errors';
import { trpc } from '@/utils/trpc-client/index';

/**
 * Configuration hook options
 */
export interface ConfigHookOptions<TSchema extends z.ZodType> {
  /** Unique key for this configuration */
  configKey: string;
  /** Zod schema for validation */
  schema: TSchema;
  /** Default value if none exists */
  defaultValue: z.infer<TSchema>;
  /** Optional scope for configuration */
  scope?: 'global' | 'user' | 'library' | 'manga';
  /** Enable optimistic updates */
  optimisticUpdates?: boolean;
  /** Custom garbage collection time in ms (renamed from cacheTime in TanStack Query v5) */
  gcTime?: number;
}

/**
 * Configuration hook return type
 */
export interface ConfigHook<T> {
  /** Current configuration value */
  config: T;
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Error from fetch or update */
  error: Error | null;
  /** Update configuration value */
  updateConfig: (value: Partial<T>) => Promise<AsyncResult<T, Error>>;
  /** Reset to default value */
  resetConfig: () => Promise<AsyncResult<T, Error>>;
  /** Refetch configuration */
  refetch: () => Promise<void>;
  /** Check if value has been modified from default */
  isModified: boolean;
  /** Validate a potential config value */
  validate: (value: unknown) => AsyncResult<T, Error>;
}

/**
 * Creates a type-safe configuration hook
 *
 * @example
 * ```typescript
 * const useThemeConfig = createConfigHook({
 *   configKey: 'theme',
 *   schema: themeSchema,
 *   defaultValue: { mode: 'light', primaryColor: '#000' }
 * });
 * ```
 */
export function createConfigHook<TSchema extends z.ZodType>(
  options: ConfigHookOptions<TSchema>
): () => ConfigHook<z.infer<TSchema>> {
  type ConfigType = z.infer<TSchema>;

  return function useConfigHook(): ConfigHook<ConfigType> {
    const {
      configKey,
      schema,
      defaultValue,
      scope = 'global',
      optimisticUpdates = true,
      gcTime: _gcTime = 5 * 60 * 1000, // 5 minutes default - reserved for future use (renamed from cacheTime in TanStack Query v5)
    } = options;

    // tRPC mutations (config.get is actually a mutation in the router)
    const configMutation = trpc.config.get.useMutation();

    // Use React Query for caching the config value
    const [configData, setConfigData] = React.useState<ConfigType | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<Error | null>(null);

    // Store stable references for effect dependencies
    const configMutationRef = React.useRef(configMutation);
    const schemaRef = React.useRef(schema);
    const defaultValueRef = React.useRef(defaultValue);

    // Update refs when values change
    React.useEffect(() => {
      configMutationRef.current = configMutation;
      schemaRef.current = schema;
      defaultValueRef.current = defaultValue;
    }, [configMutation, schema, defaultValue]);

    // Fetch config on mount
    React.useEffect(() => {
      const fetchConfig = async (): Promise<void> => {
        try {
          setIsLoading(true);
          const value = await configMutationRef.current.mutateAsync({
            key: configKey,
            defaultValue: defaultValueRef.current
          });
          if (value !== undefined && value !== null) {
            try {
              const parsed = schemaRef.current.parse(value) as ConfigType;
              setConfigData(parsed);
            } catch (_parseError: unknown) {
              // Schema validation failed, use default value
              setConfigData(defaultValueRef.current);
            }
          } else {
            setConfigData(defaultValueRef.current);
          }
        } catch (err: unknown) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setConfigData(defaultValueRef.current);
        } finally {
          setIsLoading(false);
        }
      };
      void fetchConfig();
    }, [configKey]);

    const updateMutation = trpc.config.set.useMutation();

    // Compute current config value
    // Note: Type assertion needed due to generic type inference limitations
    // configData and defaultValue are both ConfigType, but TypeScript can't verify
    // this through the generic z.infer<TSchema> at compile time
    const config: ConfigType = useMemo(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Generic type inference limitation
      () => configData ?? defaultValue,
      [configData, defaultValue]
    );

    // Check if modified from default
    const isModified = useMemo(() => {
      return JSON.stringify(config) !== JSON.stringify(defaultValue);
    }, [config, defaultValue]);

    // Validate function
    const validate = useCallback(
      (value: unknown): AsyncResult<ConfigType, Error> => {
        try {
          const validated = schema.parse(value) as unknown as ConfigType;
          return createSuccessResult(validated);
        } catch (error: unknown) {
          if (error instanceof z.ZodError) {
            return createErrorResult(
              new Error(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`)
            );
          }
          return createErrorResult(
            new Error(`Validation failed: ${getErrorMessage(error)}`)
          );
        }
      },
      [schema]
    );

    // Update configuration
    const updateConfig = useCallback(
      async (value: Partial<ConfigType>): Promise<AsyncResult<ConfigType, Error>> => {
        try {
          // Merge with current config
          const newConfig = { ...config, ...value };

          // Validate new configuration
          const validationResult = validate(newConfig);
          if (isError(validationResult)) {
            return validationResult;
          }

          // After type guard, TypeScript knows it's a success result
          const validatedData = isSuccess(validationResult) ? validationResult.data : newConfig as ConfigType;

          // Optimistic update if enabled
          if (optimisticUpdates) {
            setConfigData(validatedData);
          }

          // Send update to server — config.set throws TRPCError on failure (caught below).
          await updateMutation.mutateAsync({
            key: configKey,
            value: validatedData as unknown,
            metadata: { scope }
          });

          return createSuccessResult(validatedData);
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error);
          console.error(`Failed to update config ${configKey}:`, errorMessage);

          // Revert optimistic update on error
          if (optimisticUpdates) {
            try {
              // Re-fetch the config
              const refreshed = await configMutation.mutateAsync({
                key: configKey,
                defaultValue
              });
              if (refreshed !== undefined && refreshed !== null) {
                const parsed = schema.parse(refreshed) as unknown as ConfigType;
                setConfigData(parsed);
              }
            } catch {
              setConfigData(defaultValue);
            }
          }

          return createErrorResult(new Error(errorMessage));
        }
      },
      [config, validate, configKey, scope, optimisticUpdates, updateMutation, configMutation, defaultValue, schema]
    );

    // Reset configuration
    const resetConfig = useCallback(
      async (): Promise<AsyncResult<ConfigType, Error>> => {
        try {
          // Reset by setting to default value — config.set throws TRPCError on failure.
          await updateMutation.mutateAsync({
            key: configKey,
            value: defaultValue as unknown,
            metadata: { scope }
          });

          setConfigData(defaultValue);
          return createSuccessResult(defaultValue);
        } catch (error: unknown) {
          const errorMessage = getErrorMessage(error);
          console.error(`Failed to reset config ${configKey}:`, errorMessage);
          return createErrorResult(new Error(errorMessage));
        }
      },
      [configKey, scope, defaultValue, updateMutation]
    );

    // Refetch configuration
    const refetch = useCallback(async (): Promise<void> => {
      try {
        setIsLoading(true);
        const value = await configMutation.mutateAsync({
          key: configKey,
          defaultValue
        });
        if (value !== undefined && value !== null) {
          try {
            const parsed = schema.parse(value) as unknown as ConfigType;
            setConfigData(parsed);
          } catch (e: unknown) {
            console.error(`Invalid config for ${configKey}:`, e);
            setConfigData(defaultValue);
          }
        } else {
          setConfigData(defaultValue);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    }, [configMutation, configKey, defaultValue, schema]);

    return {
      config,
      isLoading,
      error,
      updateConfig,
      resetConfig,
      refetch,
      isModified,
      validate,
    };
  };
}

/**
 * Helper to create multiple related config hooks
 *
 * @example
 * ```typescript
 * const configHooks = createConfigHookFamily({
 *   theme: { schema: themeSchema, defaultValue: defaultTheme },
 *   editor: { schema: editorSchema, defaultValue: defaultEditor },
 * });
 *
 * export const { useThemeConfig, useEditorConfig } = configHooks;
 * ```
 */
export function createConfigHookFamily<
  TConfigs extends Record<string, { schema: z.ZodType; defaultValue: unknown }>
>(
  configs: TConfigs,
  globalOptions?: Partial<Omit<ConfigHookOptions<z.ZodType>, 'configKey' | 'schema' | 'defaultValue'>>
): {
  [K in keyof TConfigs as `use${Capitalize<string & K>}Config`]: ReturnType<
    typeof createConfigHook<TConfigs[K]['schema']>
  >;
} {
  const hooks = {} as {
    [K in keyof TConfigs as `use${Capitalize<string & K>}Config`]: ReturnType<
      typeof createConfigHook<TConfigs[K]['schema']>
    >;
  };

  for (const [key, config] of Object.entries(configs)) {
    const hookName = `use${key.charAt(0).toUpperCase()}${key.slice(1)}Config` as keyof typeof hooks;
    hooks[hookName] = createConfigHook({
      configKey: key,
      ...config,
      ...globalOptions,
    }) as typeof hooks[typeof hookName];
  }

  return hooks;
}