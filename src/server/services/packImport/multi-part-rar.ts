/**
 * Multi-Part RAR Detection + Extraction
 *
 * Many manga packs are distributed as RAR archives split across many parts
 * (`X V01.rar`, `X V02.rar`, ..., all identical size except the last). Naive
 * pack import treats each part as a separate volume, producing one bogus
 * volume entry per part and leaving every chapter unreadable. This module
 * detects the split-archive pattern by file-size uniformity and extracts the
 * full archive in one pass via the `unar` CLI (libarchive).
 *
 * iter-16.
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

export interface ScannedRarFile {
  fileName: string;
  filePath: string;
  size: number;
}

export interface MultiPartRarDetection {
  isMultiPart: boolean;
  firstPart: string | null;
  allParts: string[];
  totalBytes: number;
}

const NO_MATCH: MultiPartRarDetection = { isMultiPart: false, firstPart: null, allParts: [], totalBytes: 0 };

/**
 * Detect whether a set of files represents a multi-part split RAR archive.
 *
 * Heuristic: ≥2 .rar files where every file except at most one has the same
 * size (the "body" size). The one outlier must be smaller than the body size
 * — that's the final part. This catches the classic WinRAR split pattern
 * without false-positiving on per-volume packs (which have varying sizes).
 */
export function detectMultiPartRar(files: readonly ScannedRarFile[]): MultiPartRarDetection {
  const rars = files.filter((f) => path.extname(f.fileName).toLowerCase() === '.rar');
  if (rars.length < 2) return NO_MATCH;

  const sizes = rars.map((r) => r.size);
  const largest = Math.max(...sizes);
  const atLargest = rars.filter((r) => r.size === largest);
  const smaller = rars.filter((r) => r.size < largest);

  // Accept two shapes:
  //   (a) N-1 parts at largest + 1 final part strictly smaller (classic split).
  //   (b) All N parts at the exact same size (final part happens to match — rare but legal).
  const classicSplit = atLargest.length >= 2 && smaller.length === 1;
  const allEqual = atLargest.length === rars.length && rars.length >= 3;
  if (!classicSplit && !allEqual) return NO_MATCH;

  const firstPart = pickFirstPart(rars);
  if (firstPart === null) return NO_MATCH;

  const totalBytes = sizes.reduce((s, v) => s + v, 0);
  return {
    isMultiPart: true,
    firstPart: firstPart.filePath,
    allParts: rars.map((r) => r.filePath),
    totalBytes,
  };
}

/** Pick the earliest-numbered part; returns null if numbering can't be parsed. */
function pickFirstPart(rars: readonly ScannedRarFile[]): ScannedRarFile | null {
  const annotated = rars.map((r) => ({ file: r, index: extractSplitIndex(r.fileName) }));
  if (annotated.some((a) => a.index === null)) return null;
  annotated.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return annotated[0]?.file ?? null;
}

function extractSplitIndex(name: string): number | null {
  const base = path.basename(name, path.extname(name));
  // Try patterns in priority order: .part01, V01, trailing digits after "V".
  const partMatch = base.match(/\.part(\d+)$/i);
  if (partMatch?.[1]) return parseInt(partMatch[1], 10);
  const vMatch = base.match(/[Vv](\d+)$/);
  if (vMatch?.[1]) return parseInt(vMatch[1], 10);
  const trailing = base.match(/(\d+)$/);
  if (trailing?.[1]) return parseInt(trailing[1], 10);
  return null;
}

/**
 * Extract a multi-part RAR using `unar`. unar auto-discovers sibling parts
 * in the same directory, so the first part must be located alongside the rest.
 * Returns the list of extracted file paths on success.
 */
export async function extractMultiPartRar(
  firstPart: string,
  outDir: string
): Promise<AsyncResult<string[], Error>> {
  try {
    await fs.mkdir(outDir, { recursive: true });
  } catch (err: unknown) {
    return createErrorResult(err instanceof Error ? err : new Error(String(err)));
  }

  return new Promise((resolve) => {
    // -q quiet, -o output dir, -f force-overwrite, -D no-directory (flatten top-level)
    const proc = spawn('unar', ['-q', '-f', '-o', outDir, firstPart], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stderrChunks: Buffer[] = [];
    proc.stderr.on('data', (c: Buffer) => stderrChunks.push(c));
    proc.on('error', (err) => resolve(createErrorResult(err)));
    proc.on('close', (code) => {
      if (code !== 0) {
        const msg = Buffer.concat(stderrChunks).toString('utf-8') || `unar exited with ${code}`;
        logger.error(`[MultiPartRar] unar extraction failed: ${msg}`);
        resolve(createErrorResult(new Error(msg)));
        return;
      }
      walkDirectory(outDir).then(
        (files) => resolve(createSuccessResult(files)),
        (err: unknown) => resolve(createErrorResult(err instanceof Error ? err : new Error(String(err)))),
      );
    });
  });
}

async function walkDirectory(dir: string): Promise<string[]> {
  const result: string[] = [];
  const walk = async (d: string): Promise<void> => {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        await walk(full); // eslint-disable-line no-await-in-loop
      } else {
        result.push(full);
      }
    }
  };
  await walk(dir);
  return result;
}
