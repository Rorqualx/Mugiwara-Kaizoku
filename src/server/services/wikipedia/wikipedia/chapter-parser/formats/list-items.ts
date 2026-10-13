/**
 * Top-level `<li>` items of an ordered chapter list.
 *
 * Each item of an `<ol start="N">` is one chapter: the browser numbers it N,
 * N+1, ... by position. The chapter number therefore comes from the item's
 * position, never from how many titles a pattern happened to recognise.
 */

export interface ListItem {
  /** The item's opening tag, e.g. `<li value="12">`. */
  openTag: string;
  /** The item's HTML between its opening and closing tag (nested lists included). */
  inner: string;
}

const LI_TAG = /<(\/?)li\b[^>]*>/gi;
const NESTED_LIST = /<(ul|ol)\b[\s\S]*?<\/\1>/gi;
const ANY_TAG = /<[^>]*>/g;
/** A title in straight (U+0022) or curly (U+201C/U+201D) double quotes. */
const QUOTED_TITLE = /["“”]([^"“”]+)["“”]/;

/** Split list content into its top-level items; items of nested lists stay inside their parent. */
export function topLevelListItems(listContent: string): ListItem[] {
  const items: ListItem[] = [];
  let depth = 0;
  let open: { tag: string; start: number } | null = null;
  for (const m of listContent.matchAll(LI_TAG)) {
    const index = m.index;
    if (m[1] !== '/') {
      if (depth === 0) open = { tag: m[0], start: index + m[0].length };
      depth++;
      continue;
    }
    if (depth === 0) continue;
    depth--;
    if (depth === 0 && open) {
      items.push({ openTag: open.tag, inner: listContent.slice(open.start, index) });
      open = null;
    }
  }
  if (open) items.push({ openTag: open.tag, inner: listContent.slice(open.start) });
  return items;
}

/**
 * An item that opens with a quote the page never closes, the title running up
 * to the romanisation in parentheses: Demon Slayer's
 * `"Barehanded Fight (素手喧嘩, Sutegoro)`.
 */
const UNCLOSED_LEADING_TITLE = /^\s*[\u0022\u201C\u201D]([^\u0022\u201C\u201D(]+?)\s*\(/;

/**
 * The first quoted title in an item's visible text, nested lists excluded.
 * Tags are removed first, so a title with inline markup inside it
 * (`"Let's Just Call Her 'Acro-Silky<span>'</span>"`) is still read whole.
 */
export function quotedItemTitle(inner: string): string | null {
  const text = inner.replace(NESTED_LIST, '').replace(ANY_TAG, '');
  const title = QUOTED_TITLE.exec(text)?.[1] ?? UNCLOSED_LEADING_TITLE.exec(text)?.[1];
  return title !== undefined && title.length > 1 ? title : null;
}

/** The `value="N"` of an item's opening tag, which renumbers it and the items after it. */
export function itemValue(openTag: string): number | null {
  const value = /\svalue="(\d+)"/i.exec(openTag)?.[1];
  return value === undefined ? null : parseInt(value, 10);
}
