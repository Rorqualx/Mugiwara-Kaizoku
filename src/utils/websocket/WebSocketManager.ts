/**
 * WebSocket Connection Manager
 *
 * A utility class for managing WebSocket connections with robust error handling,
 * automatic reconnection, and status tracking.
 *
 * Features:
 * - Connection status monitoring
 * - Automatic reconnection with exponential backoff
 * - Event emitters for connection state changes
 * - Message handling and queuing
 * - Error handling and reporting
 */
import { EventEmitter } from 'events';

import { getErrorMessage } from '@/utils/errors/helpers';
import { logger } from '@/utils/logger';
/**
 * WebSocket connection states
 */
export enum ConnectionState {
    DISCONNECTED = 'disconnected',
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    RECONNECTING = 'reconnecting',
    ERROR = 'error',
    CLOSED = 'closed'
}
/**
 * WebSocket connection events
 */
export enum ConnectionEvent {
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected',
    RECONNECTING = 'reconnecting',
    MESSAGE = 'message',
    ERROR = 'error',
    CLOSED = 'closed',
    STATUS_CHANGED = 'status_changed'
}
/**
 * Connection options for WebSocketManager
 */
export interface ConnectionOptions {
    /** Auto reconnect when connection is lost */
    autoReconnect?: boolean;
    /** Maximum number of reconnection attempts */
    maxReconnectAttempts?: number;
    /** Base delay between reconnect attempts in ms */
    reconnectDelay?: number;
    /** Maximum delay between reconnect attempts in ms */
    maxReconnectDelay?: number;
    /** Connection timeout in ms */
    connectionTimeout?: number;
    /** Heartbeat interval in ms */
    heartbeatInterval?: number;
    /** Heartbeat message */
    heartbeatMessage?: string | Record<string, unknown>;
}
/**
 * WebSocket connection manager
 *
 * Manages WebSocket connections with status tracking, automatic reconnection,
 * and event handling.
 */
export class WebSocketManager extends EventEmitter {
    private url: string;
    private socket: WebSocket | null = null;
    private state: ConnectionState = ConnectionState.DISCONNECTED;
    private reconnectAttempts: number = 0;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private connectionTimer: NodeJS.Timeout | null = null;
    private options: Required<ConnectionOptions>;
    private messageQueue: (string | Record<string, unknown>)[] = [];
    /**
     * Default connection options
     */
    private static readonly DEFAULT_OPTIONS: Required<ConnectionOptions> = {
        autoReconnect: true,
        maxReconnectAttempts: 10,
        reconnectDelay: 1000,
        maxReconnectDelay: 30000,
        connectionTimeout: 10000,
        heartbeatInterval: 30000,
        heartbeatMessage: { type: 'ping' }
    };
    /**
     * Creates a new WebSocketManager
     *
     * @param {string} url - WebSocket URL
     * @param {ConnectionOptions} options - Connection options
     */
    constructor(url: string, options: ConnectionOptions = {}) {
        super();
        this.url = url;
        this.options = { ...WebSocketManager.DEFAULT_OPTIONS, ...options };
    }
    /**
     * Gets the current connection state
     *
     * @returns {ConnectionState} Current connection state
     */
    public getState(): ConnectionState {
        return this.state;
    }
    /**
     * Connects to the WebSocket server
     *
     * @returns {Promise<boolean>} Promise that resolves when connected
     */
    public connect(): Promise<boolean> {
        if (this.socket && (this.state === ConnectionState.CONNECTED || this.state === ConnectionState.CONNECTING)) {
            return Promise.resolve(true);
        }
        this.setState(ConnectionState.CONNECTING);
        return new Promise((resolve, reject) => {
            try {
                this.socket = new WebSocket(this.url);
                // Set up connection timeout
                this.connectionTimer = setTimeout(() => {
                    if (this.state !== ConnectionState.CONNECTED) {
                        const error = new Error(`Connection timeout after ${this.options.connectionTimeout}ms`);
                        this.handleError(error);
                        reject(error);
                    }
                }, this.options.connectionTimeout);
                // Set up event handlers
                this.socket.onopen = () => this.handleOpen(resolve);
                this.socket.onclose = event => this.handleClose(event);
                this.socket.onerror = event => this.handleError(event);
                this.socket.onmessage = event => this.handleMessage(event);
            }
            catch (error: unknown) {
                // Convert the unknown error to an Error object before passing to handleError
                const errorObj = error instanceof Error ? error : new Error(String(error));
                this.handleError(errorObj);
                reject(errorObj);
            }
        });
    }
    /**
     * Disconnects from the WebSocket server
     */
    public disconnect(): void {
        this.cleanup();
        if (this.socket) {
            try {
                this.socket.close(1000, 'Client disconnected');
            }
            catch (error: unknown) {
                const errorMessage = getErrorMessage(error);
                logger.error('Error closing WebSocket:', errorMessage);
            }
            this.socket = null;
        }
        this.setState(ConnectionState.DISCONNECTED);
    }
    /**
     * Sends a message to the WebSocket server
     *
     * @param {string | object} message - Message to send
     * @returns {boolean} True if sent successfully, false otherwise
     */
    public send(message: string | Record<string, unknown>): boolean {
        if (!this.socket || this.state !== ConnectionState.CONNECTED) {
            // Queue message for later sending
            this.messageQueue.push(message);
            return false;
        }
        try {
            const formattedMessage = typeof message === 'string'
                ? message
                : JSON.stringify(message);
            this.socket.send(formattedMessage);
            return true;
        }
        catch (error: unknown) {
            const errorMessage = getErrorMessage(error);
            logger.error('Error sending message:', errorMessage);
            return false;
        }
    }
    /**
     * Reconnects to the WebSocket server
     *
     * @returns {Promise<boolean>} Promise that resolves when reconnected
     */
    private reconnect(): Promise<boolean> {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
            this.setState(ConnectionState.ERROR);
            this.emit(ConnectionEvent.ERROR, new Error('Maximum reconnection attempts reached'));
            return Promise.resolve(false);
        }
        this.reconnectAttempts++;
        this.setState(ConnectionState.RECONNECTING);
        // Calculate delay with exponential backoff
        const delay = Math.min(this.options.reconnectDelay * Math.pow(1.5, this.reconnectAttempts), this.options.maxReconnectDelay);
        return new Promise(resolve => {
            this.reconnectTimer = setTimeout(() => {
                this.connect()
                    .then(connected => resolve(connected))
                    .catch(() => resolve(false));
            }, delay);
        });
    }
    /**
     * Handles WebSocket open event
     *
     * @param {Function} resolve - Promise resolve function
     */
    private handleOpen(resolve: (value: boolean) => void): void {
        if (this.connectionTimer) {
            clearTimeout(this.connectionTimer);
            this.connectionTimer = null;
        }
        this.reconnectAttempts = 0;
        this.setState(ConnectionState.CONNECTED);
        // Start heartbeat
        this.startHeartbeat();
        // Send any queued messages
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message)
                this.send(message);
        }
        resolve(true);
    }
    /**
     * Handles WebSocket close event
     *
     * @param {CloseEvent} event - Close event
     */
    private handleClose(event: CloseEvent): void {
        this.cleanup();
        // Don't attempt to reconnect on normal closure
        if (event.code === 1000 || event.code === 1001) {
            this.setState(ConnectionState.CLOSED);
            this.emit(ConnectionEvent.CLOSED, event);
            return;
        }
        this.setState(ConnectionState.DISCONNECTED);
        if (this.options.autoReconnect) {
            void this.reconnect();
        }
    }
    /**
     * Handles WebSocket error event
     *
     * @param {Event | Error} event - Error event or Error object
     */
    private handleError(event: Event | Error): void {
        this.cleanup();
        const error = event instanceof Error ? event : new Error('WebSocket error');
        this.setState(ConnectionState.ERROR);
        this.emit(ConnectionEvent.ERROR, error);
        if (this.options.autoReconnect) {
            void this.reconnect();
        }
    }
    /**
 * Handles WebSocket message event
 * 
 * Security considerations:
 * - Validates message structure before processing
 * - Sanitizes data to prevent prototype pollution attacks
 * - Logs invalid messages for monitoring
 *
 * @param {MessageEvent} event - Message event from WebSocket
 */
private handleMessage(event: MessageEvent): void {
    try {
        let data: unknown = event.data;

        // Attempt to parse JSON if data is a string
        // Remove the startsWith check as it's too restrictive
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data) as unknown;
            } catch {
                // Keep as string if parsing fails
                // This could be intentional (plain text messages)
            }
        }

        // SECURITY: Validate message structure before emitting
        // Prevents malformed/malicious data from reaching listeners
        if (!this.isValidMessage(data)) {
            logger.warn('Invalid message format received', data);
            return; // Reject invalid messages
        }

        // SECURITY: Sanitize to prevent prototype pollution
        // Remove dangerous keys like __proto__, constructor, prototype
        const sanitized = this.sanitizeData(data);

        // Emit the validated and sanitized message
        this.emit(ConnectionEvent.MESSAGE, sanitized);
    } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        logger.error('Error handling WebSocket message:', errorMessage);
    }
}

/**
 * Validates that a message has the expected structure
 * 
 * @param {unknown} data - Data to validate
 * @returns {boolean} True if message is valid
 * 
 * @example
 * // Define your expected message structure
 * isValidMessage({type: 'update', payload: {...}}) // true
 * isValidMessage(null) // false
 * isValidMessage("random string") // false
 */
private isValidMessage(data: unknown): boolean {
    // Basic validation - adjust based on your protocol
    if (typeof data !== 'object' || data === null) {
        return false;
    }
    
    // Type assertion after null check
    const message = data as Record<string, unknown>;
    
    // Example: Require specific fields based on your WebSocket protocol
    // Adjust this validation logic to match your message structure
    if (!('type' in message)) {
        return false;
    }
    
    // Add more validation rules as needed for your use case
    // e.g., check for required fields, validate types, etc.
    
    return true;
}

/**
 * Sanitizes data to prevent prototype pollution attacks
 * 
 * Prototype pollution occurs when an attacker can inject properties
 * like __proto__, constructor, or prototype into objects, potentially
 * affecting all objects in the application.
 * 
 * @param {unknown} data - Data to sanitize
 * @returns {unknown} Sanitized data with dangerous keys removed
 * 
 * @example
 * sanitizeData({__proto__: {isAdmin: true}, name: "Alice"})
 * // Returns: {name: "Alice"}
 */
private sanitizeData(data: unknown): unknown {
    // Non-objects don't have prototype pollution risk
    if (typeof data !== 'object' || data === null) {
        return data;
    }
    
    // Type assertion for object manipulation
    const obj = data as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    
    // Copy only safe keys to new object
    for (const key of Object.keys(obj)) {
        // SECURITY: Block dangerous property names that could modify prototypes
        // __proto__: Direct prototype manipulation
        // constructor: Access to constructor function
        // prototype: Modification of prototype chain
        if (['__proto__', 'constructor', 'prototype'].includes(key)) {
            logger.warn(`Blocked dangerous property: ${key}`);
            continue; // Skip this property
        }
        
        // Copy safe properties
        // Note: For deep objects, you might want recursive sanitization
        sanitized[key] = obj[key];
    }
    
    return sanitized;
}
    /**
     * Starts heartbeat timer
     */
    private startHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        this.heartbeatTimer = setInterval(() => {
            if (this.state === ConnectionState.CONNECTED) {
                this.send(this.options.heartbeatMessage);
            }
        }, this.options.heartbeatInterval);
    }
    /**
     * Cleans up timers and resources
     */
    private cleanup(): void {
        if (this.connectionTimer) {
            clearTimeout(this.connectionTimer);
            this.connectionTimer = null;
        }
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    /**
     * Sets the connection state and emits events
     *
     * @param {ConnectionState} state - New connection state
     */
    private setState(state: ConnectionState): void {
        const oldState = this.state;
        this.state = state;
        if (oldState !== state) {
            this.emit(ConnectionEvent.STATUS_CHANGED, state, oldState);
            // Emit specific events
            switch (state) {
                case ConnectionState.CONNECTED:
                    this.emit(ConnectionEvent.CONNECTED);
                    break;
                case ConnectionState.DISCONNECTED:
                    this.emit(ConnectionEvent.DISCONNECTED);
                    break;
                case ConnectionState.RECONNECTING:
                    this.emit(ConnectionEvent.RECONNECTING, this.reconnectAttempts);
                    break;
                case ConnectionState.CONNECTING:
                case ConnectionState.ERROR:
                case ConnectionState.CLOSED:
                    // No specific event for these states
                    break;
                default:
                    // Exhaustive check for unknown states
                    break;
            }
        }
    }
    /**
     * Disposes of the WebSocket manager
     */
    public dispose(): void {
        this.disconnect();
        this.removeAllListeners();
    }
}
/**
 * Creates a WebSocketManager
 *
 * @param {string} url - WebSocket URL
 * @param {ConnectionOptions} options - Connection options
 * @returns {WebSocketManager} New WebSocketManager instance
 */
export const createWebSocketManager = (url: string, options?: ConnectionOptions): WebSocketManager => {
    return new WebSocketManager(url, options);
};
