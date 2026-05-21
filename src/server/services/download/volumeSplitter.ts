/**
 * Volume Splitter Service
 *
 * Intelligently splits volume archives into individual chapter files using heuristic detection.
 * Analyzes image filenames, sequential patterns, and page organization to identify chapter boundaries.
 *
 * Detection Strategies:
 * 1. Filename patterns (e.g., "Chapter 01 - Page 01.jpg", "c001p001.png")
 * 2. Sequential numbering gaps indicating new chapters
 * 3. Title/cover page detection
 * 4. Consistent page count analysis
 *
 * @module server/services/download/volumeSplitter
 */

// Re-export from modular volume-splitter package
export * from './volume-splitter';

// Export singleton for backward compatibility
import { prisma } from '@/server/db';

import { VolumeSplitter } from './volume-splitter';

let volumeSplitterInstance: VolumeSplitter | null = null;

export function getVolumeSplitter(): VolumeSplitter {
  volumeSplitterInstance ??= new VolumeSplitter(prisma);
  return volumeSplitterInstance;
}
