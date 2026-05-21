/**
 * Agent Memory Manager
 *
 * Manages conversation history and context for the AI agent.
 * Provides short-term memory for tool calls and reasoning steps.
 */

import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { AgentResponse, ProviderDataContext, ToolCall } from './types';

// ============================================================================
// Memory Types
// ============================================================================

interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolResults?: Array<{
    tool: string;
    result: unknown;
    success: boolean;
    timestamp: number;
  }>;
}

interface MemorySession {
  sessionId: string;
  mangaId: number;
  turns: ConversationTurn[];
  context: ProviderDataContext;
  createdAt: number;
  lastAccessed: number;
  tokenCount: number;
}

// ============================================================================
// Memory Manager Class
// ============================================================================

export class MemoryManager {
  private static instance: MemoryManager | null = null;
  private sessions: Map<string, MemorySession> = new Map();
  private maxTokensPerSession: number;
  private maxTurnsPerSession: number;
  private sessionTimeoutMs: number;

  private constructor() {
    this.maxTokensPerSession = 4000; // Budget for Qwen3.5-2B context
    this.maxTurnsPerSession = 20;
    this.sessionTimeoutMs = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MemoryManager {
    MemoryManager.instance ??= new MemoryManager();
    return MemoryManager.instance;
  }

  /**
   * Create a new memory session for manga enrichment
   */
  createSession(
    mangaId: number,
    context: ProviderDataContext
  ): AsyncResult<string, Error> {
    const sessionId = `manga-${mangaId}-${Date.now()}`;

    const session: MemorySession = {
      sessionId,
      mangaId,
      turns: [],
      context,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      tokenCount: 0,
    };

    this.sessions.set(sessionId, session);
    logger.info(`Memory session created: ${sessionId}`);

    return createSuccessResult(sessionId);
  }

  /**
   * Add a user message to session
   */
  addUserMessage(
    sessionId: string,
    message: string
  ): AsyncResult<void, Error> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return createErrorResult(new Error(`Session ${sessionId} not found`));
    }

    session.turns.push({
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });

    session.lastAccessed = Date.now();
    // TODO: Update token count
    // session.tokenCount += estimateTokens(message);

    return createSuccessResult(undefined);
  }

  /**
   * Add an assistant response to session
   */
  addAssistantResponse(
    sessionId: string,
    response: AgentResponse
  ): AsyncResult<void, Error> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return createErrorResult(new Error(`Session ${sessionId} not found`));
    }

    const turn: ConversationTurn = {
      role: 'assistant',
      content: response.response,
      timestamp: Date.now(),
    };
    if (response.toolCalls !== undefined) {
      turn.toolCalls = response.toolCalls;
    }
    session.turns.push(turn);

    session.lastAccessed = Date.now();
    // TODO: Update token count

    return createSuccessResult(undefined);
  }

  /**
   * Add tool results to the last assistant turn
   */
  addToolResults(
    sessionId: string,
    toolResults: Array<{
      tool: string;
      result: unknown;
      success: boolean;
    }>
  ): AsyncResult<void, Error> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return createErrorResult(new Error(`Session ${sessionId} not found`));
    }

    const lastTurn = session.turns[session.turns.length - 1];
    if (lastTurn?.role !== 'assistant') {
      return createErrorResult(new Error('No assistant turn to add tool results to'));
    }

    lastTurn.toolResults = toolResults.map(result => ({
      ...result,
      timestamp: Date.now(),
    }));

    session.lastAccessed = Date.now();
    return createSuccessResult(undefined);
  }

  /**
   * Get conversation history for a session
   */
  getConversationHistory(sessionId: string): AsyncResult<ConversationTurn[], Error> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return createErrorResult(new Error(`Session ${sessionId} not found`));
    }

    return createSuccessResult([...session.turns]);
  }

  /**
   * Build context prompt from session history
   */
  buildContextPrompt(sessionId: string): AsyncResult<string, Error> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return createErrorResult(new Error(`Session ${sessionId} not found`));
    }

    const contextSummary = this.buildContextSummary(session.context);
    const conversationHistory = this.buildConversationHistory(session.turns);
    const prompt = `Context: ${contextSummary}\n\nConversation History:\n${conversationHistory}`;

    return createSuccessResult(prompt);
  }

  /**
   * Build conversation history string
   */
  private buildConversationHistory(turns: ConversationTurn[]): string {
    return turns.map(turn => this.formatConversationTurn(turn)).join('\n\n');
  }

  /**
   * Format a single conversation turn
   */
  private formatConversationTurn(turn: ConversationTurn): string {
    let line = `${turn.role}: ${turn.content}`;

    if (turn.toolCalls?.length) {
      line += `\nTool calls: ${JSON.stringify(turn.toolCalls)}`;
    }

    if (turn.toolResults?.length) {
      const simplifiedResults = turn.toolResults.map(tr => ({
        tool: tr.tool,
        success: tr.success,
      }));
      line += `\nTool results: ${JSON.stringify(simplifiedResults)}`;
    }

    return line;
  }

  /**
   * Build summary of provider data context
   */
  private buildContextSummary(context: ProviderDataContext): string {
    const { mangaId, title, rawProviderData, enrichmentMaps } = context;

    const providerCount = Object.keys(rawProviderData).length;
    const chapterCount = Object.keys(enrichmentMaps?.chapterTitleMap ?? {}).length;
    const volumeCount = Object.keys(enrichmentMaps?.volumeDescriptionMap ?? {}).length;
    const providerNames = Object.keys(rawProviderData).join(', ');

    return `Manga: ${title} (ID: ${mangaId})
Providers: ${providerCount}
Chapters with data: ${chapterCount}
Volumes with data: ${volumeCount}

Raw data available from: ${providerNames}`;
  }

  /**
   * Check if session has exceeded token limit
   */
  isSessionOverLimit(sessionId: string): AsyncResult<boolean, Error> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return createErrorResult(new Error(`Session ${sessionId} not found`));
    }

    const overTokenLimit = session.tokenCount > this.maxTokensPerSession;
    const overTurnLimit = session.turns.length > this.maxTurnsPerSession;

    return createSuccessResult(overTokenLimit || overTurnLimit);
  }

  /**
   * Clean up old sessions
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastAccessed > this.sessionTimeoutMs) {
        this.sessions.delete(sessionId);
        cleaned++;
        logger.debug(`Cleaned up stale session: ${sessionId}`);
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} stale memory sessions`);
    }

    return cleaned;
  }

  /**
   * Get session by manga ID
   */
  getSessionByMangaId(mangaId: number): MemorySession | null {
    for (const session of this.sessions.values()) {
      if (session.mangaId === mangaId) {
        return session;
      }
    }
    return null;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Get active session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get memory manager instance
 */
export function getMemoryManager(): MemoryManager {
  return MemoryManager.getInstance();
}