/**
 * Direct URL Probing — bypass search API by trying known Fandom page paths.
 * Used as last resort when both deterministic and model-guided search fail.
 */

import type { AgentTool } from '@/server/ai-agent/agent-core/types';
import type { SourceDataCollection } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import { isError, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { logAction, recordAction, updateCoverage } from './loop-state';
import { mergeScrapeIntoData } from './search-helpers';

import type { AgenticLoopState } from './loop-types';

const log = logger.child('UrlProbing');

/** Known Fandom page paths likely to contain chapter lists */
const FANDOM_PROBE_PATHS = ['/wiki/Chapters', '/wiki/Chapter_List', '/wiki/List_of_chapters', '/wiki/Volumes'];

interface ProbeOptions {
  baseUrl: string;
  scrapeTool: AgentTool;
  state: AgenticLoopState;
  data: SourceDataCollection;
  urlsScraped: Set<string>;
  isBudgetExhausted: () => boolean;
  isCoverageMet: () => boolean;
}

/** Probe known Fandom URL paths directly when search fails */
export async function probeDirectUrls(opts: ProbeOptions): Promise<void> {
  const { baseUrl, scrapeTool, state, data, urlsScraped, isBudgetExhausted, isCoverageMet } = opts;
  const probeUrls = FANDOM_PROBE_PATHS.map(path => `${baseUrl}${path}`);
  const unscraped = probeUrls.filter(u => !urlsScraped.has(u));
  if (unscraped.length === 0) return;

  /* eslint-disable no-await-in-loop -- Sequential URL probing */
  for (const url of unscraped) {
    if (isBudgetExhausted() || isCoverageMet()) return;
    const probeStartMs = Date.now();
    urlsScraped.add(url);

    const result = await scrapeTool.execute({ url });
    if (isError(result) || !isSuccess(result)) {
      logAction(state, { iteration: state.budget.callsUsed + 1, action: 'probe', tool: 'wiki_scrape', params: JSON.stringify({ url }), resultSummary: `probe ${url} failed`, durationMs: Date.now() - probeStartMs });
      continue;
    }

    const newChapters = mergeScrapeIntoData(result.data, data);
    updateCoverage(state, data);

    if (newChapters > 0) {
      recordAction(state, { iteration: state.budget.callsUsed + 1, action: 'probe+scrape', tool: 'wiki_scrape', params: JSON.stringify({ url }), resultSummary: `probed ${url}: +${newChapters} chapters, coverage ${state.coverage.titlePercent}%`, durationMs: Date.now() - probeStartMs });
      log.info('Direct probe found data', { url, newChapters, coverage: state.coverage.titlePercent });
      return;
    }

    logAction(state, { iteration: state.budget.callsUsed + 1, action: 'probe', tool: 'wiki_scrape', params: JSON.stringify({ url }), resultSummary: `probed ${url}: 0 new chapters`, durationMs: Date.now() - probeStartMs });
  }
  /* eslint-enable no-await-in-loop */
}
