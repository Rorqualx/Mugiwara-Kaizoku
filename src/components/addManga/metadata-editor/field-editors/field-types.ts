/**
 * Field type classifications
 */

export const TEXT_FIELDS = ['title', 'publisher', 'country'] as const;
export const IMAGE_FIELDS = ['cover', 'banner', 'volumeCovers', 'chapterArt'] as const;
export const ARRAY_FIELDS = ['genres', 'tags', 'alternativeTitles'] as const;
export const NUMBER_FIELDS = ['volumes', 'chapters'] as const;
export const DATE_FIELDS = ['startDate', 'endDate'] as const;
export const JSON_FIELDS = ['authors', 'staff'] as const;

export function isTextField(field: string): boolean {
  return TEXT_FIELDS.includes(field as typeof TEXT_FIELDS[number]);
}

export function isImageField(field: string): boolean {
  return IMAGE_FIELDS.includes(field as typeof IMAGE_FIELDS[number]);
}

export function isArrayField(field: string): boolean {
  return ARRAY_FIELDS.includes(field as typeof ARRAY_FIELDS[number]);
}

export function isNumberField(field: string): boolean {
  return NUMBER_FIELDS.includes(field as typeof NUMBER_FIELDS[number]);
}

export function isDateField(field: string): boolean {
  return DATE_FIELDS.includes(field as typeof DATE_FIELDS[number]);
}

export function isJsonField(field: string): boolean {
  return JSON_FIELDS.includes(field as typeof JSON_FIELDS[number]);
}
