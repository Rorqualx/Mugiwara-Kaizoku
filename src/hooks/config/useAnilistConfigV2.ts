/**
 * AniList Configuration Hook V2
 * 
 * Uses the config factory pattern for consistency and reduced duplication
 */

import { z } from 'zod';

import { createConfigHook } from '../factories/createConfigHook';

// Define AniList config schema
export const anilistConfigSchema = z.object({
  enabled: z.boolean().default(false),
  useForMetadata: z.boolean().default(true),
  clientId: z.string().default(''),
  clientSecret: z.string().default(''),
  accessToken: z.string().default(''),
  useEnhancedProvider: z.boolean().default(true),
  filterAdultContent: z.boolean().default(false),
});

export type AnilistConfig = z.infer<typeof anilistConfigSchema>;

// Create the hook using factory
export const useAnilistConfig = createConfigHook({
  configKey: 'anilist',
  schema: anilistConfigSchema,
  defaultValue: {
    enabled: false,
    useForMetadata: true,
    clientId: '',
    clientSecret: '',
    accessToken: '',
    useEnhancedProvider: true,
    filterAdultContent: false,
  },
});

export default useAnilistConfig;
