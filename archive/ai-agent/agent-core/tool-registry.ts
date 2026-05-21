/**
 * Agent Tool Registry
 *
 * Manages registration, discovery, and execution of agent tools.
 * Integrates with existing rate limiting and caching infrastructure.
 */

import { createSuccessResult, createErrorResult, isError, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';
import { ProviderRateLimiter } from '@/utils/rate-limiter';
import { SimpleCache } from '@/utils/simple-cache';

import type { AgentTool } from './types';

// ============================================================================
// Tool Registry Class
// ============================================================================

export class ToolRegistry {
  private static instance: ToolRegistry | null = null;
  private tools: Map<string, AgentTool> = new Map();
  private rateLimiter: ProviderRateLimiter;
  private cache: SimpleCache<unknown>;

  private constructor() {
    this.rateLimiter = ProviderRateLimiter.getInstance();
    this.cache = new SimpleCache<unknown>();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ToolRegistry {
    ToolRegistry.instance ??= new ToolRegistry();
    return ToolRegistry.instance;
  }

  /**
   * Register a tool with the registry
   */
  registerTool(tool: AgentTool): AsyncResult<void, Error> {
    if (this.tools.has(tool.name)) {
      return createErrorResult(new Error(`Tool '${tool.name}' is already registered`));
    }

    this.tools.set(tool.name, tool);
    logger.info(`Tool registered: ${tool.name}`);
    return createSuccessResult(undefined);
  }

  /**
   * Register multiple tools
   */
  registerTools(tools: AgentTool[]): AsyncResult<void, Error> {
    for (const tool of tools) {
      const result = this.registerTool(tool);
      if (isError(result)) {
        return result;
      }
    }
    return createSuccessResult(undefined);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): AsyncResult<AgentTool, Error> {
    const tool = this.tools.get(name);
    if (!tool) {
      return createErrorResult(new Error(`Tool '${name}' not found`));
    }
    return createSuccessResult(tool);
  }

  /**
   * List all registered tools
   */
  listTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Execute a tool with rate limiting and caching
   */
  async executeTool(
    toolName: string,
    params: unknown,
    options: {
      provider?: string;
      cacheKey?: string;
      cacheTtlSeconds?: number;
      priority?: number;
    } = {}
  ): Promise<AsyncResult<unknown, Error>> {
    // 1. Get the tool
    const toolResult = this.getTool(toolName);
    if (isError(toolResult)) {
      return createErrorResult(toolResult.error);
    }
    if (!isSuccess(toolResult)) {
      return createErrorResult(new Error(`Tool result in unexpected state: ${toolResult.status}`));
    }
    const tool = toolResult.data;

    // 2. Check cache if cacheKey provided
    if (options.cacheKey) {
      const cached = this.cache.get(options.cacheKey);
      if (cached !== undefined) {
        logger.debug(`Cache hit for tool ${toolName}, key: ${options.cacheKey}`);
        return createSuccessResult(cached);
      }
    }

    // 3. Execute with rate limiting if provider specified
    try {
      let toolResult: AsyncResult<unknown, Error>;
      if (options.provider) {
        const rateLimitOptions: { priority?: number; id?: string } = {};
        if (options.priority !== undefined) {
          rateLimitOptions.priority = options.priority;
        }
        toolResult = await this.rateLimiter.execute(
          options.provider,
          () => tool.execute(params),
          rateLimitOptions
        );
      } else {
        toolResult = await tool.execute(params);
      }

      // 4. Check if tool execution returned success or error
      if (isError(toolResult)) {
        return createErrorResult(toolResult.error);
      }
      if (!isSuccess(toolResult)) {
        return createErrorResult(new Error(`Tool result in unexpected state: ${toolResult.status}`));
      }
      const result = toolResult.data;

      // 5. Cache result if cacheKey provided
      if (options.cacheKey && options.cacheTtlSeconds) {
        this.cache.set(
          options.cacheKey,
          result,
          options.cacheTtlSeconds * 1000 // Convert seconds to milliseconds
        );
      }

      return createSuccessResult(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Tool execution failed: ${toolName}`, { error: err, params });
      return createErrorResult(err);
    }
  }

  /**
   * Execute multiple tools in parallel
   */
  async executeTools(
    toolCalls: Array<{
      name: string;
      arguments: unknown;
      options?: {
        provider?: string;
        cacheKey?: string;
        cacheTtlSeconds?: number;
        priority?: number;
      };
    }>
  ): Promise<Array<AsyncResult<unknown, Error>>> {
    const promises = toolCalls.map(async (call) => {
      return this.executeTool(
        call.name,
        call.arguments,
        call.options ?? {}
      );
    });

    return Promise.all(promises);
  }

  /**
   * Validate tool parameters against schema
   */
  validateToolParameters(
    toolName: string,
    params: unknown
  ): AsyncResult<unknown, Error> {
    // TODO: Implement proper schema validation
    // For now, just pass through
    return createSuccessResult(params);
  }

  /**
   * Clear all tools (for testing)
   */
  clear(): void {
    this.tools.clear();
    logger.info('Tool registry cleared');
  }

  /**
   * Get tool count
   */
  getToolCount(): number {
    return this.tools.size;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get the tool registry instance
 */
export function getToolRegistry(): ToolRegistry {
  return ToolRegistry.getInstance();
}

/**
 * Register a tool (convenience wrapper)
 */
export function registerTool(tool: AgentTool): AsyncResult<void, Error> {
  return getToolRegistry().registerTool(tool);
}

/**
 * Execute a tool (convenience wrapper)
 */
export async function executeTool(
  toolName: string,
  params: unknown,
  options?: {
    provider?: string;
    cacheKey?: string;
    cacheTtlSeconds?: number;
    priority?: number;
  }
): Promise<AsyncResult<unknown, Error>> {
  return getToolRegistry().executeTool(toolName, params, options);
}