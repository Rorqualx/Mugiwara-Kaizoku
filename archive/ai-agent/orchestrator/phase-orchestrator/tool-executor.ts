/**
 * Tool execution for AI Agent Phase Orchestrator
 *
 * Handles executing tool calls from agent responses with
 * retry logic and enrichment map updates.
 */

import type { AgentTool } from '@/server/ai-agent/agent-core/types';
import { createEmptyEnrichmentMaps } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import type { ChapterEnrichmentMaps } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import { retryWithBackoff } from '@/server/utils/retry';
import { createSuccessResult, createErrorResult, isError, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { processToolResultAndUpdateMaps } from './data-extraction';
import { TOOL_RETRY_CONFIG } from './orchestrator-types';


const log = logger.child('AIAgentOrchestrator');

/**
 * Execute a single tool call and return the result data
 */
/**
 * Execute tool calls from agent response
 */
export async function executeToolCalls(
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>,
  availableTools: AgentTool[],
  _mangaId: number,
  _title: string
): Promise<AsyncResult<ChapterEnrichmentMaps, Error>> {
  const toolMap = new Map(availableTools.map(tool => [tool.name, tool]));
  const enrichmentMaps = createEmptyEnrichmentMaps();

  /* eslint-disable no-await-in-loop -- Tools must be executed sequentially */
  for (const toolCall of toolCalls) {
    const tool = toolMap.get(toolCall.name);
    if (!tool) {
      return createErrorResult(new Error(`Unknown tool: ${toolCall.name}`));
    }

    const callResult = await retryWithBackoffSafe(tool, toolCall, TOOL_RETRY_CONFIG);
    if (isError(callResult)) {
      return callResult;
    }
    if (!isSuccess(callResult)) {
      return createErrorResult(new Error(`Unexpected status from tool ${toolCall.name}`));
    }

    processToolResultAndUpdateMaps(toolCall.name, callResult.data, enrichmentMaps);
    log.debug('Tool executed and processed', { tool: toolCall.name });
  }
  /* eslint-enable no-await-in-loop */

  return createSuccessResult(enrichmentMaps);
}

/**
 * Retry a tool call with backoff, returning AsyncResult instead of throwing
 */
async function retryWithBackoffSafe(
  tool: AgentTool,
  toolCall: { name: string; arguments: Record<string, unknown> },
  retryConfig: typeof TOOL_RETRY_CONFIG
): Promise<AsyncResult<unknown, Error>> {
  try {
    const executeResult = await retryWithBackoff(
      () => executeToolCallInner(tool, toolCall),
      retryConfig
    );
    return createSuccessResult(executeResult);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return createErrorResult(new Error(`Tool ${toolCall.name} failed: ${err.message}`));
  }
}

/**
 * Inner execution function for retryWithBackoff (throws on failure as required by retry API)
 */
async function executeToolCallInner(
  tool: AgentTool,
  toolCall: { name: string; arguments: Record<string, unknown> }
): Promise<unknown> {
  const result = await tool.execute(toolCall.arguments);
  if (isError(result)) {
    throw new Error(`Tool ${toolCall.name} failed: ${result.error.message}`);
  }
  if (!isSuccess(result)) {
    throw new Error(`Unexpected status from tool ${toolCall.name}`);
  }
  return result.data;
}
