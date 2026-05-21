/**
 * AI Agent Core - Main Exports
 *
 * Centralized exports for all agent core modules.
 */

import { Qwen35InferenceService } from './inference-service';
import { getToolRegistry } from './tool-registry';

import type { AIAgentConfig } from './types';

// Types
export type {
  AIAgentConfig,
  AgentResponse,
  AgentTool,
  ToolCall,
  ProviderDataContext,
  AgentTask,
} from './types';

export { DEFAULT_AGENT_CONFIG } from './types';

// Inference Service
export { Qwen35InferenceService } from './inference-service';

// Tool Registry
export { ToolRegistry, getToolRegistry, registerTool, executeTool } from './tool-registry';

// Memory Manager
export { MemoryManager, getMemoryManager } from './memory-manager';

// Prompt Engineer
export type { PromptTemplate } from './prompt-engineer';
export {
  ENRICHMENT_TASK_PROMPT,
  DATA_VALIDATION_PROMPT,
  GAP_ANALYSIS_PROMPT,
  buildPromptWithTools,
  getPromptTemplate,
  createPromptTemplate,
} from './prompt-engineer';

// Singleton instances (convenience)
export function getInferenceService(config?: Partial<AIAgentConfig>): Qwen35InferenceService {
  return Qwen35InferenceService.getInstance(config);
}

export function getAgentTools(): import('./types').AgentTool[] {
  return getToolRegistry().listTools();
}