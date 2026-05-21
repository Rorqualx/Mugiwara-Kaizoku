import { atom } from 'jotai';

// Atom to control the provider search modal open state
export const providerSearchModalOpenAtom = atom(false);

// Atom to store the manga ID for provider search
export const providerSearchMangaIdAtom = atom<number | null>(null);