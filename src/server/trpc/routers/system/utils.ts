/**
 * System Router Utilities
 *
 * Shared helper functions and utilities used across all system router modules.
 * Provides type guards, version parsing, and configuration extraction utilities.
 *
 * Extracted from: system.ts (lines 1-185)
 *
 * @module system/utils
 */

import * as fs from 'fs';
import * as path from 'path';

import { logger } from '@/utils/logging';
import { isObject, hasProperty, isString } from '@/utils/type-guards';


// ============================================================================
// Type Definitions
// ============================================================================

/**
 * A grouped block of changes under a `### Heading` in CHANGELOG.md.
 */
export interface ChangelogSection {
  heading: string;
  items: string[];
}

/**
 * Represents a parsed version entry from the CHANGELOG.md file
 */
export interface VersionEntry {
  version: string;
  date: string | null;
  sections: ChangelogSection[];
  status: 'unknown' | 'installed' | 'available' | 'previous';
}

/**
 * Compares two semver-like strings numerically.
 * Returns positive if a > b, negative if a < b, 0 if equal.
 * Falls back to string compare if either side is non-numeric.
 */
export function compareSemver(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (Number.isNaN(numA) || Number.isNaN(numB)) {
      return a.localeCompare(b);
    }
    if (numA !== numB) return numA - numB;
  }
  return 0;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Type guard to check if an object has a specific method
 *
 * @param obj - The object to check
 * @param methodName - The name of the method to look for
 * @returns True if the object has the specified method
 */
export function hasMethod(obj: unknown, methodName: string): obj is Record<string, unknown> {
  return isObject(obj) && hasProperty(obj, methodName) && typeof obj[methodName] === 'function';
}

/**
 * Safely extracts a provider configuration value from a providers object
 *
 * Navigates through a nested providers object structure to extract a specific
 * configuration value for a given provider and key.
 *
 * @param providers - The providers configuration object
 * @param providerId - The ID of the provider to look up
 * @param key - The configuration key to extract
 * @returns The configuration value, or undefined if not found
 *
 * @example
 * ```typescript
 * const apiKey = getProviderValue(providers, 'mangadex', 'apiKey');
 * ```
 */
export function getProviderValue(providers: unknown, providerId: string, key: string): unknown {
  if (!isObject(providers) || !hasProperty(providers, providerId)) {
    return undefined;
  }

  const provider = providers[providerId];
  if (!isObject(provider) || !hasProperty(provider, key)) {
    return undefined;
  }

  return provider[key];
}

/**
 * Reads version from package.json. Returns '0.0.0' if the file is missing or malformed.
 */
export function getPackageVersion(): string {
  try {
    const packageJson: unknown = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')
    );
    if (isObject(packageJson) && hasProperty(packageJson, 'version') && isString(packageJson['version'])) {
      return packageJson['version'];
    }
    return '0.0.0';
  } catch (error: unknown) {
    logger.error(`Failed to get package version: ${error instanceof Error ? error.message : String(error)}`);
    return '0.0.0';
  }
}

const BULLET_RE = /^[-*]\s+/;

function parseBulletItems(block: string): string[] {
  return block
    .split('\n')
    .filter((line) => BULLET_RE.test(line.trim()))
    .map((line) => line.trim().replace(BULLET_RE, '').replace(/\s+\(\[.*$/, '').trim())
    .filter((s): s is string => s.length > 0);
}

function extractSectionsFromContent(content: string): ChangelogSection[] {
  const sections: ChangelogSection[] = [];
  // Capture the full heading line (e.g. "Major Features - Unified Metadata System").
  const parts = content.split(/### ([^\n]+)/);

  for (let j = 1; j < parts.length; j += 2) {
    const heading = parts[j]?.trim();
    const body = parts[j + 1];
    if (!heading || !body) continue;
    const items = parseBulletItems(body);
    if (items.length > 0) sections.push({ heading, items });
  }

  // Fallback: no `###` subheadings, treat the whole block as one unnamed section.
  if (sections.length === 0) {
    const items = parseBulletItems(content);
    if (items.length > 0) sections.push({ heading: 'Changes', items });
  }

  return sections;
}

/**
 * Parses CHANGELOG.md into version entries. Skips `## [Unreleased]` (digit-only matcher).
 */
export function parseChangelog(): VersionEntry[] {
  try {
    const changelog = fs.readFileSync(path.resolve(process.cwd(), 'CHANGELOG.md'), 'utf8');
    const versions: VersionEntry[] = [];
    const versionBlocks = changelog.split(/## \[([\d.]+)\]/);

    for (let i = 1; i < versionBlocks.length; i += 2) {
      const version = versionBlocks[i];
      const content = versionBlocks[i + 1];
      if (!version || !content) continue;

      const dateMatch = content.match(/(\d{4}-\d{2}-\d{2})/);
      versions.push({
        version,
        date: dateMatch?.[1] ?? null,
        sections: extractSectionsFromContent(content),
        status: 'unknown',
      });
    }

    return versions;
  } catch (error: unknown) {
    logger.error(`Failed to parse changelog: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}
