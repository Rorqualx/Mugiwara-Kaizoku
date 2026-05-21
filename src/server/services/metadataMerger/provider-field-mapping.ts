/**
 * Provider Field Mapping for Unified Metadata Schema
 *
 * Maps provider-specific field names and structures to the unified metadata schema
 * to enable consistent data extraction across all providers.
 */

import type { UnifiedMangaMetadata, CharacterInfo, StaffInfo, TagInfo } from '@/types/search-types/metadata.types';

// ============================================================================
// Provider Field Mapping Definitions
// ============================================================================

export interface ProviderFieldMapping {
  unifiedField: keyof UnifiedMangaMetadata;
  providerFields: string[];
  transform?: (value: unknown, provider: string) => unknown;
  required?: boolean;
  priority?: number;
}

export interface ProviderMappingConfig {
  provider: string;
  mappings: ProviderFieldMapping[];
  defaultTransform?: (field: string, value: unknown) => unknown;
}

// ============================================================================
// Provider-Specific Field Mappings
// ============================================================================

export const ANILIST_MAPPINGS: ProviderMappingConfig = {
  provider: 'anilist',
  mappings: [
    { unifiedField: 'title', providerFields: ['title', 'title.romaji', 'title.english', 'title.native'], priority: 1 },
    { unifiedField: 'alternativeTitles', providerFields: ['synonyms', 'title.romaji', 'title.english', 'title.native'], transform: (value: unknown): string[] => {
      if (Array.isArray(value)) return value as string[];
      if (typeof value === 'string') return [value];
      return [];
    }},
    { unifiedField: 'description', providerFields: ['description'], transform: (value: unknown): unknown => {
      if (typeof value === 'string') return value.replace(/<[^>]*>/g, ''); // Strip HTML tags
      return value;
    }},
    { unifiedField: 'status', providerFields: ['status'], transform: (value: unknown): unknown => {
      if (typeof value === 'string') return value.toUpperCase();
      return value;
    }},
    { unifiedField: 'format', providerFields: ['format'], transform: (value: unknown): unknown => {
      if (typeof value === 'string') return value.toUpperCase();
      return value;
    }},
    { unifiedField: 'genres', providerFields: ['genres'], required: true },
    { unifiedField: 'tags', providerFields: ['tags'], transform: (value: unknown): TagInfo[] | unknown => {
      if (Array.isArray(value)) {
        return value.map((tag: unknown): TagInfo | unknown => {
          if (tag && typeof tag === 'object' && 'name' in tag) {
            const tagObj = tag as Record<string, unknown>;
            return {
              name: tagObj['name'] as string,
              category: tagObj['category'] as string | undefined,
              rank: tagObj['rank'] as number | undefined,
              isGeneralSpoiler: tagObj['isGeneralSpoiler'] as boolean | undefined,
              isMediaSpoiler: tagObj['isMediaSpoiler'] as boolean | undefined
            };
          }
          return tag;
        });
      }
      return value;
    }},
    { unifiedField: 'volumes', providerFields: ['volumes'] },
    { unifiedField: 'chapters', providerFields: ['chapters'] },
    { unifiedField: 'startDate', providerFields: ['startDate'], transform: (value: unknown): Date | unknown => {
      if (typeof value === 'object' && value !== null && 'year' in value && 'month' in value && 'day' in value) {
        const date = value as { year: number; month: number; day: number };
        return new Date(date.year, date.month - 1, date.day);
      }
      return value;
    }},
    { unifiedField: 'endDate', providerFields: ['endDate'], transform: (value: unknown): Date | unknown => {
      if (typeof value === 'object' && value !== null && 'year' in value && 'month' in value && 'day' in value) {
        const date = value as { year: number; month: number; day: number };
        return new Date(date.year, date.month - 1, date.day);
      }
      return value;
    }},
    { unifiedField: 'coverImage', providerFields: ['coverImage', 'coverImage.extraLarge', 'coverImage.large'], priority: 1 },
    { unifiedField: 'bannerImage', providerFields: ['bannerImage'] },
    { unifiedField: 'averageScore', providerFields: ['averageScore'] },
    { unifiedField: 'popularity', providerFields: ['popularity'] },
    { unifiedField: 'countryOfOrigin', providerFields: ['countryOfOrigin'] },
    { unifiedField: 'isAdult', providerFields: ['isAdult'] },
    { unifiedField: 'characters', providerFields: ['characters'], transform: (value: unknown): CharacterInfo[] | unknown => {
      if (Array.isArray(value)) {
        return value.map((character: unknown): CharacterInfo | unknown => {
          if (character && typeof character === 'object' && 'name' in character) {
            const charObj = character as Record<string, unknown>;
            const nameValue = charObj['name'];
            const imageValue = charObj['image'];

            return {
              name: (nameValue && typeof nameValue === 'object' && 'full' in nameValue
                ? (nameValue as Record<string, unknown>)['full']
                : nameValue) as string,
              role: charObj['role'] as string,
              image: imageValue && typeof imageValue === 'object' && 'large' in imageValue
                ? (imageValue as Record<string, unknown>)['large']
                : imageValue
            };
          }
          return character;
        });
      }
      return value;
    }},
    { unifiedField: 'staff', providerFields: ['staff'], transform: (value: unknown): StaffInfo[] | unknown => {
      if (Array.isArray(value)) {
        return value.map((staff: unknown): StaffInfo | unknown => {
          if (staff && typeof staff === 'object' && 'name' in staff) {
            const staffObj = staff as Record<string, unknown>;
            const nameValue = staffObj['name'];
            const imageValue = staffObj['image'];

            return {
              name: (nameValue && typeof nameValue === 'object' && 'full' in nameValue
                ? (nameValue as Record<string, unknown>)['full']
                : nameValue) as string,
              role: staffObj['role'] as string,
              image: imageValue && typeof imageValue === 'object' && 'large' in imageValue
                ? (imageValue as Record<string, unknown>)['large']
                : imageValue
            };
          }
          return staff;
        });
      }
      return value;
    }}
  ]
};

export const COMICVINE_MAPPINGS: ProviderMappingConfig = {
  provider: 'comicvine',
  mappings: [
    { unifiedField: 'title', providerFields: ['name', 'title'], priority: 1 },
    { unifiedField: 'alternativeTitles', providerFields: ['aliases'], transform: (value: unknown): string[] => {
      if (typeof value === 'string') return value.split('\\n').map(alias => alias.trim()).filter(Boolean);
      return [];
    }},
    { unifiedField: 'description', providerFields: ['description', 'deck'], transform: (value: unknown, _provider: string): unknown => {
      if (typeof value === 'string') return value.replace(/<[^>]*>/g, ''); // Strip HTML tags
      return value;
    }},
    { unifiedField: 'status', providerFields: [], transform: (): string => {
      // ComicVine doesn't have explicit status, infer from dates
      return 'FINISHED'; // Default assumption
    }},
    { unifiedField: 'format', providerFields: [], transform: (): string => 'MANGA' },
    { unifiedField: 'genres', providerFields: ['genres'], transform: (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value.map((genre: unknown) => {
          if (genre && typeof genre === 'object' && 'name' in genre) {
            return (genre as Record<string, unknown>)['name'] as string;
          }
          return '';
        }).filter(Boolean);
      }
      return [];
    }},
    { unifiedField: 'themes', providerFields: ['concepts'], transform: (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value.map((concept: unknown) => {
          if (concept && typeof concept === 'object' && 'name' in concept) {
            return (concept as Record<string, unknown>)['name'] as string;
          }
          return '';
        }).filter(Boolean);
      }
      return [];
    }},
    { unifiedField: 'volumes', providerFields: ['count_of_issues'], transform: (value: unknown): number | undefined => {
      if (typeof value === 'number') return value;
      return undefined;
    }},
    { unifiedField: 'chapters', providerFields: [], transform: (): undefined => undefined },
    { unifiedField: 'startDate', providerFields: ['start_year'], transform: (value: unknown): Date | unknown => {
      if (typeof value === 'number') return new Date(value, 0, 1);
      return value;
    }},
    { unifiedField: 'endDate', providerFields: [], transform: (): undefined => undefined },
    { unifiedField: 'coverImage', providerFields: ['image', 'image.original_url', 'image.super_url'], priority: 1 },
    { unifiedField: 'bannerImage', providerFields: [] },
    { unifiedField: 'authors', providerFields: ['person_credits'], transform: (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value
          .filter((person: unknown) => {
            if (person && typeof person === 'object' && 'role' in person) {
              const role = (person as Record<string, unknown>)['role'];
              return typeof role === 'string' &&
                (role.toLowerCase().includes('writer') || role.toLowerCase().includes('author'));
            }
            return false;
          })
          .map((person: unknown) => {
            if (person && typeof person === 'object' && 'name' in person) {
              return (person as Record<string, unknown>)['name'] as string;
            }
            return '';
          })
          .filter(Boolean);
      }
      return [];
    }},
    { unifiedField: 'artists', providerFields: ['person_credits'], transform: (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value
          .filter((person: unknown) => {
            if (person && typeof person === 'object' && 'role' in person) {
              const role = (person as Record<string, unknown>)['role'];
              return typeof role === 'string' &&
                (role.toLowerCase().includes('artist') || role.toLowerCase().includes('penciler'));
            }
            return false;
          })
          .map((person: unknown) => {
            if (person && typeof person === 'object' && 'name' in person) {
              return (person as Record<string, unknown>)['name'] as string;
            }
            return '';
          })
          .filter(Boolean);
      }
      return [];
    }},
    { unifiedField: 'publisher', providerFields: ['publisher', 'publisher.name'] },
    { unifiedField: 'characters', providerFields: ['characters'], transform: (value: unknown): unknown => {
      if (Array.isArray(value)) {
        return value.map((character: unknown) => {
          if (character && typeof character === 'object' && 'name' in character) {
            const charObj = character as Record<string, unknown>;
            return {
              name: charObj['name'] as string,
              role: (charObj['role'] as string) || 'SUPPORTING'
            };
          }
          return character;
        });
      }
      return value;
    }}
  ]
};

export const FANDOM_MAPPINGS: ProviderMappingConfig = {
  provider: 'fandom',
  mappings: [
    { unifiedField: 'title', providerFields: ['title', 'name'], priority: 1 },
    { unifiedField: 'alternativeTitles', providerFields: ['alternative_titles', 'synonyms'], transform: (value: unknown): string[] => {
      if (Array.isArray(value)) return value as string[];
      if (typeof value === 'string') return [value];
      return [];
    }},
    { unifiedField: 'description', providerFields: ['description', 'summary'], transform: (value: unknown): unknown => {
      if (typeof value === 'string') return value.replace(/<[^>]*>/g, ''); // Strip HTML tags
      return value;
    }},
    { unifiedField: 'status', providerFields: ['status', 'publication_status'], transform: (value: unknown): unknown => {
      if (typeof value === 'string') {
        const statusMap: Record<string, string> = {
          'ongoing': 'RELEASING',
          'completed': 'FINISHED',
          'hiatus': 'HIATUS',
          'cancelled': 'CANCELLED'
        };
        return statusMap[value.toLowerCase()] || value.toUpperCase();
      }
      return value;
    }},
    { unifiedField: 'format', providerFields: ['format', 'type'], transform: (value: unknown): unknown => {
      if (typeof value === 'string') {
        const formatMap: Record<string, string> = {
          'manga': 'MANGA',
          'manhwa': 'MANHWA',
          'manhua': 'MANHUA',
          'novel': 'NOVEL',
          'one_shot': 'ONE_SHOT'
        };
        return formatMap[value.toLowerCase()] || value.toUpperCase();
      }
      return value;
    }},
    { unifiedField: 'genres', providerFields: ['genres', 'categories'], required: true },
    { unifiedField: 'themes', providerFields: ['themes', 'categories'] },
    { unifiedField: 'volumes', providerFields: ['volumes', 'total_volumes'] },
    { unifiedField: 'chapters', providerFields: ['chapters', 'total_chapters'] },
    { unifiedField: 'startDate', providerFields: ['start_date', 'publication_start'] },
    { unifiedField: 'endDate', providerFields: ['end_date', 'publication_end'] },
    { unifiedField: 'coverImage', providerFields: ['cover_image', 'image', 'cover'], priority: 1 },
    { unifiedField: 'bannerImage', providerFields: ['banner_image'] },
    { unifiedField: 'authors', providerFields: ['authors', 'writer'] },
    { unifiedField: 'artists', providerFields: ['artists', 'illustrator'] },
    { unifiedField: 'publisher', providerFields: ['publisher', 'magazine'] },
    { unifiedField: 'demographic', providerFields: ['demographic', 'target_audience'] }
  ]
};

export const KITSU_MAPPINGS: ProviderMappingConfig = {
  provider: 'kitsu',
  mappings: [
    { unifiedField: 'title', providerFields: ['canonicalTitle'], priority: 0 },
    { unifiedField: 'alternativeTitles', providerFields: ['alternativeTitles'] },
    { unifiedField: 'description', providerFields: ['synopsis'], priority: 0 },
    { unifiedField: 'status', providerFields: ['status'] },
    { unifiedField: 'format', providerFields: ['subtype'] },
    { unifiedField: 'volumes', providerFields: ['volumeCount'] },
    { unifiedField: 'chapters', providerFields: ['chapterCount'] },
    { unifiedField: 'startDate', providerFields: ['startDate'] },
    { unifiedField: 'endDate', providerFields: ['endDate'] },
    { unifiedField: 'coverImage', providerFields: ['posterImageUrl', 'coverImageUrl'], priority: 0 },
    { unifiedField: 'publisher', providerFields: ['serialization'] },
    { unifiedField: 'ageRating', providerFields: ['ageRating'], priority: 1 },
  ],
};

export const WIKIPEDIA_MAPPINGS: ProviderMappingConfig = {
  provider: 'wikipedia',
  mappings: [
    { unifiedField: 'title', providerFields: ['title', 'name'], priority: 1 },
    { unifiedField: 'alternativeTitles', providerFields: ['alternative_titles', 'other_names'] },
    { unifiedField: 'description', providerFields: ['description', 'summary', 'plot'], transform: (value: unknown): unknown => {
      if (typeof value === 'string') return value.replace(/<[^>]*>/g, ''); // Strip HTML tags
      return value;
    }},
    { unifiedField: 'status', providerFields: ['status'] },
    { unifiedField: 'format', providerFields: ['format', 'type'] },
    { unifiedField: 'genres', providerFields: ['genres'] },
    { unifiedField: 'volumes', providerFields: ['volumes'] },
    { unifiedField: 'chapters', providerFields: ['chapters'] },
    { unifiedField: 'startDate', providerFields: ['start_date', 'first_published'] },
    { unifiedField: 'endDate', providerFields: ['end_date', 'last_published'] },
    { unifiedField: 'coverImage', providerFields: ['cover_image', 'image'], priority: 1 },
    { unifiedField: 'authors', providerFields: ['authors'] },
    { unifiedField: 'artists', providerFields: ['artists'] },
    { unifiedField: 'publisher', providerFields: ['publisher'] }
  ]
};

// ============================================================================
// Provider Field Mapping Registry
// ============================================================================

export const PROVIDER_MAPPINGS: Record<string, ProviderMappingConfig> = {
  anilist: ANILIST_MAPPINGS,
  comicvine: COMICVINE_MAPPINGS,
  fandom: FANDOM_MAPPINGS,
  wikipedia: WIKIPEDIA_MAPPINGS,
  kitsu: KITSU_MAPPINGS,
};

// ============================================================================
// Provider Field Mapping Service
// ============================================================================

export class ProviderFieldMappingService {
  /**
   * Map provider-specific data to unified metadata schema
   */
  static mapProviderDataToUnifiedSchema(
    provider: string,
    providerData: Record<string, unknown>
  ): Partial<UnifiedMangaMetadata> {
    const mappingConfig = PROVIDER_MAPPINGS[provider];
    if (!mappingConfig) {
      console.warn(`No field mapping configuration found for provider: ${provider}`);
      return {};
    }

    const unifiedData: Partial<UnifiedMangaMetadata> = {};

    for (const mapping of mappingConfig.mappings) {
      let value: unknown = undefined;

      // Try each provider field in order
      for (const providerField of mapping.providerFields) {
        const fieldValue = this.getNestedValue(providerData, providerField);
        if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
          value = fieldValue;
          break;
        }
      }

      // Apply transformation if available
      if (value !== undefined && mapping.transform) {
        value = mapping.transform(value, provider);
      }

      // Set the value if it's valid
      if (value !== undefined && value !== null && value !== '') {
        (unifiedData as Record<string, unknown>)[mapping.unifiedField] = value;
      }
    }

    return unifiedData;
  }

  /**
   * Get nested value from object using dot notation
   */
  private static getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj as unknown);
  }

  /**
   * Get all available providers
   */
  static getAvailableProviders(): string[] {
    return Object.keys(PROVIDER_MAPPINGS);
  }

  /**
   * Get mapping configuration for a specific provider
   */
  static getProviderMapping(provider: string): ProviderMappingConfig | undefined {
    return PROVIDER_MAPPINGS[provider];
  }

  /**
   * Get all unified fields that can be mapped from a provider
   */
  static getMappableFields(provider: string): string[] {
    const mapping = PROVIDER_MAPPINGS[provider];
    if (!mapping) return [];

    return mapping.mappings.map(m => m.unifiedField as string);
  }

  /**
   * Check if a provider can provide data for a specific unified field
   */
  static canProviderProvideField(provider: string, unifiedField: string): boolean {
    const mapping = PROVIDER_MAPPINGS[provider];
    if (!mapping) return false;

    return mapping.mappings.some(m => m.unifiedField === unifiedField);
  }

  /**
   * Get the best provider for a specific field based on mapping configuration
   */
  static getBestProviderForField(
    field: string,
    availableProviders: string[]
  ): { provider: string; confidence: number } {
    let bestProvider = availableProviders[0] ?? 'anilist';
    let bestConfidence = 0;

    for (const provider of availableProviders) {
      const mapping = PROVIDER_MAPPINGS[provider];
      if (!mapping) continue;

      const fieldMapping = mapping.mappings.find(m => m.unifiedField === field);
      if (fieldMapping) {
        const confidence = fieldMapping.priority ? fieldMapping.priority * 20 : 50;
        if (confidence > bestConfidence) {
          bestProvider = provider;
          bestConfidence = confidence;
        }
      }
    }

    return { provider: bestProvider, confidence: bestConfidence };
  }
}