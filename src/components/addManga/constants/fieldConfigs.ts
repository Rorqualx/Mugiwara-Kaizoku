/**
 * Field Configuration Constants
 * 
 * Defines the configuration for all metadata fields in the Add Manga workflow
 */

import type { FieldType } from '../types';

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  category: 'basic' | 'metadata' | 'dates' | 'scores' | 'ids' | 'people';
  validation?: (value: unknown) => string | null;
  transform?: (value: unknown) => unknown;
  placeholder?: string;
  description?: string;
}

export const FIELD_CONFIGS: Record<string, FieldConfig> = {
  // Basic Information
  title: {
    name: 'title',
    label: 'Title',
    type: 'text',
    required: true,
    category: 'basic',
    validation: (value) => !value ? 'Title is required' : null
  },
  alternativeTitles: {
    name: 'alternativeTitles',
    label: 'Alternative Titles',
    type: 'multiselect',
    category: 'basic',
    description: 'Other known titles for this manga'
  },
  description: {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    category: 'basic',
    placeholder: 'Enter manga description or synopsis'
  },
  cover: {
    name: 'cover',
    label: 'Cover Image',
    type: 'text',
    category: 'basic',
    placeholder: 'Cover image URL'
  },
  bannerImage: {
    name: 'bannerImage',
    label: 'Banner Image',
    type: 'text',
    category: 'basic',
    placeholder: 'Banner image URL'
  },
  
  // Publication Info
  status: {
    name: 'status',
    label: 'Status',
    type: 'select',
    category: 'metadata',
    validation: (value) => {
      const valid = ['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED', 'UPCOMING'];
      return value && typeof value === 'string' && !valid.includes(value) ? 'Invalid status' : null;
    }
  },
  format: {
    name: 'format',
    label: 'Format',
    type: 'select',
    category: 'metadata',
    description: 'Publication format (e.g., Manga, Manhwa, Manhua)'
  },
  genres: {
    name: 'genres',
    label: 'Genres',
    type: 'multiselect',
    category: 'metadata'
  },
  tags: {
    name: 'tags',
    label: 'Tags',
    type: 'multiselect',
    category: 'metadata',
    description: 'Content tags and themes'
  },
  volumes: {
    name: 'volumes',
    label: 'Volumes',
    type: 'number',
    category: 'metadata',
    validation: (value) => {
      if (typeof value === 'number') {
        if (value < 0 || value > 10000) {
          return 'Invalid volume count';
        }
        // Check if it looks like a year instead of volume count
        if (value >= 1900 && value <= 2100) {
          return 'This looks like a year, not a volume count';
        }
      }
      return null;
    }
  },
  chapters: {
    name: 'chapters',
    label: 'Chapters',
    type: 'number',
    category: 'metadata',
    validation: (value) => {
      if (typeof value === 'number' && (value < 0 || value > 50000)) {
        return 'Invalid chapter count';
      }
      return null;
    }
  },
  
  // Dates
  startDate: {
    name: 'startDate',
    label: 'Start Date',
    type: 'date',
    category: 'dates',
    transform: (value) => {
      if (!value) return null;
      if (typeof value === 'string') return value;
      if (value instanceof Date) {
        const datePart = value.toISOString().split('T')[0];
        return datePart;
      }
      if (typeof value === 'object' && 'year' in value) {
        const dateObj = value as { year?: unknown; month?: unknown; day?: unknown };
        const year = typeof dateObj.year === 'number' || typeof dateObj.year === 'string' ? dateObj.year : '';
        const month = typeof dateObj.month === 'number' || typeof dateObj.month === 'string' ? dateObj.month : 1;
        const day = typeof dateObj.day === 'number' || typeof dateObj.day === 'string' ? dateObj.day : 1;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      return null;
    }
  },
  endDate: {
    name: 'endDate',
    label: 'End Date',
    type: 'date',
    category: 'dates',
    transform: (value) => {
      if (!value) return null;
      if (typeof value === 'string') return value;
      if (value instanceof Date) {
        const datePart = value.toISOString().split('T')[0];
        return datePart;
      }
      if (typeof value === 'object' && 'year' in value) {
        const dateObj = value as { year?: unknown; month?: unknown; day?: unknown };
        const year = typeof dateObj.year === 'number' || typeof dateObj.year === 'string' ? dateObj.year : '';
        const month = typeof dateObj.month === 'number' || typeof dateObj.month === 'string' ? dateObj.month : 1;
        const day = typeof dateObj.day === 'number' || typeof dateObj.day === 'string' ? dateObj.day : 1;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      return null;
    }
  },
  releaseYear: {
    name: 'releaseYear',
    label: 'Release Year',
    type: 'number',
    category: 'dates',
    validation: (value) => {
      if (typeof value === 'number' && (value < 1900 || value > new Date().getFullYear() + 5)) {
        return 'Invalid release year';
      }
      return null;
    }
  },
  
  // People
  authors: {
    name: 'authors',
    label: 'Authors',
    type: 'multiselect',
    category: 'people',
    description: 'Story authors'
  },
  artists: {
    name: 'artists',
    label: 'Artists',
    type: 'multiselect',
    category: 'people',
    description: 'Manga artists'
  },
  publisher: {
    name: 'publisher',
    label: 'Publisher',
    type: 'select',
    category: 'people'
  },
  
  // IDs
  anilistId: {
    name: 'anilistId',
    label: 'AniList ID',
    type: 'text',
    category: 'ids',
    validation: (value) => {
      if (value && typeof value === 'string' && !/^\d+$/.test(value)) {
        return 'AniList ID must be numeric';
      }
      return null;
    }
  },
  malId: {
    name: 'malId',
    label: 'MyAnimeList ID',
    type: 'text',
    category: 'ids',
    validation: (value) => {
      if (value && typeof value === 'string' && !/^\d+$/.test(value)) {
        return 'MAL ID must be numeric';
      }
      return null;
    }
  },
  comicvineId: {
    name: 'comicvineId',
    label: 'ComicVine ID',
    type: 'text',
    category: 'ids'
  },
  
  // Scores
  averageScore: {
    name: 'averageScore',
    label: 'Average Score',
    type: 'number',
    category: 'scores',
    validation: (value) => {
      if (typeof value === 'number' && (value < 0 || value > 100)) {
        return 'Score must be between 0 and 100';
      }
      return null;
    },
    description: 'Average user rating (0-100)'
  },
  popularity: {
    name: 'popularity',
    label: 'Popularity',
    type: 'number',
    category: 'scores',
    description: 'Popularity ranking or score'
  },

  // Additional publication metadata
  isAdult: {
    name: 'isAdult',
    label: 'Adult Content',
    type: 'select',
    category: 'metadata',
    description: 'Whether the manga contains adult content'
  },
  englishPublisher: {
    name: 'englishPublisher',
    label: 'English Publisher',
    type: 'select',
    category: 'people',
    description: 'English language publisher'
  },
  magazine: {
    name: 'magazine',
    label: 'Magazine',
    type: 'text',
    category: 'metadata',
    description: 'Publication magazine'
  },
  originalRun: {
    name: 'originalRun',
    label: 'Original Run',
    type: 'text',
    category: 'dates',
    description: 'Original publication run dates'
  },

  // Volume-level field sources (for Quick Add presets)
  volumeCover: {
    name: 'volumeCover',
    label: 'Volume Cover Source',
    type: 'select',
    category: 'metadata',
    description: 'Provider source for volume cover images'
  },
  volumeSummary: {
    name: 'volumeSummary',
    label: 'Volume Summary Source',
    type: 'select',
    category: 'metadata',
    description: 'Provider source for volume descriptions'
  },
  volumeTitle: {
    name: 'volumeTitle',
    label: 'Volume Title Source',
    type: 'select',
    category: 'metadata',
    description: 'Provider source for volume titles'
  },

  // Chapter-level field sources (for Quick Add presets)
  chapterCover: {
    name: 'chapterCover',
    label: 'Chapter Cover Source',
    type: 'select',
    category: 'metadata',
    description: 'Provider source for chapter cover images'
  },
  chapterSummary: {
    name: 'chapterSummary',
    label: 'Chapter Summary Source',
    type: 'select',
    category: 'metadata',
    description: 'Provider source for chapter descriptions'
  },
  chapterTitle: {
    name: 'chapterTitle',
    label: 'Chapter Title Source',
    type: 'select',
    category: 'metadata',
    description: 'Provider source for chapter titles'
  }
};

// Helper functions
export function getFieldsByCategory(category: FieldConfig['category']): FieldConfig[] {
  return Object.values(FIELD_CONFIGS).filter(field => field.category === category);
}

export function validateFields(values: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  
  Object.entries(FIELD_CONFIGS).forEach(([key, config]) => {
    const value = values[key];
    
    // Check required fields
    if (config.required && !value) {
      errors[key] = `${config.label} is required`;
      return;
    }
    
    // Run custom validation
    if (config.validation && value !== null) {
      const error = config.validation(value);
      if (error) {
        errors[key] = error;
      }
    }
  });
  
  return errors;
}

export function transformFieldValue(fieldName: string, value: unknown): unknown {
  const config = FIELD_CONFIGS[fieldName];
  if (!config?.transform) {
    return value;
  }
  return config.transform(value);
}

export function getFieldConfig(fieldName: string): FieldConfig | undefined {
  return FIELD_CONFIGS[fieldName];
}

// Field categories for grouping in UI
export const FIELD_CATEGORIES = [
  { key: 'basic', label: 'Basic Information', icon: 'IconBook' },
  { key: 'metadata', label: 'Publication Info', icon: 'IconFileText' },
  { key: 'dates', label: 'Dates', icon: 'IconCalendar' },
  { key: 'people', label: 'People', icon: 'IconUsers' },
  { key: 'ids', label: 'External IDs', icon: 'IconLink' },
  { key: 'scores', label: 'Scores & Rankings', icon: 'IconStar' }
] as const;