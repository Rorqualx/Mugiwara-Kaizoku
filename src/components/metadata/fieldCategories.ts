/**
 * Shared metadata field categories configuration
 * Used across metadata editing components
 */

/**
 * Field category structure for provider selection forms
 */
export interface FieldCategory {
  field: string;
  display: string;
}

/**
 * Categorized metadata fields for provider selection UI
 * Used in ProviderSelectionForm
 */
export const providerFieldCategories: Record<string, FieldCategory[]> = {
  "Basic Information": [
    { field: "title", display: "Title" },
    { field: "summary", display: "Summary" },
    { field: "status", display: "Status" },
    { field: "synonyms", display: "Alternate Titles" },
  ],
  "Publication Details": [
    { field: "volumes", display: "Volumes" },
    { field: "chapters", display: "Chapters" },
    { field: "startDate", display: "Start Date" },
    { field: "endDate", display: "End Date" },
    { field: "authors", display: "Authors" },
  ],
  "Classification": [
    { field: "genres", display: "Genres" },
    { field: "tags", display: "Tags" },
    { field: "characters", display: "Characters" },
  ],
  "Visual Assets": [
    { field: "cover", display: "Cover Image" },
    { field: "coverLarge", display: "Large Cover" },
    { field: "coverMedium", display: "Medium Cover" },
    { field: "coverSmall", display: "Small Cover" },
  ],
};

/**
 * Simplified field categories for metadata editor
 * Used in MetadataEditor component
 */
export const editorFieldCategories = {
  basic: ['title', 'alternativeTitles', 'description', 'status', 'format'],
  media: ['cover', 'banner', 'volumeCovers', 'chapterArt'],
  volumes: ['volumes', 'chapters', 'volumeData', 'chapterData'],
  metadata: ['genres', 'tags', 'authors', 'staff', 'publisher'],
  dates: ['startDate', 'endDate', 'releaseYear'],
  ids: ['anilistId', 'malId', 'comicVineId'],
  additional: ['country', 'isAdult', 'averageScore', 'popularity']
};

/**
 * Get display name for a field
 */
export function getFieldDisplayName(field: string): string {
  // Check provider field categories first
  for (const category of Object.values(providerFieldCategories)) {
    const found = category.find(f => f.field === field);
    if (found) return found.display;
  }
  
  // Fallback to converting field name to title case
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Get category for a field
 */
export function getFieldCategory(field: string): string | null {
  // Check provider categories
  for (const [category, fields] of Object.entries(providerFieldCategories)) {
    if (fields.some(f => f.field === field)) {
      return category;
    }
  }
  
  // Check editor categories
  for (const [category, fields] of Object.entries(editorFieldCategories)) {
    if (fields.includes(field)) {
      return category;
    }
  }
  
  return null;
}

/**
 * Field importance levels for UI prioritization
 */
export const fieldImportance: Record<string, number> = {
  title: 10,
  alternativeTitles: 9,
  description: 8,
  status: 8,
  cover: 9,
  genres: 7,
  tags: 6,
  authors: 7,
  volumes: 6,
  chapters: 6,
  startDate: 5,
  endDate: 5,
  // External IDs
  anilistId: 4,
  malId: 4,
  comicVineId: 4,
  // Additional fields
  publisher: 5,
  country: 3,
  isAdult: 3,
  averageScore: 3,
  popularity: 3,
  // Lower priority
  coverLarge: 2,
  coverMedium: 2,
  coverSmall: 2,
  banner: 2,
  volumeCovers: 2,
  chapterArt: 2,
};

/**
 * Get fields sorted by importance
 */
export function getFieldsByImportance(fields: string[]): string[] {
  return fields.sort((a, b) => {
    const aImportance = fieldImportance[a] ?? 0;
    const bImportance = fieldImportance[b] ?? 0;
    return bImportance - aImportance;
  });
}