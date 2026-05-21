/**
 * Komga Library Transformer
 *
 * Transforms raw Komga library data to API response format
 */

interface RawKomgaLibrary {
  id: string;
  name: string;
  root: string;
  type: string;
  unavailableDate?: string | undefined;
}

export interface TransformedKomgaLibrary {
  id: string;
  name: string;
  root: string;
  type: string;
  // With exactOptionalPropertyTypes, we must not set property to undefined
  unavailableDate?: string;
  isSelected: boolean;
  [key: string]: unknown;
}

/**
 * Transform raw library data with selection state
 */
export function transformLibrary(
  library: RawKomgaLibrary,
  selectedLibraries: string[]
): TransformedKomgaLibrary {
  const base: TransformedKomgaLibrary = {
    id: library.id,
    name: library.name,
    root: library.root,
    type: library.type,
    isSelected: selectedLibraries.includes(library.id)
  };

  // Only include unavailableDate if it exists (exactOptionalPropertyTypes: true)
  if (library.unavailableDate !== undefined) {
    base.unavailableDate = library.unavailableDate;
  }

  return base;
}

/**
 * Transform array of libraries
 */
export function transformLibraries(
  libraries: RawKomgaLibrary[],
  selectedLibraries: string[]
): TransformedKomgaLibrary[] {
  return libraries.map(lib => transformLibrary(lib, selectedLibraries));
}
