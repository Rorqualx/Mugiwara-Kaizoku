/**
 * TRPC Router Types Type Guards
 *
 * This module contains type guards for validating TRPC router type objects,
 * ensuring type safety for provider management, settings updates, router interfaces,
 * and input validation in the application's TRPC API layer.
 *
 * @module TRPCRouterTypesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  ProviderInfo,
  DefaultProviderResponse,
  ProviderToggleInput,
  ProviderSettingsUpdateInput,
  RedirectedInput,
  ProvidersRouter
} from "@/types/trpc-router-types";

/**
 * Type guard for ProviderInfo
 * Validates that an object conforms to the ProviderInfo interface
 */
export function isProviderInfo(obj: unknown): obj is ProviderInfo {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string" &&
    typeof candidate["displayName"] === "string" &&
    typeof candidate["description"] === "string" &&
    typeof candidate["status"] === "string" &&
    typeof candidate["isDefault"] === "boolean"
  );
}

/**
 * Type guard for DefaultProviderResponse
 * Validates that an object conforms to the DefaultProviderResponse interface
 */
export function isDefaultProviderResponse(obj: unknown): obj is DefaultProviderResponse {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["provider"] === "string"
  );
}

/**
 * Type guard for ProviderToggleInput
 * Validates that an object conforms to the ProviderToggleInput interface
 */
export function isProviderToggleInput(obj: unknown): obj is ProviderToggleInput {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["providerId"] === "string" &&
    typeof candidate["enabled"] === "boolean"
  );
}

/**
 * Type guard for ProviderSettingsUpdateInput
 * Validates that an object conforms to the ProviderSettingsUpdateInput interface
 */
export function isProviderSettingsUpdateInput(obj: unknown): obj is ProviderSettingsUpdateInput {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["providerId"] === "string" &&
    "settings" in candidate
  );
}

/**
 * Type guard for RedirectedInput
 * Validates that an object conforms to the RedirectedInput interface
 */
export function isRedirectedInput(obj: unknown): obj is RedirectedInput {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "input" in candidate
  );
}

/**
 * Type guard for ProvidersRouter
 * Validates that an object conforms to the ProvidersRouter interface
 */
export function isProvidersRouter(obj: unknown): obj is ProvidersRouter {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "list" in candidate &&
    "getDefault" in candidate &&
    "setDefault" in candidate &&
    "getSettings" in candidate &&
    "updateSettings" in candidate &&
    "toggle" in candidate
  );
}