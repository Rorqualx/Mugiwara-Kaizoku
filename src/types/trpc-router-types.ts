/**
 * tRPC Router Types
 * 
 * This file provides type definitions for the tRPC router endpoints,
 * ensuring proper typing for router calls and responses.
 */

import type { procedure } from '../server/trpc/trpc';

/**
 * Provider listing response type
 */
export interface ProviderInfo {
  id: string;
  name: string;
  displayName: string;
  description: string;
  status: string;
  isDefault: boolean;
}

/**
 * Default provider response type
 */
export interface DefaultProviderResponse {
  provider: string;
}

/**
 * Generic success response type
 */
export interface SuccessResponse {
  success: boolean;
  message?: string;
}

/**
 * Provider settings type
 */
export type ProviderSettings = Record<string, unknown>;

/**
 * Provider toggle input type
 */
export interface ProviderToggleInput {
  providerId: string;
  enabled: boolean;
}

/**
 * Provider settings update input type
 */
export interface ProviderSettingsUpdateInput {
  providerId: string;
  settings: ProviderSettings;
}

/**
 * Input for redirected provider methods
 */
export interface RedirectedInput {
  input: ProviderToggleInput | ProviderSettingsUpdateInput;
}

/**
 * Provider list method type
 */
export type ProviderListMethod = typeof procedure.query<() => Promise<ProviderInfo[]>>;

/**
 * Provider get default method type
 */
export type ProviderGetDefaultMethod = typeof procedure.query<() => Promise<DefaultProviderResponse>>;

/**
 * Provider set default method type
 */
export type ProviderSetDefaultMethod = typeof procedure.mutation<(params: {
  input: { providerId: string };
}) => Promise<SuccessResponse>>;

/**
 * Provider get settings method type
 */
export type ProviderGetSettingsMethod = typeof procedure.query<(params: {
  input: { providerId: string };
}) => Promise<ProviderSettings>>;

/**
 * Provider update settings method type
 */
export type ProviderUpdateSettingsMethod = typeof procedure.mutation<(params: {
  input: ProviderSettingsUpdateInput;
}) => Promise<SuccessResponse>>;

/**
 * Provider toggle method type
 */
export type ProviderToggleMethod = typeof procedure.mutation<(params: {
  input: ProviderToggleInput;
}) => Promise<SuccessResponse>>;

/**
 * Provider router interface
 */
export interface ProvidersRouter {
  list: ProviderListMethod;
  getDefault: ProviderGetDefaultMethod;
  setDefault: ProviderSetDefaultMethod;
  getSettings: ProviderGetSettingsMethod;
  updateSettings: ProviderUpdateSettingsMethod;
  toggle: ProviderToggleMethod;
}