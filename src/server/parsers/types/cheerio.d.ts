/**
 * Cheerio Type Definitions
 * Provides type aliases for Cheerio types
 */

import type { AnyNode } from 'domhandler';

// Type alias for Element since it's not directly exported from cheerio
export type CheerioElement = AnyNode;

// Re-export commonly used types
export type { CheerioAPI, Cheerio } from 'cheerio';