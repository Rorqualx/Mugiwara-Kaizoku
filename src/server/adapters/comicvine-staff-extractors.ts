/**
 * ComicVine Staff Extraction Utilities
 *
 * Modular functions for extracting staff information from ComicVine data
 * Separated to reduce complexity in main adapter
 *
 * @module server/adapters/comicvine-staff-extractors
 */

import type { PersonInfo, StaffInfo } from '@/types/search.types';
import { toStringId } from '@/utils/id-converters';


import type { ComicVinePerson } from './unified-comicvine-adapter';

/**
 * Map ComicVine role to PersonInfo role
 *
 * @param role - The role string from ComicVine
 * @returns The mapped PersonInfo role
 */
export function mapRoleToPersonRole(role: string): PersonInfo['role'] {
  const lowerRole = role.toLowerCase();

  if (lowerRole.includes('artist') || lowerRole.includes('pencil')) {
    return 'ARTIST';
  }
  if (lowerRole.includes('ink')) {
    return 'INKER';
  }
  if (lowerRole.includes('color')) {
    return 'COLORIST';
  }
  if (lowerRole.includes('letter')) {
    return 'LETTERER';
  }
  if (lowerRole.includes('cover')) {
    return 'COVER_ARTIST';
  }
  if (lowerRole.includes('editor')) {
    return 'EDITOR';
  }
  if (lowerRole.includes('translator')) {
    return 'TRANSLATOR';
  }

  return 'WRITER';
}

/**
 * Build PersonInfo from ComicVine credit
 *
 * @param credit - The ComicVine person credit
 * @param mappedRole - The mapped role
 * @returns The PersonInfo object
 */
export function buildPersonInfo(
  credit: ComicVinePerson,
  mappedRole: PersonInfo['role']
): PersonInfo {
  const person: PersonInfo = {
    name: credit.name,
    role: mappedRole,
    id: toStringId(credit.id),
  };

  const imageUrl = credit.image?.medium_url ?? credit.image?.original_url;
  if (imageUrl) {
    person.image = imageUrl;
  }

  return person;
}

/**
 * Determine if role should be categorized as author
 *
 * @param role - The role string from ComicVine
 * @returns Whether it's an author role
 */
export function isAuthorRole(role: string): boolean {
  const lowerRole = role.toLowerCase();
  return (
    lowerRole.includes('writer') ||
    lowerRole.includes('author') ||
    lowerRole.includes('story')
  );
}

/**
 * Determine if role should be categorized as artist
 *
 * @param role - The role string from ComicVine
 * @returns Whether it's an artist role
 */
export function isArtistRole(role: string): boolean {
  const lowerRole = role.toLowerCase();
  return (
    lowerRole.includes('artist') ||
    lowerRole.includes('pencil') ||
    lowerRole.includes('ink') ||
    lowerRole.includes('color')
  );
}

/**
 * Extract staff information from ComicVine credits
 *
 * @param credits - The ComicVine person credits
 * @returns Object containing authors, artists, and staff arrays
 */
export function extractStaffFromCredits(
  credits: ComicVinePerson[]
): {
  authors: PersonInfo[];
  artists: PersonInfo[];
  staff: StaffInfo[];
} {
  const authors: PersonInfo[] = [];
  const artists: PersonInfo[] = [];
  const staff: StaffInfo[] = [];

  for (const credit of credits) {
    const role = credit.role ?? '';
    const mappedRole = mapRoleToPersonRole(role);

    const person = buildPersonInfo(credit, mappedRole);
    const staffMember: StaffInfo = { ...person };

    staff.push(staffMember);

    // Categorize based on role
    if (isAuthorRole(role)) {
      authors.push(person);
    } else if (isArtistRole(role)) {
      artists.push(person);
    }
  }

  return { authors, artists, staff };
}
