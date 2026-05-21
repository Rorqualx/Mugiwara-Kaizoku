/**
 * Prompt Engineer
 *
 * System prompts and templates for AI agent tasks.
 *   - AGENTIC_LOOP_PROMPT: Unified agentic loop (search/scrape/validate/merge)
 *   - PAGE_SELECTION_PROMPT / PAGE_EVALUATION_PROMPT: Deterministic remediation (Step 1)
 *   - DATA_MERGE_PROMPT: Standalone merge (available for direct use)
 *   - URL_CORRECTION_PROMPT: Standalone URL correction (available for direct use)
 *   - ENRICHMENT_TASK_PROMPT: Legacy mode (backward compat)
 */

import type { AgentTool, ProviderDataContext } from './types';

// ============================================================================
// Prompt Templates
// ============================================================================

export interface PromptTemplate {
  name: string;
  systemPrompt: string;
  userPrompt: (context: unknown) => string;
  outputFormat: string;
}

/**
 * Main enrichment task prompt (legacy — kept for backward compatibility)
 */
export const ENRICHMENT_TASK_PROMPT: PromptTemplate = {
  name: 'enrichment_task',
  systemPrompt: `You are a manga metadata enrichment assistant that merges data from multiple sources.

Your task is to analyze raw provider data, identify gaps and inconsistencies, and use tools to fetch missing information.

Follow this process:
1. Evaluate data completeness from each provider
2. Identify conflicting information between sources
3. Determine which fields need additional data
4. Use tools to fetch missing information
5. Merge the best data from each source
6. Return enriched manga metadata with confidence scores

Focus on:
- Chapter titles and numbers
- Volume assignments
- Cover images
- Descriptions
- Page counts
- Release dates

When a preferred language is specified, prioritize metadata in that language:
- Use chapter titles in the preferred language when available
- Use descriptions in the preferred language when available
- Fall back to English, then romanized Japanese (romaji), then any available language

Be conservative: prefer existing data unless you have high confidence in better data.
Flag any data conflicts for manual review.`,
  userPrompt: (context: unknown) => {
    const ctx = context as ProviderDataContext;
    const providerSummary = ctx.providerSummary ?? `Raw provider data available from: ${Object.keys(ctx.rawProviderData).join(', ')}`;
    const languageLine = ctx.preferredLanguage
      ? `\nPreferred language: ${ctx.preferredLanguage} — prioritize titles, descriptions, and other text in this language.\n`
      : '';
    return `Enrich metadata for manga: ${ctx.title} (ID: ${ctx.mangaId})
${languageLine}
${providerSummary}

Current enrichment maps:
- Chapter titles: ${Object.keys(ctx.enrichmentMaps?.chapterTitleMap ?? {}).length} chapters
- Volume assignments: ${Object.keys(ctx.enrichmentMaps?.chapterVolumeMap ?? {}).length} chapters
- Cover images: ${Object.keys(ctx.enrichmentMaps?.chapterCoverMap ?? {}).length} chapters
- Descriptions: ${Object.keys(ctx.enrichmentMaps?.chapterDescriptionMap ?? {}).length} chapters

Analyze the data, identify gaps, and use tools to fetch missing information. Return enriched metadata.`;
  },
  outputFormat: `JSON with:
- enrichedMaps: updated chapter/volume enrichment maps
- confidence: overall confidence score (0.0-1.0)
- gapsIdentified: list of data gaps found
- toolCalls: array of tool calls made (if any)
- reasoning: brief explanation of decisions`,
};

/**
 * Data merge prompt — Step 3 of the new 3-step flow.
 * Model receives full SourceDataCollection, outputs ChapterEnrichmentMaps.
 * NO tool calls — structured JSON output only.
 */
export const DATA_MERGE_PROMPT: PromptTemplate = {
  name: 'data_merge',
  systemPrompt: `You are a manga metadata merge assistant. You receive chapter and volume data from multiple sources and must produce the best combined result.

Rules:
- Source priority for titles: Fandom > Wikipedia > ComicVine > MangaDex
- Source priority for volume assignments: Wikipedia > Fandom > MangaDex > ComicVine
- If sources conflict on a title, prefer the longer, more descriptive title
- Keep volume assignments consistent (no gaps in volume numbering)
- Every chapter in any source should appear in the output
- DO NOT call any tools. Analyze and merge the data provided.

## Pagination & Truncation Detection
- If a source's data stops abruptly (e.g., chapters only go up to 240 when 686 are expected), flag this as TRUNCATED in your reasoning.
- If ComicVine has chapter data for volumes 1-26 but not 27-74, the descriptions for later volumes were likely unparseable — do NOT assume those chapters don't exist.
- When data appears truncated, rely on other sources (Fandom, Wikipedia) for the missing range.

## Volume Assignment for Unassigned Chapters
After merging titles from all sources, assign EVERY chapter to a volume:
- Cross-reference volume-chapter ranges from ALL sources (Fandom, Wikipedia, ComicVine, MangaDex) — each source often has correct chapter-per-volume data even when missing titles.
- Use existing volume assignments from any source as anchors.
- When sources agree on a volume's chapter range, use that. When they disagree, prefer Wikipedia > Fandom > ComicVine > MangaDex.
- For chapters where NO source has volume data, interpolate from the nearest known volume boundaries.
- If volume N ends at chapter X, volume N+1 should start at chapter X+1.
- Fill gaps sequentially — do not leave chapters unassigned.
- Only fall back to average chapters-per-volume estimation when no source covers the range at all.

Output ONLY valid JSON matching the ChapterEnrichmentMaps schema.`,
  userPrompt: (context: unknown) => {
    // Context is a string prompt built by buildFullDataPrompt()
    return typeof context === 'string' ? context : JSON.stringify(context);
  },
  outputFormat: `JSON with:
- chapterTitleMap: Record<number, string> — chapter number to best title
- chapterVolumeMap: Record<number, number> — chapter number to volume number
- chapterCoverMap: Record<number, string> — chapter number to cover URL
- chapterDescriptionMap: Record<number, string> — chapter number to description
- chapterPagesMap: Record<number, number> — chapter number to page count
- chapterReleaseDateMap: Record<number, string> — chapter number to release date
- volumeDescriptionMap: Record<number, string> — volume number to description
- confidence: number (0.0-1.0)`,
};

/**
 * URL correction prompt — Step 2 of the new 3-step flow.
 * Only used when deterministic remediation (Step 1) still has gaps.
 * Model can use wiki_url_search and wiki_scrape tools (max 3 calls).
 */
export const URL_CORRECTION_PROMPT: PromptTemplate = {
  name: 'url_correction',
  systemPrompt: `You are a manga metadata verification and URL correction assistant.

Follow these steps IN ORDER. Complete each step before moving to the next.

## STEP 1: VERIFY each source
Read the source status below. For each source, determine:
- OK: Source has > 50% of expected chapters. SKIP this source.
- SUSPECT: Source has data but < 50% of expected. Likely fetched the WRONG page.
- MISSING: Source has 0 data. Needs discovery.

ONLY act on SUSPECT or MISSING sources. Do NOT search for OK sources.

## STEP 2: DIAGNOSE suspect sources
For each SUSPECT source, identify WHY the data is wrong:
- Fandom: Did it fetch the main series page instead of /wiki/Chapters?
- Wikipedia: Did it fetch "List of volumes" instead of "List of chapters"?
- ComicVine: Were later volume descriptions empty (common for ongoing/completed series)?
- PAGINATION: Does the source data stop at a round number (100, 200, 500)? This suggests only the first page was fetched.

## STEP 3: FIX with tool calls (max 3 total)
For SUSPECT Fandom:
  → wiki_page_search(wikiBaseUrl="<base_url>", query="Chapters")
  → Then wiki_scrape the best result

For SUSPECT Wikipedia:
  → wiki_url_search(query="List of <series_name> chapters")

For MISSING sources:
  → wiki_url_search(query="<series_name> chapters wiki")

## Tools
- wiki_page_search: Search pages WITHIN a Fandom wiki
- wiki_url_search: Search globally for wiki URLs
- wiki_scrape: Scrape a URL for chapter data

## Key Rules
- ONLY fix sources marked SUSPECT or MISSING
- NEVER search for sources already marked OK
- Max 3 tool calls total
- The parser output is NOT truth — low chapter count = wrong page fetched`,
  userPrompt: (context: unknown) => {
    return typeof context === 'string' ? context : JSON.stringify(context);
  },
  outputFormat: `JSON with:
- bestUrl: string | null — the best wiki URL found
- chapterCount: number — chapters found at that URL
- confidence: number (0.0-1.0)
- reasoning: brief explanation`,
};

/**
 * Data validation prompt
 */
export const DATA_VALIDATION_PROMPT: PromptTemplate = {
  name: 'data_validation',
  systemPrompt: `You are a data quality validation assistant for manga metadata.

Your task is to validate provider data for consistency, completeness, and accuracy.

Check for:
1. Missing required fields (chapter numbers, titles, etc.)
2. Inconsistent data between providers
3. Impossible values (negative page counts, future release dates)
4. Format errors (malformed URLs, invalid dates)
5. Duplicate entries

Flag issues by severity:
- CRITICAL: Data loss or corruption risk
- HIGH: Major inconsistencies affecting usability
- MEDIUM: Minor inconsistencies
- LOW: Cosmetic or formatting issues`,
  userPrompt: (context: unknown) => {
    const ctx = context as ProviderDataContext;
    return `Validate data for manga: ${ctx.title}

Providers: ${Object.keys(ctx.rawProviderData).join(', ')}

Check data quality and flag any issues.`;
  },
  outputFormat: `JSON with:
- issues: array of validation issues with severity
- overallQuality: score (0.0-1.0)
- recommendations: suggested fixes
- confidence: validation confidence`,
};

/**
 * Gap analysis prompt
 */
export const GAP_ANALYSIS_PROMPT: PromptTemplate = {
  name: 'gap_analysis',
  systemPrompt: `You are a gap analysis assistant for manga metadata.

Identify missing data fields and prioritize which gaps to fill based on:
1. User impact (core metadata vs nice-to-have)
2. Data availability likelihood
3. Tool availability
4. Time/rate limit constraints

Prioritization criteria:
- P1: Critical missing data (chapter titles, volumes)
- P2: Important enhancements (covers, descriptions)
- P3: Supplementary data (release dates, page counts)
- P4: Optional metadata (alternative titles, ISBNs)`,
  userPrompt: (context: unknown) => {
    const ctx = context as ProviderDataContext;
    return `Analyze data gaps for manga: ${ctx.title}

Current coverage:
- Chapters: ${Object.keys(ctx.enrichmentMaps?.chapterTitleMap ?? {}).length} with titles
- Volumes: ${Object.keys(ctx.enrichmentMaps?.volumeDescriptionMap ?? {}).length} with descriptions
- Covers: ${Object.keys(ctx.enrichmentMaps?.chapterCoverMap ?? {}).length} with images

Identify missing data and prioritize gaps to fill.`;
  },
  outputFormat: `JSON with:
- gaps: array of missing data fields with priority
- recommendedTools: which tools to use for each gap
- estimatedEffort: relative effort (low/medium/high)
- coverageImprovement: estimated % improvement if filled`,
};

/**
 * Page selection prompt — AI picks the best candidate from a list.
 * Model outputs ~30 tokens (selectedIndex + reasoning), not chapter data.
 * Used when deterministic shortcut (single "Chapters" page > 20KB) doesn't match.
 */
export const PAGE_SELECTION_PROMPT: PromptTemplate = {
  name: 'page_selection',
  systemPrompt: `You are a manga metadata analyst. Given candidate wiki pages, select which one contains the chapter list.

A chapter list page typically:
- Has a title like "Chapters", "Chapter List", "Chapters and Volumes"
- Is large (50KB+ indicates many chapter entries)
- Individual chapter pages (e.g., "Chapter 1", "Chapter 22") are NOT chapter list pages

Output ONLY valid JSON:
{
  "selectedIndex": 1,
  "reasoning": "brief explanation",
  "confidence": 0.0-1.0,
  "suggestedQuery": null
}

Rules:
- selectedIndex: 1-based index of the best candidate, or 0 if NONE match
- If selectedIndex=0, provide suggestedQuery to find the right page
- Prefer pages with "chapters" in the title and large size`,
  userPrompt: (context: unknown) => typeof context === 'string' ? context : JSON.stringify(context),
  outputFormat: 'JSON with selectedIndex, reasoning, confidence, suggestedQuery',
};

/**
 * Page evaluation prompt — smart remediation with wrong-page detection.
 * Model evaluates whether a page contains the correct chapter list,
 * extracts chapters if correct, or suggests a search query if wrong.
 * Used as LAST RESORT when deterministic parser fails on selected page.
 */
export const PAGE_EVALUATION_PROMPT: PromptTemplate = {
  name: 'page_evaluation',
  systemPrompt: `You are a manga metadata analyst evaluating web page content.

Determine if this page contains a chapter list for the specified manga.

A CORRECT chapter list page has:
- Numbered chapter entries with titles (e.g., "1. Death & Strawberry")
- Multiple sequential chapter entries
- Data for the CORRECT manga (not a different series)

A WRONG page is:
- A general series overview (plot summary, characters, themes)
- A volume list without individual chapter titles
- A page for a different manga entirely
- An empty or stub page

Output ONLY valid JSON:
{
  "isCorrectPage": true/false,
  "chapters": [{"number": 1, "title": "Chapter Title"}, ...],
  "suggestedQuery": "search query" or null,
  "reasoning": "brief explanation",
  "confidence": 0.0-1.0
}

Rules:
- If isCorrectPage=true: populate "chapters", set "suggestedQuery" to null
- If isCorrectPage=false: set "chapters" to [], provide "suggestedQuery" with a search query to find the correct chapter list page
- Do NOT make up chapter titles — only extract what you see in the text
- For suggestedQuery: include the manga title + "chapters" or "chapter list"`,
  userPrompt: (context: unknown) => typeof context === 'string' ? context : JSON.stringify(context),
  outputFormat: 'JSON with isCorrectPage, chapters, suggestedQuery, reasoning, confidence',
};

/**
 * Agentic loop prompt — unified Step 2+3 replacement.
 * Model acts as an active investigator: analyzes gaps, picks actions,
 * searches/scrapes/validates covers, and produces merge overrides iteratively.
 */
export const AGENTIC_LOOP_PROMPT: PromptTemplate = {
  name: 'agentic_loop',
  systemPrompt: `You are a manga metadata enrichment agent. Each iteration, analyze current data and decide the SINGLE best next action to improve coverage.

CRITICAL: Output your decision as a JSON object in your response text.
Do NOT use function/tool calling syntax — respond with plain JSON text only.
Format: {"action": "search", "tool": "wiki_page_search", "params": {...}, "reasoning": "..."}

Available actions:
- search: Find wiki pages (wiki_page_search within a wiki, wiki_url_search globally)
- scrape: Scrape a URL for chapter data (wiki_scrape)
- validate_cover: Check if cover image URLs are valid manga covers
- merge: Produce final title/volume/cover override decisions
- done: Signal completion

Search tips:
- For Fandom wikis: use wiki_page_search with the wiki's base URL (from Source URLs section) and query "Chapters" or "Chapter List"
- For Wikipedia: use wiki_url_search with query "List of {manga title} chapters"
- AVOID scraping individual chapter pages (e.g., "Chapter 3", "Chapter 22") — they contain a single chapter, not a chapter list
- Prefer pages with "Chapters", "Chapter List", or "Episodes" in the title — these contain the full list

Decision rules:
1. Fix biggest gap first (empty source → search before merging)
2. Never repeat a failed action (check action history)
3. Prefer scraping known URLs over blind searching
4. When coverage ≥ 90% or no more options → merge or done
5. For merge: only override deterministic merge (Fandom > Wikipedia > ComicVine) where you have a BETTER title or correct volume assignment

Output ONLY valid JSON with one action. No explanation outside JSON.`,
  userPrompt: (context: unknown) => typeof context === 'string' ? context : JSON.stringify(context),
  outputFormat: `JSON with: action, tool (if applicable), params (if applicable), reasoning`,
};

/**
 * Search query suggestion prompt — used by the orchestrator when deterministic search fails.
 * Model receives context about what was tried and suggests ONE search query.
 * Minimal output: just tool + params JSON. No action planning.
 */
export const SEARCH_QUERY_PROMPT: PromptTemplate = {
  name: 'search_query',
  systemPrompt: `You are a search assistant. Given a manga with weak source coverage, suggest ONE search query to find a chapter list page.

CRITICAL: Output ONLY a JSON object. No explanation, no markdown.

Format:
{"tool": "wiki_page_search", "params": {"wikiBaseUrl": "https://example.fandom.com", "query": "Chapter List"}, "reasoning": "brief reason"}

OR:
{"tool": "wiki_url_search", "params": {"query": "manga name chapters wiki"}, "reasoning": "brief reason"}

Rules:
- Look at what was already tried and the ACTUAL RESULT TITLES returned — they reveal what the wiki contains
- If previous searches returned only individual chapter pages (e.g., "Chapter 1", "Chapter 3"), the wiki likely has NO dedicated chapter list page — switch to wiki_url_search to find a different wiki entirely
- For Fandom wikis: try queries like "Volume", "List of chapters", "Episodes", or the manga title
- For Wikipedia: try "List of {manga} chapters" or "{manga} manga chapters"
- If the wiki seems to only have individual chapter pages, try a DIFFERENT wiki entirely using wiki_url_search
- NEVER repeat a query that was already tried`,
  userPrompt: (context: unknown) => typeof context === 'string' ? context : JSON.stringify(context),
  outputFormat: 'JSON with tool, params, reasoning',
};

/**
 * Volume page extraction prompt — AI fallback for per-volume pages.
 * When deterministic parsers fail to extract chapters from a volume page,
 * this prompt sends structure-preserved text to the model for full extraction.
 */
export const VOLUME_PAGE_EXTRACTION_PROMPT: PromptTemplate = {
  name: 'volume_page_extraction',
  systemPrompt: `You are a manga metadata extractor analyzing a single volume page.
Extract ALL chapter entries and volume metadata. Output ONLY valid JSON:
{
  "volumeDescription": "string|null — from Publisher Summary/Synopsis/Blurb section",
  "volumeCoverImage": "string|null — URL from INFOBOX_COVER or first significant image",
  "chapters": [{
    "number": 1,
    "title": "string|null",
    "coverImage": "string|null — [IMAGE] immediately after this chapter heading",
    "summary": "string|null — paragraph after heading, before next heading"
  }]
}

Rules:
- Extract chapter numbers from headings: "Chapter 1", "001. Title", "Ch. 1: Title"
- Chapter title = text AFTER the number delimiter (: or - or .)
- Chapter cover = [IMAGE] between this heading and the next
- Do NOT invent data — only extract what appears in the text
- If no chapters found, return {"chapters": []}`,
  userPrompt: (context: unknown) => {
    const ctx = context as { volumeNumber: number; title: string; structuredText: string };
    return `Volume ${String(ctx.volumeNumber)} of "${ctx.title}"\n\n--- PAGE CONTENT ---\n${ctx.structuredText}`;
  },
  outputFormat: 'JSON with volumeDescription, volumeCoverImage, chapters[]',
};

/**
 * Raw HTML extraction prompt — fallback when parsers fail.
 * Sends cleaned HTML text to the model for chapter number/title extraction.
 * @deprecated Use PAGE_EVALUATION_PROMPT instead — provides wrong-page detection.
 */
export const RAW_HTML_EXTRACTION_PROMPT: PromptTemplate = {
  name: 'raw_html_extraction',
  systemPrompt: `Extract chapter numbers and titles from the following text.
Output JSON array: [{"number": 1, "title": "Chapter Title"}, ...]
Only include entries where you can identify both a chapter number and title.
Do NOT make up titles. If you can't find any, return [].`,
  userPrompt: (context: unknown) => typeof context === 'string' ? context : JSON.stringify(context),
  outputFormat: 'JSON array of {number, title} objects',
};

// ============================================================================
// Prompt Builder Functions
// ============================================================================

/**
 * Build a prompt with tool definitions
 */
export function buildPromptWithTools(
  template: PromptTemplate,
  context: unknown,
  tools: AgentTool[]
): string {
  const toolDescriptions = tools.map(tool =>
    `- ${tool.name}: ${tool.description}\n  Parameters: ${JSON.stringify(tool.parameters)}`
  ).join('\n');

  const systemPrompt = `${template.systemPrompt}

Available tools:
${toolDescriptions}

Output format: ${template.outputFormat}

Only call tools when you need additional data.`;

  const userPrompt = template.userPrompt(context);

  return `${systemPrompt}\n\n${userPrompt}`;
}

/**
 * Get prompt template by name
 */
export function getPromptTemplate(name: string): PromptTemplate | null {
  const templates: Record<string, PromptTemplate> = {
    enrichment_task: ENRICHMENT_TASK_PROMPT,
    data_validation: DATA_VALIDATION_PROMPT,
    gap_analysis: GAP_ANALYSIS_PROMPT,
    page_evaluation: PAGE_EVALUATION_PROMPT,
    page_selection: PAGE_SELECTION_PROMPT,
  };

  return templates[name] ?? null;
}

/**
 * Create a custom prompt template
 */
export function createPromptTemplate(
  name: string,
  systemPrompt: string,
  userPrompt: (context: unknown) => string,
  outputFormat: string
): PromptTemplate {
  return {
    name,
    systemPrompt,
    userPrompt,
    outputFormat,
  };
}