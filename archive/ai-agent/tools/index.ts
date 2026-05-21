/**
 * AI Agent Tools - Main Exports
 *
 * Centralized exports for all AI agent tool implementations.
 * Tool groups support the 3-step orchestration:
 *   - Remediation tools: wiki URL search + scrape (Steps 1-2)
 *   - Analysis tools: none (Step 3 uses structured output only)
 *   - All tools: full set for backward compatibility
 */

import { coverValidationTool } from './cover-validation-tool';
import { fandomTool } from './fandom-tool';
import { mangadexTool } from './mangadex-tool';
import { mergeTool } from './merge-tool';
import { similarityTool } from './similarity-tool';
import { validationTool } from './validation-tool';
import { wikiPageSearchTool } from './wiki-page-search-tool';
import { wikiScrapeTool } from './wiki-scrape-tool';
import { wikiUrlSearchTool } from './wiki-url-search-tool';
import { wikipediaTool } from './wikipedia-tool';

// Export all tools
export { coverValidationTool };
export { mangadexTool };
export { fandomTool };
export { wikipediaTool };
export { similarityTool };
export { validationTool };
export { mergeTool };
export { wikiUrlSearchTool };
export { wikiScrapeTool };
export { wikiPageSearchTool };

/** All tools — backward compatible */
export function getAllTools(): import('../agent-core/types').AgentTool[] {
  return [
    mangadexTool,
    fandomTool,
    wikipediaTool,
    similarityTool,
    validationTool,
    mergeTool,
    wikiUrlSearchTool,
    wikiScrapeTool,
    wikiPageSearchTool,
  ];
}

/** Remediation tools for AI-directed URL discovery (Steps 1-2) */
export function getRemediationTools(): import('../agent-core/types').AgentTool[] {
  return [wikiUrlSearchTool, wikiScrapeTool, wikiPageSearchTool];
}