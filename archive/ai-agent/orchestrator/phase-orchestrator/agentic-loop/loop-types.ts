/**
 * Agentic Loop Types
 *
 * Type definitions for the agentic enrichment loop where the AI model
 * actively investigates gaps, validates data, and merges iteratively.
 */

/** Budget constraints for the agentic loop */
export interface LoopBudget {
  maxCalls: number;
  callsUsed: number;
  startTimeMs: number;
  maxDurationMs: number;
}

/** Coverage metrics tracked across iterations */
export interface LoopCoverage {
  titlePercent: number;
  volumePercent: number;
  coverPercent: number;
}

/** AI-produced overrides to apply on top of deterministic merge */
export interface AIOverrides {
  titleOverrides: Record<number, string>;
  volumeOverrides: Record<number, number>;
  coverSelections: Record<number, string>;
  coverRejections: string[];
}

/** Record of a single action taken during the loop */
export interface ActionRecord {
  iteration: number;
  action: string;
  tool?: string | undefined;
  params?: string | undefined;
  resultSummary: string;
  durationMs: number;
}

/** Full state of the agentic loop */
export interface AgenticLoopState {
  mangaId: number;
  title: string;
  expectedChapterCount: number;
  preferredLanguage: string;
  budget: LoopBudget;
  coverage: LoopCoverage;
  actionHistory: ActionRecord[];
  aiOverrides: AIOverrides;
}

/** Actions the model can request */
export type AgenticActionType = 'search' | 'scrape' | 'validate_cover' | 'merge' | 'done';

/** Base action fields shared by all action types */
interface BaseAction {
  action: AgenticActionType;
  reasoning: string;
}

/** Search action — find wiki pages */
export interface SearchAction extends BaseAction {
  action: 'search';
  tool: 'wiki_page_search' | 'wiki_url_search';
  params: Record<string, string>;
}

/** Scrape action — scrape a specific URL */
export interface ScrapeAction extends BaseAction {
  action: 'scrape';
  tool: 'wiki_scrape';
  params: { url: string };
}

/** Cover validation action — check cover image URLs */
export interface ValidateCoverAction extends BaseAction {
  action: 'validate_cover';
  params: { urls: string[]; context: string };
}

/** Merge action — produce title/volume/cover overrides */
export interface MergeAction extends BaseAction {
  action: 'merge';
  titleOverrides?: Record<string, string> | undefined;
  volumeOverrides?: Record<string, number> | undefined;
  coverSelections?: Record<string, string> | undefined;
}

/** Done action — signal completion */
export interface DoneAction extends BaseAction {
  action: 'done';
}

/** Discriminated union of all possible model actions */
export type AgenticAction = SearchAction | ScrapeAction | ValidateCoverAction | MergeAction | DoneAction;

/** Reason why the loop terminated */
export type TerminationReason =
  | 'coverage_met'
  | 'budget_exhausted'
  | 'time_limit'
  | 'model_done'
  | 'stagnation'
  | 'error';
