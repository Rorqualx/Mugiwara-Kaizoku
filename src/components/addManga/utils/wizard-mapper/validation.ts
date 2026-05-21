/**
 * Validation Module
 *
 * Contains validation functions for manga input data and field validation.
 *
 * @module components/addManga/utils/wizard-mapper/validation
 */

import type { MangaAddInput } from './types';

/**
 * Validation result structure
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate manga input before submission
 */
export function validateMangaInput(input: MangaAddInput): ValidationResult {
  const errors: string[] = [];

  // Required field validation
  if (!input.title || input.title.trim() === '') {
    errors.push('Title is required');
  }

  if (!input.source || input.source.trim() === '') {
    errors.push('Source is required');
  }

  if (!input.libraryId || input.libraryId <= 0) {
    errors.push('Valid library ID is required');
  }

  if (!input.mangaId || input.mangaId.trim() === '') {
    errors.push('Manga ID is required');
  }

  // Data integrity checks
  if (input.metadata?.volumes && input.metadata.volumes > 10000) {
    errors.push('Volume count seems suspiciously high (might be a year value)');
  }

  if (input.metadata?.chapters && input.metadata.chapters > 100000) {
    errors.push('Chapter count seems suspiciously high');
  }

  if (input.metadata?.volumes && input.metadata.chapters) {
    if (input.metadata.chapters < input.metadata.volumes) {
      errors.push('Chapter count cannot be less than volume count');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate required fields for wizard form data
 */
export function validateRequiredFields(formData: Partial<{
  title: string;
  selectedSourceId?: string;
  searchProvider?: string;
}>): ValidationResult {
  const errors: string[] = [];

  if (!formData.title) {
    errors.push('Title is required for manga import');
  }

  if (!formData.selectedSourceId && !formData.searchProvider) {
    errors.push('Source ID is required for manga import');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}