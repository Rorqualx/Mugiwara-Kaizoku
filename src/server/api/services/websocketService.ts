/**
 * WebSocket Service - Re-export Module
 *
 * This file re-exports the decomposed WebSocket service for backward compatibility.
 * The actual implementation has been split into focused modules in the
 * `websocket-service/` directory.
 *
 * @module server/api/services/websocketService
 * @see ./websocket-service/index.ts for the main implementation
 */

// Re-export everything from the decomposed modules
export * from './websocket-service';
export { websocketService, WebSocketService } from './websocket-service';
