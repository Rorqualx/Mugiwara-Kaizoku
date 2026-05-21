/**
 * Fandom Table Parser - Main Entry Point
 *
 * Utilities for parsing volume tables, chapter tables, and extracting data
 * from Fandom wiki pages. Supports adaptive parsing based on HTML structure detection.
 *
 * This file re-exports all functionality from the modular implementation in
 * ./fandom-table-parser/ for backward compatibility.
 *
 * Architecture:
 * - fandom-types.ts - Type definitions (0 functions)
 * - fandom-structure-detector.ts - Structure detection (1 function)
 * - fandom-gallery-parser.ts - Gallery parsing (2 functions)
 * - fandom-navigation-parser.ts - Navigation parsing (2 functions)
 * - fandom-merge-utils.ts - Data merging (2 functions)
 * - fandom-volume-parser.ts - Volume parsing (1 function)
 * - fandom-chapter-parser.ts - Chapter parsing (1 function)
 * - fandom-infobox-parser.ts - Infobox parsing (1 function)
 * - fandom-alternative-parser.ts - Alternative parsing (1 function)
 * - fandom-enhanced-parser.ts - Enhanced parsing (1 function)
 * - fandom-metadata-extractor.ts - Metadata extraction (2 functions)
 *
 * Total: 14 functions across 11 modules
 * Original: 1469 lines → Refactored: ~50 lines (97% reduction)
 */

// Re-export everything from the modular implementation
export * from './fandom-table-parser';
