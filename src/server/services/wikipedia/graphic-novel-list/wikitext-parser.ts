/**
 * Wikitext reader for Wikipedia's `{{Graphic novel list}}` volume tables.
 *
 * Almost every manga article or "List of X chapters" page lists its volumes
 * with this template, one call per volume, each naming its chapters in
 * `ChapterList` (or `ChapterListCol1` / `ChapterListCol2`). Read from the
 * wikitext, a volume's chapters are exactly what the editors wrote under it.
 * The rendered HTML is much harder: the volume row and its chapter row are
 * separate `<tr>`s, two-column lists nest a table, and a page holding several
 * series (Battle Angel Alita, Last Order, Mars Chronicle…) restarts its volume
 * numbers in every section.
 *
 * Pure: no network, no logging. Literal braces in patterns are written as
 * \x7B / \x7D.
 *
 * @module services/wikipedia/graphic-novel-list/wikitext-parser
 */

export interface GraphicNovelChapter {
  number: number;
  title?: string;
}

export interface GraphicNovelVolume {
  number: number;
  chapters: GraphicNovelChapter[];
  /** Listed entries without a chapter number ("Final Fight", "Epilogue", bonus stories). */
  unnumbered: string[];
  /** How many of `unnumbered` come after the last numbered chapter, in list order. */
  trailingUnnumbered?: number;
  title?: string;
  releaseDate?: string;
  isbn?: string;
  licensedReleaseDate?: string;
  licensedIsbn?: string;
  summary?: string;
}

export interface GraphicNovelTable {
  /** Headings enclosing the table, outermost first, as plain text. */
  headings: string[];
  volumes: GraphicNovelVolume[];
}

const OPEN = '\x7B\x7B';
const CLOSE = '\x7D\x7D';
const HEADING_RE = /^(={2,6})\s*(.+?)\s*\1\s*$/gm;
const TABLE_HEADER_RE = /\x7B\x7B\s*Graphic novel list\/header/gi;
const VOLUME_TEMPLATE_RE = /\x7B\x7B\s*Graphic novel list\s*(?=\||\n)/gi;
const NUMBERED_LIST_RE = /\x7B\x7B\s*(?:numbered|ordered) list\s*\|/i;
const INLINE_TEMPLATE_RE = /\x7B\x7B\s*(?:nihongo|nihongo2|lang|transl|small|nowrap)\s*\|([^|\x7D]*)[^\x7D]*\x7D\x7D/gi;
const CHAPTER_FIELD_RE = /^ChapterList(?:Col\d+)?$/i;
/** A list line that opens with its chapter number, optionally after one label word ("Fight 1", "Log:001", "01."). */
const NUMBERED_LINE_RE = new RegExp('^(?:[A-Za-z][A-Za-z.]\x7B0,11\x7D\\s*[:#]?\\s*)?0*(\\d\x7B1,4\x7D(?:\\.\\d+)?)(?![\\d/A-Za-z])');

/** Remove references and comments, which may hold `|`, braces or `=`. */
function stripNoise(wikitext: string): string {
  return wikitext
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref\b[^>]*\/>/gi, '')
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '');
}

/** +1 at an opening template / link, -1 at a closing one, else 0. */
function pairDelta(text: string, i: number, withLinks: boolean): number {
  const pair = text.slice(i, i + 2);
  if (pair === OPEN || (withLinks && pair === '[[')) return 1;
  if (pair === CLOSE || (withLinks && pair === ']]')) return -1;
  return 0;
}

/** Index just past the braces closing the template that opens at `start`, or -1. */
function templateEnd(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    const delta = pairDelta(text, i, false);
    if (delta === 0) continue;
    depth += delta;
    i++;
    if (depth === 0) return i + 1;
  }
  return -1;
}

/** Split a template body on `|` outside nested templates and links. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < body.length; i++) {
    const delta = pairDelta(body, i, true);
    if (delta !== 0) {
      depth = Math.max(0, depth + delta);
      i++;
    } else if (body[i] === '|' && depth === 0) {
      parts.push(body.slice(from, i));
      from = i + 1;
    }
  }
  parts.push(body.slice(from));
  return parts;
}

/** Named parameters of a template call (`Name|a=1|b=2` → {a: '1', b: '2'}). */
function templateParams(call: string): Map<string, string> {
  const params = new Map<string, string>();
  for (const part of splitTopLevel(call.slice(2, -2)).slice(1)) {
    const eq = part.indexOf('=');
    if (eq > 0) params.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
  }
  return params;
}

/** Plain text of a wikitext fragment: link labels kept, common templates reduced to their first argument. */
export function plainText(fragment: string): string {
  return fragment
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(INLINE_TEMPLATE_RE, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A chapter title: the first quoted phrase, else the text after the number. */
function chapterTitle(text: string, afterNumber: string): string | undefined {
  const quoted = /"([^"]+)"/.exec(text)?.[1]?.trim();
  if (quoted) return quoted;
  const rest = plainText(afterNumber).replace(/^[\s.:)\-–—]+/, '').trim();
  return rest.length > 0 ? rest : undefined;
}

function chapter(number: number, title: string | undefined): GraphicNovelChapter {
  return title ? { number, title } : { number };
}

/** Chapters of one Numbered list call (`start=N|item|item…`). */
function numberedListCall(call: string): GraphicNovelChapter[] {
  const args = splitTopLevel(call.slice(2, -2)).slice(1);
  const startArg = args.find(a => /^\s*start\s*=/.test(a));
  let next = startArg ? parseInt(startArg.split('=')[1] ?? '1', 10) : 1;
  const out: GraphicNovelChapter[] = [];
  for (const arg of args) {
    const text = arg.trim();
    if (text.length === 0 || /^[a-z_-]+\s*=/i.test(text)) continue;
    out.push(chapter(next, chapterTitle(text, text)));
    next++;
  }
  return out;
}

/** Pull Numbered list / Ordered list calls out of a field; returns the remaining text. */
function takeNumberedLists(value: string, out: GraphicNovelChapter[]): string {
  let rest = value;
  for (let match = NUMBERED_LIST_RE.exec(rest); match !== null; match = NUMBERED_LIST_RE.exec(rest)) {
    const end = templateEnd(rest, match.index);
    if (end < 0) break;
    out.push(...numberedListCall(rest.slice(match.index, end)));
    rest = rest.slice(0, match.index) + rest.slice(end);
  }
  return rest;
}

/** One top-level `*` / `#` line: a numbered chapter, an unnumbered entry, or null. */
function parseListLine(raw: string): GraphicNovelChapter | string | null {
  const text = /^\s*[*#](?![*#:])\s*(.*)$/.exec(raw)?.[1];
  if (!text) return null;
  const flat = plainText(text);
  const numbered = NUMBERED_LINE_RE.exec(flat);
  if (numbered?.[1]) return chapter(parseFloat(numbered[1]), chapterTitle(text, flat.slice(numbered[0].length)));
  return flat.length > 0 ? flat : null;
}

function firstParam(params: Map<string, string>, names: string[]): string | undefined {
  for (const name of names) {
    const value = plainText(params.get(name) ?? '');
    if (value.length > 0) return value;
  }
  return undefined;
}

function parseVolume(call: string): GraphicNovelVolume | null {
  const params = templateParams(call);
  const number = parseInt(params.get('VolumeNumber') ?? '', 10);
  if (!Number.isInteger(number) || number <= 0) return null;
  const volume: GraphicNovelVolume = { number, chapters: [], unnumbered: [], trailingUnnumbered: 0 };
  for (const [name, value] of params) {
    if (!CHAPTER_FIELD_RE.test(name)) continue;
    const rest = takeNumberedLists(value, volume.chapters);
    if (rest.length < value.length) volume.trailingUnnumbered = 0;
    for (const entry of rest.split('\n').map(parseListLine)) {
      if (typeof entry === 'string') {
        volume.unnumbered.push(entry);
        volume.trailingUnnumbered = (volume.trailingUnnumbered ?? 0) + 1;
      } else if (entry !== null) {
        volume.chapters.push(entry);
        volume.trailingUnnumbered = 0;
      }
    }
  }
  const title = firstParam(params, ['Title', 'TranslitTitle', 'OriginalTitle']);
  const releaseDate = firstParam(params, ['OriginalRelDate', 'RelDate']);
  const isbn = firstParam(params, ['OriginalISBN', 'ISBN']);
  const licensedReleaseDate = firstParam(params, ['LicensedRelDate']);
  const licensedIsbn = firstParam(params, ['LicensedISBN']);
  const summary = firstParam(params, ['Summary']);
  if (title !== undefined) volume.title = title;
  if (releaseDate !== undefined) volume.releaseDate = releaseDate;
  if (isbn !== undefined) volume.isbn = isbn;
  if (licensedReleaseDate !== undefined) volume.licensedReleaseDate = licensedReleaseDate;
  if (licensedIsbn !== undefined) volume.licensedIsbn = licensedIsbn;
  if (summary !== undefined) volume.summary = summary;
  return volume;
}

/** Headings in force at `offset`: the last heading of each level above it. */
function headingPath(headings: Array<{ level: number; text: string; index: number }>, offset: number): string[] {
  const stack: Array<{ level: number; text: string }> = [];
  for (const h of headings.filter(x => x.index < offset)) {
    while ((stack[stack.length - 1]?.level ?? 0) >= h.level) stack.pop();
    stack.push({ level: h.level, text: h.text });
  }
  return stack.map(h => h.text);
}

/**
 * Every Graphic novel list table on the page, in page order. A table starts
 * at a `Graphic novel list/header` call, or at a heading when a page omits it.
 */
export function parseGraphicNovelTables(wikitext: string): GraphicNovelTable[] {
  const text = stripNoise(wikitext);
  const headings = [...text.matchAll(HEADING_RE)].map(m => ({
    level: (m[1] ?? '').length, text: plainText(m[2] ?? ''), index: m.index,
  }));
  const tableStarts = [...text.matchAll(TABLE_HEADER_RE)].map(m => m.index);
  const tables: GraphicNovelTable[] = [];
  let currentKey: string | null = null;
  for (const match of text.matchAll(VOLUME_TEMPLATE_RE)) {
    const end = templateEnd(text, match.index);
    const volume = end < 0 ? null : parseVolume(text.slice(match.index, end));
    if (!volume) continue;
    const path = headingPath(headings, match.index);
    const tableStart = tableStarts.filter(s => s < match.index).pop() ?? -1;
    const key = `${tableStart}|${path.join('/')}`;
    if (key !== currentKey) {
      tables.push({ headings: path, volumes: [] });
      currentKey = key;
    }
    tables[tables.length - 1]?.volumes.push(volume);
  }
  return tables;
}
