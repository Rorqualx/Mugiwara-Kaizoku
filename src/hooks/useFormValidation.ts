import { useState, useCallback } from 'react';

import { z } from 'zod';

import { isObject } from '@/utils/type-guards';

import { useNotification } from './useNotification';

/**
 * Configuration options for form validation
 * 
 * @interface ValidationOptions
 * @template T Type of validated data
 * @property {z.ZodType<T>} schema - Zod schema for validation
 * @property {(data: T) => void | Promise<void>} [onSuccess] - Callback on successful validation
 * @property {(error: z.ZodError) => void} [onError] - Custom error handler
 */
export interface ValidationOptions<T> {
  schema: z.ZodType<T>;
  onSuccess?: (data: T) => void | Promise<void>;
  onError?: (error: z.ZodError) => void;
}

/**
 * Return type for the useFormValidation hook
 * @template T Type of validated data
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- T is used for documentation/API clarity
export interface UseFormValidationResult<T> {
  errors: z.ZodError | null;
  validate: (data: unknown) => Promise<boolean>;
  getFieldError: (path: string) => string | undefined;
  clearErrors: () => void;
}

/**
 * Hook for form validation using Zod schemas
 * 
 * This hook provides form validation functionality using Zod schemas with
 * built-in error handling and notifications. It supports both synchronous
 * and asynchronous validation with success/error callbacks.
 * 
 * @template T Type of validated data
 * @param {ValidationOptions<T>} options - Validation configuration
 * @returns {UseFormValidationResult<T>} Validation state and functions
 * 
 * @example
 * ```tsx
 * const schema = z.object({
 *   username: z.string().min(3),
 *   email: z.string().email()
 * });
 * 
 * const { validate, getFieldError } = useFormValidation({
 *   schema,
 *   onSuccess: (data) => logger.info('Valid:', data)
 * });
 * 
 * // In form submit handler
 * const handleSubmit = (data) => {
 *   if (await validate(data)) {
 *     // Form is valid
 *   }
 * };
 * ```
 */
export function useFormValidation<T>({
  schema,
  onSuccess,
  onError
}: ValidationOptions<T>): UseFormValidationResult<T> {
  const [errors, setErrors] = useState<z.ZodError | null>(null);
  const {
    showError
  } = useNotification();
  const validate = useCallback(async (data: unknown): Promise<boolean> => {
    try {
      const validatedData = await schema.parseAsync(data);
      setErrors(null);
      if (onSuccess) {
        await onSuccess(validatedData);
      }
      return true;
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        setErrors(error);
        if (onError) {
          onError(error);
        } else {
          showError({
            title: 'Validation Error',
            message: error.errors.map((e: unknown) => {
              if (isObject(e) && 'message' in e && typeof e['message'] === 'string') {
                return e['message'];
              }
              return String(e);
            }).join('\n')
          });
        }
      }
      return false;
    }
  }, [schema, onSuccess, onError, showError]);
  const getFieldError = useCallback((path: string): string | undefined => {
    if (!errors) return undefined;
    const foundError = errors.errors.find((error: unknown) => {
      if (isObject(error) && 'path' in error && Array.isArray(error['path'])) {
        return (error['path'] as unknown[]).join('.') === path;
      }
      return false;
    });

    if (foundError && isObject(foundError) && 'message' in foundError && typeof foundError['message'] === 'string') {
      return foundError['message'];
    }
    return undefined;
  }, [errors]);
  const clearErrors = useCallback((): void => {
    setErrors(null);
  }, []);
  return {
    errors,
    validate,
    getFieldError,
    clearErrors
  };
}