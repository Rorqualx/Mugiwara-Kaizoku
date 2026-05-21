/**
 * Corpus file mutation helpers for verify-comicvine-corpus.
 *
 * Walks the test-comicvine-corpus.ts source file, locates object literals
 * by their `title:` field, and patches them in place to set
 * `verified: true` and (optionally) replace `comicvineUrl` with a corrected
 * one. Implemented as a textual transform — the corpus has a very regular
 * shape so a balanced-brace walk + regex per-entry is reliable.
 */

import * as fs from 'fs';
import * as path from 'path';

const CORPUS_PATH = path.resolve(process.cwd(), 'scripts/comicvine/test-comicvine-corpus.ts');

export interface CorpusUpdate {
  /** Title field used to find the object literal */
  title: string;
  /** New comicvineUrl to set (or null to leave existing URL untouched) */
  newComicvineUrl: string | null;
}

export interface CorpusUpdateResult {
  updated: number;
  skipped: number;
}

interface ObjectLiteralBounds {
  openBrace: number;
  closeBrace: number;
}

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a regex pattern matching the title literal, allowing apostrophes
 * to optionally be backslash-escaped (since the corpus source uses
 * `'JoJo\'s Bizarre Adventure'` rather than `"JoJo's..."`).
 */
function buildTitleRegex(title: string): RegExp {
  // Escape regex specials, then make every literal apostrophe match either `'` or `\'`
  const escaped = escapeForRegex(title).replace(/'/g, "\\\\?'");
  return new RegExp(`title:\\s*['"\`]${escaped}['"\`]`, 'g');
}

function findObjectLiteralBounds(source: string, title: string): ObjectLiteralBounds | null {
  const titleMarker = buildTitleRegex(title);
  const match = titleMarker.exec(source);
  if (!match) return null;
  let openBrace = match.index;
  while (openBrace > 0 && source[openBrace] !== '{') openBrace--;
  let depth = 0;
  for (let i = openBrace; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return { openBrace, closeBrace: i };
  }
  return null;
}

function insertFieldBeforeClose(literal: string, fieldText: string): string {
  const closeMatch = literal.match(/(\n[ \t]*)\}\s*$/);
  if (!closeMatch) {
    const lastBrace = literal.lastIndexOf('}');
    if (lastBrace < 0) return literal;
    return literal.slice(0, lastBrace) + `  ${fieldText},\n  ` + literal.slice(lastBrace);
  }
  const fieldIndentMatch = literal.match(/\n([ \t]+)\w/);
  const fieldIndent = fieldIndentMatch?.[1] ?? '    ';
  const insertion = `\n${fieldIndent}${fieldText},`;
  const insertionPoint = literal.length - closeMatch[0].length;
  return literal.slice(0, insertionPoint) + insertion + literal.slice(insertionPoint);
}

function patchObjectLiteral(literal: string, newUrl: string | null): string {
  let out = literal;

  // Set or replace comicvineUrl when caller provided a new one
  if (newUrl !== null) {
    const urlRegex = /comicvineUrl:\s*['"`][^'"`]*['"`]/;
    const newUrlField = `comicvineUrl: '${newUrl}'`;
    out = urlRegex.test(out) ? out.replace(urlRegex, newUrlField) : insertFieldBeforeClose(out, newUrlField);
  }

  // Always set verified: true (replace if present, else insert)
  const verifiedRegex = /verified:\s*(true|false)/;
  const newVerifiedField = `verified: true`;
  out = verifiedRegex.test(out)
    ? out.replace(verifiedRegex, newVerifiedField)
    : insertFieldBeforeClose(out, newVerifiedField);

  return out;
}

/**
 * Apply a list of corpus updates to test-comicvine-corpus.ts.
 * Returns counts of successful and skipped updates (entries whose title
 * couldn't be located by the regex walker).
 */
export function applyCorpusUpdates(updates: CorpusUpdate[]): CorpusUpdateResult {
  if (updates.length === 0) return { updated: 0, skipped: 0 };

  let source = fs.readFileSync(CORPUS_PATH, 'utf-8');
  let updated = 0;
  let skipped = 0;

  for (const update of updates) {
    const bounds = findObjectLiteralBounds(source, update.title);
    if (!bounds) {
      process.stdout.write(`  [WARN] Could not locate corpus entry for "${update.title}"\n`);
      skipped++;
      continue;
    }
    const literal = source.slice(bounds.openBrace, bounds.closeBrace + 1);
    const newLiteral = patchObjectLiteral(literal, update.newComicvineUrl);
    source = source.slice(0, bounds.openBrace) + newLiteral + source.slice(bounds.closeBrace + 1);
    updated++;
  }

  fs.writeFileSync(CORPUS_PATH, source);
  return { updated, skipped };
}
