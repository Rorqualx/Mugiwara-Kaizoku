/**
 * AI Agent Core Types
 *
 * Type definitions for Qwen3.5-2B inference and agent operations.
 */

/* eslint-disable import/order -- type imports from @/ and external conflict with pathGroups + type group config */
import type { AsyncResult } from '@/utils/async-result';
import type { GbnfJsonSchema } from 'node-llama-cpp';
/* eslint-enable import/order */

export interface AIAgentConfig {
  /** Path to GGUF model file */
  modelPath: string;
  /** Model context size in tokens (default: 4096 for Qwen3.5-2B) */
  contextSize: number;
  /** Temperature for generation (0.0-2.0) */
  temperature: number;
  /** Top-p sampling (0.0-1.0) */
  topP: number;
  /** Top-k sampling (0 for disabled) */
  topK: number;
  /** Maximum tokens to generate */
  maxTokens: number;
  /** Enable tool calling */
  enableToolCalling: boolean;
  /** JSON mode for structured output */
  jsonMode: boolean;
  /** Cache directory for downloaded models */
  cacheDir: string;
  /** Hugging Face repository for model download */
  modelRepo: string;
  /** Model filename in repository */
  modelFile: string;
  /** Expected SHA256 checksum for verification (optional) */
  modelSha256?: string | undefined;
  /** Enable download progress reporting */
  downloadProgress: boolean;
  /** Number of model layers to offload to GPU (0 = CPU only, undefined = auto) */
  gpuLayers: number;
  /** Enable verbose logging */
  verbose: boolean;
}

export const DEFAULT_AGENT_CONFIG: AIAgentConfig = {
  modelPath: process.env['AI_MODEL_PATH'] ?? '~/.cache/mugiwara-kaizoku/models/Qwen3.5-4B-Q4_K_M.gguf',
  // Qwen3.5-4B supports 262K native context; 16K default to avoid Metal OOM on 24GB Mac.
  // The orchestrated loop uses focused prompts (~2-4K tokens each), so 16K is plenty.
  // 32K caused Metal OOM during inference on Mac Mini — the SIGABRT is not catchable.
  // Set AI_CONTEXT_SIZE=32768 or higher if you have more VRAM headroom.
  contextSize: parseInt(process.env['AI_CONTEXT_SIZE'] ?? '16384', 10),
  temperature: 0.1,
  topP: 0.9,
  topK: 40,
  // 16K output — plenty for override JSON
  maxTokens: parseInt(process.env['AI_MAX_TOKENS'] ?? '16384', 10),
  enableToolCalling: true,
  jsonMode: true,
  cacheDir: process.env['AI_MODEL_CACHE_DIR'] ?? '~/.cache/mugiwara-kaizoku/models',
  modelRepo: process.env['AI_MODEL_REPO'] ?? 'unsloth/Qwen3.5-4B-GGUF',
  modelFile: process.env['AI_MODEL_FILE'] ?? 'Qwen3.5-4B-Q4_K_M.gguf',
  modelSha256: process.env['AI_MODEL_SHA256'],
  downloadProgress: process.env['NODE_ENV'] === 'development',
  // GPU layers: offload model layers to GPU (Metal on Mac, CUDA on Linux)
  // Qwen3.5-4B Q4_K_M (~2.7GB) fits in 24GB Mac with full GPU offload.
  // Set AI_GPU_LAYERS=0 to force CPU-only.
  gpuLayers: parseInt(process.env['AI_GPU_LAYERS'] ?? '99', 10),
  verbose: process.env['NODE_ENV'] === 'development',
};

/** Agent tool definition */
export interface AgentTool {
  name: string;
  description: string;
  parameters: Readonly<GbnfJsonSchema>;
  execute: (params: unknown) => Promise<AsyncResult<unknown, Error>>;
}

/**
 * Convert AgentTool array to ChatModelFunctions for node-llama-cpp
 */
import type { ChatModelFunctions } from 'node-llama-cpp';
export function agentToolsToChatModelFunctions(tools: AgentTool[]): ChatModelFunctions {
  const result: Record<string, { description: string; params: GbnfJsonSchema }> = {};
  for (const tool of tools) {
    result[tool.name] = {
      description: tool.description,
      params: tool.parameters
    };
  }
  return result as ChatModelFunctions;
}

/** Agent response with tool calls */
export interface AgentResponse {
  response: string;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
  confidence: number;
  reasoning?: string;
}

/** Tool call definition */
export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/** Raw provider data context */
export interface ProviderDataContext {
  mangaId: number;
  title: string;
  rawProviderData: Record<string, unknown>;
  existingDbState?: Record<string, unknown>;
  enrichmentMaps?: {
    chapterTitleMap: Record<number, string>;
    chapterVolumeMap: Record<number, number>;
    chapterCoverMap: Record<number, string>;
    chapterDescriptionMap: Record<number, string>;
    chapterPagesMap: Record<number, number>;
    chapterReleaseDateMap: Record<number, string>;
    volumeDescriptionMap: Record<number, string>;
  };
  /** Summary of raw provider data for prompt engineering */
  providerSummary?: string;
  /** User's preferred language for metadata (e.g. 'en', 'ja', 'fr') */
  preferredLanguage?: string;
}

/** Agent task types */
export type AgentTask = 'enrichment_task' | 'data_validation' | 'gap_analysis' | 'tool_selection';