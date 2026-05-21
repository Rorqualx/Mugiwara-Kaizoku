/**
 * Qwen3.5-9B Inference Service
 *
 * Uses node-llama-cpp for local GGUF model inference with tool calling.
 * Follows singleton pattern similar to existing MLConfigManager.
 *
 * Model download/management is delegated to model-manager.ts.
 */

import { createSuccessResult, createErrorResult, isError, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { cleanupOldModels, ensureModelExists } from './model-manager';
import { DEFAULT_AGENT_CONFIG, type AIAgentConfig, type AgentResponse, type AgentTool, agentToolsToChatModelFunctions } from './types';

import type {
  Llama,
  LlamaModel,
  LlamaContext,
  LlamaChat,
  QwenChatWrapper,
  ChatHistoryItem,
} from 'node-llama-cpp';

type LlamaModule = {
  getLlama: (options?: unknown) => Promise<Llama>;
  LlamaModel: typeof LlamaModel;
  LlamaChat: typeof LlamaChat;
  QwenChatWrapper: typeof QwenChatWrapper;
};

// ============================================================================
// Helpers
// ============================================================================

/** Coerce an unknown caught value into an Error */
function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return new Error(String((error as { message: unknown }).message));
  }
  return new Error(JSON.stringify(error));
}

/** Try creating a context at a specific size. Returns context or null if VRAM issue. */
async function tryCreateContext(
  model: LlamaModel,
  size: number,
  requestedSize: number,
): Promise<LlamaContext | null> {
  try {
    logger.info(`Creating model context (${size} tokens)...`);
    const ctx = await model.createContext({
      contextSize: size,
      sequences: 1,
      // Metal unified memory is shared CPU/GPU — node-llama-cpp overestimates VRAM usage
      ignoreMemorySafetyChecks: true,
    });
    if (size !== requestedSize) {
      logger.warn(`Context created with reduced size ${size} (requested ${requestedSize})`);
    }
    return ctx;
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    const errorKeys = typeof err === 'object' && err !== null ? Object.keys(err as Record<string, unknown>) : [];
    logger.warn(`Context size ${size} failed: ${msg}`, {
      errorType: typeof err,
      isError: err instanceof Error,
      errorKeys,
    });
    return null;
  }
}

/** Convert function calls from LlamaChat format to AgentResponse toolCalls */
function convertFunctionCalls(
  calls: Array<{ functionName: string; params?: Record<string, unknown> | undefined }>,
): Array<{ name: string; arguments: Record<string, unknown> }> {
  return calls.map(call => ({
    name: call.functionName,
    arguments: call.params ?? {},
  }));
}

// ============================================================================
// Inference Service Class
// ============================================================================

export class Qwen35InferenceService {
  private static instance: Qwen35InferenceService | null = null;
  private model: LlamaModel | null = null;
  private context: LlamaContext | null = null;
  private chat: LlamaChat | null = null;
  private config: AIAgentConfig;
  private isInitialized = false;
  private llama: Llama | null = null;
  private llamaModule: LlamaModule | null = null;
  private tools: AgentTool[] = [];

  private constructor(config: Partial<AIAgentConfig> = {}) {
    this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
  }

  /** Get singleton instance */
  public static getInstance(config?: Partial<AIAgentConfig>): Qwen35InferenceService {
    Qwen35InferenceService.instance ??= new Qwen35InferenceService(config);
    return Qwen35InferenceService.instance;
  }

  /** Reset singleton instance for testing */
  public static resetInstance(): void {
    void Qwen35InferenceService.instance?.dispose();
    Qwen35InferenceService.instance = null;
  }

  /** Initialize the inference service. Downloads model if not present, loads via node-llama-cpp. */
  async initialize(): Promise<AsyncResult<void, Error>> {
    if (this.isInitialized) return createSuccessResult(undefined);

    try {
      logger.info('Initializing Qwen3.5-9B inference service...');
      await cleanupOldModels(this.config);

      const modelPathResult = await ensureModelExists(this.config);
      if (isError(modelPathResult)) return createErrorResult(modelPathResult.error);
      if (!isSuccess(modelPathResult)) return createErrorResult(new Error('Unexpected status from ensureModelExists'));
      const modelPath = modelPathResult.data;
      logger.info(`Model path: ${modelPath}`);

      const llamaResult = await this.loadLlamaCpp();
      if (isError(llamaResult)) return createErrorResult(llamaResult.error);
      if (!isSuccess(llamaResult)) return createErrorResult(new Error('Unexpected status from loadLlamaCpp'));
      this.llama = llamaResult.data;

      logger.info('Loading GGUF model...', { gpuLayers: this.config.gpuLayers });
      this.model = await this.llama.loadModel({ modelPath, gpuLayers: this.config.gpuLayers });

      const contextResult = await this.createContextWithFallback();
      if (isError(contextResult)) return createErrorResult(contextResult.error);
      if (!isSuccess(contextResult)) return createErrorResult(new Error('Context creation failed'));
      this.context = contextResult.data;

      const chatResult = this.createChatSession();
      if (isError(chatResult)) return chatResult;

      logger.info('Qwen3.5-9B inference service initialized successfully');
      this.isInitialized = true;
      return createSuccessResult(undefined);
    } catch (error) {
      const err = toError(error);
      logger.error('Failed to initialize inference service', { error: err.message });
      return createErrorResult(err);
    }
  }

  /** Create chat session with QwenChatWrapper */
  private createChatSession(): AsyncResult<void, Error> {
    if (!this.llamaModule || !this.context) {
      return createErrorResult(new Error('Llama module or context not loaded'));
    }
    const sequence = this.context.getSequence();
    logger.info('Creating chat session with Qwen wrapper (thinking: discourage for JSON output)...');
    this.chat = new this.llamaModule.LlamaChat({
      contextSequence: sequence,
      chatWrapper: new this.llamaModule.QwenChatWrapper({ thoughts: 'discourage' }),
    });
    return createSuccessResult(undefined);
  }

  /**
   * Reset the chat session to clear accumulated conversation history.
   * Creates a fresh LlamaChat from the existing context sequence.
   * Call this between independent generations (e.g., agentic loop iterations)
   * to prevent the model from being influenced by previous outputs.
   */
  resetChat(): void {
    if (!this.isInitialized || !this.llamaModule || !this.context) return;
    // Dispose old chat if possible
    if (this.chat && typeof this.chat.dispose === 'function') {
      void this.chat.dispose();
    }
    const sequence = this.context.getSequence();
    this.chat = new this.llamaModule.LlamaChat({
      contextSequence: sequence,
      chatWrapper: new this.llamaModule.QwenChatWrapper({ thoughts: 'discourage' }),
    });
    logger.info('Chat session reset (cleared conversation history)');
  }

  /** Create model context with automatic size fallback on VRAM errors */
  private async createContextWithFallback(): Promise<AsyncResult<LlamaContext, Error>> {
    if (!this.model) return createErrorResult(new Error('Model not loaded'));

    // Only try sizes at or below the configured size (never upward — that wastes VRAM)
    const allSizes = [32768, 16384, 8192, 4096];
    const sizes = allSizes.filter(s => s <= this.config.contextSize);
    if (!sizes.includes(this.config.contextSize)) sizes.unshift(this.config.contextSize);

    for (const size of sizes) {
      // eslint-disable-next-line no-await-in-loop -- Sequential fallback attempts
      const ctx = await tryCreateContext(this.model, size, this.config.contextSize);
      if (ctx) return createSuccessResult(ctx);
    }
    logger.error('All context sizes failed — model GGUF may be incompatible or corrupted. Try re-downloading.', {
      modelFile: this.config.modelFile,
      triedSizes: sizes,
    });
    return createErrorResult(new Error(`Failed to create context: all sizes exhausted (tried ${sizes.join(', ')}). Model may need re-download.`));
  }

  /** Load node-llama-cpp module and get Llama instance */
  private async loadLlamaCpp(): Promise<AsyncResult<Llama, Error>> {
    try {
      const llamaModule = await import('node-llama-cpp') as LlamaModule;
      this.llamaModule = llamaModule;
      const llama = await llamaModule.getLlama({ gpu: 'auto' });
      logger.info(`Llama backend loaded: ${String(llama.gpu)}`);
      return createSuccessResult(llama);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return createErrorResult(new Error(
        `Failed to load node-llama-cpp: ${err.message}\n` +
        'Note: node-llama-cpp may require additional system dependencies (CMake, C++ compiler)',
      ));
    }
  }

  /** Register tools for the agent to use */
  registerTools(tools: AgentTool[]): void {
    this.tools = [...this.tools, ...tools];
    logger.info(`Registered ${tools.length} tools, total: ${this.tools.length}`);
  }

  /** Generate response with tool calling support */
  async generate(prompt: string, tools?: AgentTool[]): Promise<AsyncResult<AgentResponse, Error>> {
    if (!this.isInitialized || !this.chat) {
      return createErrorResult(new Error('Inference service not initialized'));
    }
    try {
      return createSuccessResult(await this.runGeneration(this.chat, prompt, tools));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Generation failed', { error: err });
      return createErrorResult(err);
    }
  }

  /** Core generation logic */
  private async runGeneration(chat: LlamaChat, prompt: string, tools?: AgentTool[]): Promise<AgentResponse> {
    const effectiveTools = tools ?? this.tools;
    const systemPrompt = this.buildSystemPrompt();
    const functions = agentToolsToChatModelFunctions(effectiveTools);
    const messages: ChatHistoryItem[] = [
      { type: 'system', text: systemPrompt },
      { type: 'user', text: prompt },
    ];

    let tokenCount = 0;
    let charCount = 0;
    let lastLogTime = Date.now();
    const startTime = Date.now();

    const response = await chat.generateResponse(messages, {
      functions,
      temperature: this.config.temperature,
      topP: this.config.topP,
      topK: this.config.topK,
      maxTokens: this.config.maxTokens,
      onToken: () => {
        tokenCount++;
        const now = Date.now();
        if (now - lastLogTime < 30000) return;
        const elapsed = Math.round((now - startTime) / 1000);
        const tokPerSec = (tokenCount / elapsed).toFixed(1);
        logger.info(`AI generating: ${tokenCount} tokens, ${charCount} chars in ${elapsed}s (${tokPerSec} tok/s)`);
        lastLogTime = now;
      },
      onTextChunk: (text: string) => { charCount += text.length; },
    });

    const agentResponse = this.buildAgentResponse(response, tokenCount, charCount, startTime);
    return agentResponse;
  }

  /** Map LlamaChatResponse to AgentResponse with logging */
  private buildAgentResponse(
    response: { response: string; functionCalls?: Array<{ functionName: string; params?: Record<string, unknown> | undefined }> },
    tokenCount: number,
    charCount: number,
    startTime: number,
  ): AgentResponse {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const tokPerSec = elapsed > 0 ? (tokenCount / elapsed).toFixed(1) : '0';
    const agentResponse: AgentResponse = { response: response.response, confidence: 0.8 };

    if (response.functionCalls && response.functionCalls.length > 0) {
      agentResponse.toolCalls = convertFunctionCalls(response.functionCalls);
    }

    logger.info('Generation completed', {
      responseLength: agentResponse.response.length,
      totalTokens: tokenCount,
      totalChars: charCount,
      elapsedSeconds: elapsed,
      tokensPerSecond: tokPerSec,
      toolCallsCount: agentResponse.toolCalls?.length ?? 0,
    });
    return agentResponse;
  }

  /** Build system prompt */
  private buildSystemPrompt(): string {
    return `You are a manga metadata enrichment assistant that merges data from multiple sources.
Your task is to analyze raw provider data, identify gaps and inconsistencies, and use available tools to fetch missing information.

You have access to tools that can fetch data from various manga metadata providers.
Use tools when you need additional data or to verify information.

Respond with clear reasoning and indicate when you are using tools.`;
  }

  /** Clean up resources */
  async dispose(): Promise<void> {
    if (this.chat) {
      if (typeof this.chat.dispose === 'function') await this.chat.dispose();
      this.chat = null;
    }
    if (this.context) {
      if (typeof this.context.dispose === 'function') await this.context.dispose();
      this.context = null;
    }
    if (this.model) { await this.model.dispose(); this.model = null; }
    if (this.llama) { await this.llama.dispose(); this.llama = null; }
    this.isInitialized = false;
    this.llamaModule = null;
    logger.info('Inference service disposed');
  }

  /** Check if service is initialized */
  isReady(): boolean {
    return this.isInitialized;
  }

  /** Get current configuration */
  getConfig(): AIAgentConfig {
    return { ...this.config };
  }
}
