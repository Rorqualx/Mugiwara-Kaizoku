/**
 * Wizard to Manga Input Mapper - Re-export shim
 *
 * Split into subdirectory for file size compliance.
 * See ./wizardToMangaInputMapper/ for implementation.
 */

import { mapWizardDataToMangaInput } from './wizardToMangaInputMapper/mapper';
import { validateMangaInput } from './wizardToMangaInputMapper/types';

export { mapWizardDataToMangaInput, validateMangaInput };
export type { MangaAddInput } from './wizardToMangaInputMapper/types';
