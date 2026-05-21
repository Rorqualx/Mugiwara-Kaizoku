/**
 * AI Fallback Extraction for Volume Pages
 *
 * When deterministic parsers fail to extract chapters from a volume page,
 * this module uses the local AI model to extract structured data from
 * the page's HTML. Budget-capped to prevent excessive model calls.
 *
 * @module per-volume-iterator/ai-fallback-extraction
 */

import { Qwen35InferenceService } from '@/server/ai-agent/agent-core/inference-service';
import { VOLUME_PAGE_EXTRACTION_PROMPT } from '@/server/ai-agent/agent-core/prompt-engineer';
import { cleanHtmlToStructuredText } from '@/server/ai-agent/orchestrator/phase-orchestrator/ai-page-evaluator';
import { isError, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { VolumePageData, VolumePageChapter } from '../per-volume-iterator';

const log = logger.child('AIFallbackExtraction');

// ============================================================================
// Budget Tracking
// ============================================================================

const MAX_AI_CALLS_PER_RUN = 8;
let aiCallCount = 0;

/** Reset the AI call budget at the start of each enrichment run */
export function resetAICallBudget(): void {
  aiCallCount = 0;
}

/** Check if AI calls remain within budget */
export function hasAIBudget(): boolean {
  return aiCallCount < MAX_AI_CALLS_PER_RUN;
}

// ============================================================================
// AI Extraction
// ============================================================================

/** Timeout for AI volume page extraction (120s — smaller output than full chapter lists) */
const EXTRACTION_TIMEOUT_MS = 120000;

/** Prepare structured text from HTML, returning null if too short */
async function prepareStructuredText(html: string, volumeNumber: number): Promise<string | null> {
  const structuredText = await cleanHtmlToStructuredText(html);
  if (structuredText.length < 50) {
    log.warn(`[AI fallback] Structured text too short for vol ${String(volumeNumber)}`);
    return null;
  }
  return structuredText;
}

/** Run the AI model to generate a response for volume extraction */
async function runAIExtraction(
  prompt: string,
  volumeNumber: number,
): Promise<string | null> {
  const inferenceService = Qwen35InferenceService.getInstance();
  const initResult = await inferenceService.initialize();
  if (isError(initResult)) {
    log.warn('[AI fallback] Inference service initialization failed');
    return null;
  }

  inferenceService.resetChat();

  const result = await withExtractionTimeout(
    inferenceService.generate(prompt, []),
    volumeNumber,
  );

  aiCallCount++;

  if (isError(result) || !isSuccess(result)) {
    log.warn(`[AI fallback] Model generation failed for vol ${String(volumeNumber)}`);
    return null;
  }

  return result.data.response;
}

/**
 * Extract volume page data using the AI model as a fallback when deterministic
 * parsers return no chapters. Returns null if budget exhausted or extraction fails.
 */
export async function extractVolumePageWithAI(
  html: string,
  volumeNumber: number,
  baseUrl: string,
  mangaTitle: string,
  chaptersPerVolume: number,
): Promise<VolumePageData | null> {
  if (!hasAIBudget()) {
    log.info(`[AI fallback] Budget exhausted (${String(aiCallCount)}/${String(MAX_AI_CALLS_PER_RUN)}), skipping vol ${String(volumeNumber)}`);
    return null;
  }

  const structuredText = await prepareStructuredText(html, volumeNumber);
  if (!structuredText) return null;

  const validUrls = collectUrlsFromText(structuredText, baseUrl);
  const prompt = buildExtractionPrompt(structuredText, volumeNumber, mangaTitle);

  try {
    log.info(`[AI fallback] Extracting vol ${String(volumeNumber)}: ${String(structuredText.length)} chars to model`);

    const response = await runAIExtraction(prompt, volumeNumber);
    if (!response) return null;

    const parsed = parseVolumeExtractionResponse(response, volumeNumber, validUrls);
    if (!parsed) return null;

    if (!validateAIExtractedVolume(parsed, chaptersPerVolume)) {
      log.warn(`[AI fallback] Validation failed for vol ${String(volumeNumber)}`, {
        chapters: parsed.chapters.length,
      });
      return null;
    }

    log.info(`[AI fallback] Extracted ${String(parsed.chapters.length)} chapters for vol ${String(volumeNumber)}`);
    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`[AI fallback] Extraction error for vol ${String(volumeNumber)}`, { error: msg });
    return null;
  }
}

// ============================================================================
// Response Parsing
// ============================================================================

/** Raw shape of the AI model's JSON response */
interface AIVolumeResponse {
  volumeDescription?: string | null;
  volumeCoverImage?: string | null;
  chapters?: Array<{
    number?: number;
    title?: string | null;
    coverImage?: string | null;
    summary?: string | null;
  }>;
}

/** Parse a single chapter entry from the AI response */
function parseAIChapter(
  ch: Record<string, unknown>,
  volumeNumber: number,
  validUrls: Set<string>,
): VolumePageChapter | null {
  const num = typeof ch['number'] === 'number' ? ch['number'] : null;
  if (num === null || num <= 0) return null;

  const chapter: VolumePageChapter = { number: num, volumeNumber };
  const title = ch['title'];
  if (typeof title === 'string' && title.length > 0) chapter.title = title;
  const cover = ch['coverImage'];
  if (typeof cover === 'string' && isValidExtractedUrl(cover, validUrls)) {
    chapter.coverImage = cover;
  }
  const summary = ch['summary'];
  if (typeof summary === 'string' && summary.length > 0) chapter.summary = summary;
  return chapter;
}

/**
 * Parse the model's JSON response into VolumePageData.
 * Rejects cover URLs not present in the original page (anti-hallucination).
 */
export function parseVolumeExtractionResponse(
  response: string,
  volumeNumber: number,
  validUrls: Set<string>,
): VolumePageData | null {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as AIVolumeResponse;

  const chapters: VolumePageChapter[] = [];
  const rawChapters: unknown[] = Array.isArray(obj.chapters) ? obj.chapters : [];
  for (const ch of rawChapters) {
    if (!ch || typeof ch !== 'object') continue;
    const chapter = parseAIChapter(ch as Record<string, unknown>, volumeNumber, validUrls);
    if (chapter) chapters.push(chapter);
  }

  const result: VolumePageData = { volumeNumber, chapters };

  if (typeof obj.volumeDescription === 'string' && obj.volumeDescription.length > 0) {
    result.description = obj.volumeDescription;
  }
  if (typeof obj.volumeCoverImage === 'string' && isValidExtractedUrl(obj.volumeCoverImage, validUrls)) {
    result.coverImage = obj.volumeCoverImage;
  }

  return result;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate AI-extracted volume data for sanity.
 * - Chapter count 1-30 per volume
 * - Sequential numbering (no gap > 3 within volume)
 * - At least 1 chapter has a title
 */
export function validateAIExtractedVolume(data: VolumePageData, chaptersPerVolume: number): boolean {
  const { chapters } = data;
  if (chapters.length === 0) return false;
  if (chapters.length > Math.max(30, chaptersPerVolume * 2)) return false;

  const sorted = [...chapters].sort((a, b) => a.number - b.number);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev && curr && curr.number - prev.number > 3) return false;
  }

  return chapters.some(ch => ch.title && ch.title.length > 0);
}

// ============================================================================
// Helpers
// ============================================================================

/** Build the full prompt string for the inference service */
function buildExtractionPrompt(structuredText: string, volumeNumber: number, mangaTitle: string): string {
  const context = { volumeNumber, title: mangaTitle, structuredText };
  return `${VOLUME_PAGE_EXTRACTION_PROMPT.systemPrompt}\n\n${VOLUME_PAGE_EXTRACTION_PROMPT.userPrompt(context)}`;
}

/** Collect all URLs from structured text + base URL for anti-hallucination */
function collectUrlsFromText(text: string, baseUrl: string): Set<string> {
  const urls = new Set<string>();
  urls.add(baseUrl);
  const urlPattern = /https?:\/\/[^\s\]|)]+/g;
  const matches = text.match(urlPattern);
  if (matches) {
    for (const url of matches) {
      urls.add(url);
    }
  }
  return urls;
}

/** Check if a URL from the model exists in the original page (anti-hallucination) */
function isValidExtractedUrl(url: string, validUrls: Set<string>): boolean {
  if (validUrls.has(url)) return true;
  try {
    const urlHost = new URL(url).hostname;
    for (const valid of validUrls) {
      try {
        if (new URL(valid).hostname === urlHost) return true;
      } catch { /* skip invalid */ }
    }
  } catch { /* invalid URL */ }
  return false;
}

/** Wrap generation with a timeout */
async function withExtractionTimeout<T>(
  promise: Promise<T>,
  volumeNumber: number,
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`AI volume extraction timed out for vol ${String(volumeNumber)}`)),
      EXTRACTION_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
