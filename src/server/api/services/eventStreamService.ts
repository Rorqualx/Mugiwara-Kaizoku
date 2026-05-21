/**
 * Event Stream Service
 * 
 * Manages Server-Sent Events (SSE) connections for real-time updates
 */

import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';

// Hook into webhook service to broadcast events
import { webhookService } from './webhookService';

import type { NextApiResponse } from 'next';

export interface EventStreamClient {
  id: string;
  userId: string;
  res: NextApiResponse;
  lastEventId?: string;
  filters?: {
    events?: string[];
    resources?: string[];
  };
}

export interface StreamEvent {
  id: string;
  type: string;
  data: unknown;
  userId?: string;
  timestamp: string;
}

/**
 * EventStreamService class
 * 
 * Manages SSE connections and event broadcasting
 */
export class EventStreamService extends EventEmitter {
  private clients: Map<string, EventStreamClient> = new Map();
  private eventHistory: StreamEvent[] = [];
  private maxHistorySize = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startHeartbeat();
  }

  /**
   * Add a new SSE client
   */
  public addClient(
    userId: string, 
    res: NextApiResponse, 
    filters?: EventStreamClient['filters'],
    lastEventId?: string
  ): string {
    const clientId = randomUUID();
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
    
    // Store client
    const client: EventStreamClient = {
      id: clientId,
      userId,
      res,
      ...(filters !== undefined ? { filters } : {}),
      ...(lastEventId !== undefined ? { lastEventId } : {}),
    };
    
    this.clients.set(clientId, client);
    
    // Send initial connection event
    this.sendToClient(client, {
      id: randomUUID(),
      type: 'connection',
      data: { clientId, message: 'Connected to event stream' },
      timestamp: new Date().toISOString(),
    });
    
    // Send any missed events if lastEventId provided
    if (lastEventId) {
      this.sendMissedEvents(client, lastEventId);
    }
    
    // Handle client disconnect
    res.on('close', () => {
      this.removeClient(clientId);
    });
    
    this.emit('client:connected', { clientId, userId });
    
    return clientId;
  }

  /**
   * Remove a client
   */
  public removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      this.emit('client:disconnected', { clientId, userId: client.userId });
    }
  }

  /**
   * Broadcast an event to all relevant clients
   */
  public broadcast(event: Omit<StreamEvent, 'id' | 'timestamp'>): void {
    const fullEvent: StreamEvent = {
      ...event,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    
    // Store in history
    this.addToHistory(fullEvent);
    
    // Broadcast to relevant clients
    for (const client of this.clients.values()) {
      if (this.shouldSendToClient(client, fullEvent)) {
        this.sendToClient(client, fullEvent);
      }
    }
    
    this.emit('event:broadcast', fullEvent);
  }

  /**
   * Send event to specific user
   */
  public sendToUser(userId: string, event: Omit<StreamEvent, 'id' | 'timestamp' | 'userId'>): void {
    const fullEvent: StreamEvent = {
      ...event,
      id: randomUUID(),
      userId,
      timestamp: new Date().toISOString(),
    };
    
    // Store in history
    this.addToHistory(fullEvent);
    
    // Send to user's clients
    for (const client of this.clients.values()) {
      if (client.userId === userId && this.shouldSendToClient(client, fullEvent)) {
        this.sendToClient(client, fullEvent);
      }
    }
  }

  /**
   * Get connected clients count
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get clients by user
   */
  public getClientsByUser(userId: string): EventStreamClient[] {
    return Array.from(this.clients.values()).filter(client => client.userId === userId);
  }

  /**
   * Send event to specific client
   */
  private sendToClient(client: EventStreamClient, event: StreamEvent): void {
    try {
      const data = [
        `id: ${event["id"]}`,
        `event: ${event.type}`,
        `data: ${JSON.stringify(event.data)}`,
        '', // Empty line to signal end of event
      ].join('\n');

      client.res.write(data + '\n');
      // Update lastEventId on the client record in the Map
      const clientRecord = this.clients.get(client["id"]);
      if (clientRecord) {
        clientRecord.lastEventId = event["id"];
      }
    } catch (_error: unknown) {
      // Client disconnected, remove them
      this.removeClient(client["id"]);
    }
  }

  /**
   * Check if event should be sent to client based on filters
   */
  private shouldSendToClient(client: EventStreamClient, event: StreamEvent): boolean {
    // Check user filter
    if (event.userId && event.userId !== client.userId) {
      return false;
    }
    
    // Check event type filter
    if (client.filters?.events && !client.filters.events.includes(event.type)) {
      return false;
    }
    
    // Check resource filter
    if (client.filters?.resources) {
      const eventResource = event.type.split('.')[0];
      if (eventResource && !client.filters.resources.includes(eventResource)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Send missed events to client
   */
  private sendMissedEvents(client: EventStreamClient, lastEventId: string): void {
    const lastIndex = this.eventHistory.findIndex(e => e["id"] === lastEventId);
    
    if (lastIndex !== -1) {
      // Send all events after the last received one
      const missedEvents = this.eventHistory.slice(lastIndex + 1);
      
      for (const event of missedEvents) {
        if (this.shouldSendToClient(client, event)) {
          this.sendToClient(client, event);
        }
      }
    }
  }

  /**
   * Add event to history
   */
  private addToHistory(event: StreamEvent): void {
    this.eventHistory.push(event);
    
    // Trim history if too large
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Start heartbeat to keep connections alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const heartbeat = `:heartbeat\n\n`;
      
      for (const client of this.clients.values()) {
        try {
          client.res.write(heartbeat);
        } catch (_error: unknown) {
          // Client disconnected, remove them
          this.removeClient(client["id"]);
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  public dispose(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Close all client connections
    for (const client of this.clients.values()) {
      try {
        client.res.end();
      } catch (_error: unknown) {
  // Ignore errors during cleanup
      }
    }
    
    this.clients.clear();
    this.eventHistory = [];
    this.removeAllListeners();
  }
}

// Create singleton instance
export const eventStreamService = new EventStreamService();



// Type guard for webhook event
interface WebhookEvent {
  type: string;
  data: unknown;
  userId?: string;
}

function isWebhookEvent(event: unknown): event is WebhookEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'type' in event &&
    typeof event['type'] === 'string' &&
    'data' in event
  );
}

// Forward webhook events to SSE clients
webhookService.on('event:triggered', (event: unknown) => {
  if (isWebhookEvent(event)) {
    eventStreamService.broadcast({
      type: event.type,
      data: event.data,
      ...(event.userId !== undefined ? { userId: event.userId } : {}),
    });
  }
});