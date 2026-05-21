/**
 * API Call monitoring and visualization system
 *
 * This module provides components and utilities for tracking and displaying
 * API call information in real-time. Features include:
 * - API call tracking and monitoring
 * - Real-time status updates
 * - Visual call history
 * - Data formatting and display
 *
 * @remarks
 * System Components:
 * - ApiCallAlert: Visual component for displaying call history
 * - ApiCallStore: Global state management for API calls
 * - trackApiCall: Utility function for tracking API calls
 */
import React from "react";
import { useState, useEffect } from 'react';

import { Box, Text, Paper, ScrollArea, Badge, Group, Stack, Transition } from '@mantine/core';
/**
 * Interface for API call information
 */
export interface ApiCallInfo {
    /** Unique identifier for the API call */
    id: string;
    /** Timestamp when the call was initiated */
    timestamp: Date;
    /** API endpoint that was called */
    endpoint: string;
    /**
     * Current status of the API call
     * IMPORTANT: These API call statuses are distinct from the TaskStatus enum values
     * They represent the state of HTTP requests, not background tasks
     */
    status: 'pending' | 'success' | 'error';
    /** Response data (for successful calls) */
    data?: unknown;
    /** Error message (for failed calls) */
    error?: string;
}
/**
 * Global store for managing API call information
 *
 * @remarks
 * Features:
 * - Add new API calls
 * - Update existing call status
 * - Subscribe to store changes
 * - Maintain call history (last 20 calls)
 */
/**
 * Store class for managing API call history and state
 */
class ApiCallStore {
    /** Internal array of API call records */
    private calls: ApiCallInfo[] = [];
    private listeners: (() => void)[] = [];
    /**
     * Add a new API call to the store
     * @param call - Call information without id and timestamp
     * @returns Generated call ID
     */
    addCall(call: Omit<ApiCallInfo, 'id' | 'timestamp'>): string {
        const newCall: ApiCallInfo = {
            ...call,
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date()
        };
        this.calls = [newCall, ...this.calls].slice(0, 20); // Keep only the last 20 calls
        this.notifyListeners();
        return newCall["id"];
    }
    /**
     * Update an existing API call's information
     * @param id - Call ID to update
     * @param updates - Partial call information to update
     */
    updateCall(id: string, updates: Partial<ApiCallInfo>): void {
        this.calls = this.calls.map((call) => call["id"] === id ? { ...call, ...updates } : call);
        this.notifyListeners();
    }
    /**
     * Get all stored API calls
     * @returns Copy of the calls array
     */
    getCalls(): ApiCallInfo[] {
        return [...this.calls];
    }
    /**
     * Subscribe to store updates
     * @param listener - Callback function for updates
     * @returns Unsubscribe function
     */
    subscribe(listener: () => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }
    /**
     * Notify all subscribers of store changes
     */
    private notifyListeners(): void {
        this.listeners.forEach((listener) => listener());
    }
}
/** Singleton instance of the API call store */
export const apiCallStore = new ApiCallStore();
/**
 * Helper function to track API calls
 * @param endpoint - API endpoint being called
 * @param promise - Promise of the API call
 * @returns Promise with the API response
 */
export function trackApiCall<T>(endpoint: string, promise: Promise<T>): Promise<T> {
    const callId = apiCallStore.addCall({
        endpoint,
        status: 'pending'
    });
    return promise.
        then((data) => {
        apiCallStore.updateCall(callId, {
            status: 'success',
            data
        });
        return data;
    }).
        catch((error) => {
        apiCallStore.updateCall(callId, {
            status: 'error',
            error: (error instanceof Error ? error.message : String(error)) || 'Unknown error'
        });
        throw error;
    });
}
/**
 * Component for displaying API call information
 *
 * Provides a real-time monitor of API calls with status indicators,
 * response data, and error messages in a floating overlay.
 */
export function ApiCallAlert(): React.JSX.Element {
    const [calls, setCalls] = useState<ApiCallInfo[]>([]);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        // Subscribe to store updates
        const unsubscribe = apiCallStore.subscribe(() => {
            const latestCalls = apiCallStore.getCalls();
            setCalls(latestCalls);
            // Show the alert when there are calls
            if (latestCalls.length > 0) {
                setVisible(true);
            }
        });
        return unsubscribe;
    }, []);
    // Interface for manga data structure
    interface MangaData {
        title?: string;
        metadata?: {
            volumes?: number | string;
            chapters?: number | string;
        };
        chapters?: Array<unknown>;
    }
    // Type guard for manga data
    const isMangaData = (obj: unknown): obj is MangaData => {
        if (!obj || typeof obj !== 'object')
            return false;
        const data = obj as Record<string, unknown>;
        return ('metadata' in data &&
            data["metadata"] !== null &&
            typeof data["metadata"] === 'object' && ('volumes' in (data["metadata"] as Record<string, unknown>) ||
            'chapters' in (data["metadata"] as Record<string, unknown>)));
    };
    // Format data for display
    const formatData = (data: unknown): string => {
        if (!data)
            return 'No data';
        try {
            // Check if data is an object
            if (typeof data === 'object') {
                // Special handling for manga data to highlight volume and chapter info
                if (isMangaData(data)) {
                    return `Manga: ${data["title"] ?? 'Untitled'}\nVolumes: ${data["metadata"]?.volumes ?? 'N/A'}\nChapters: ${data["metadata"]?.chapters ?? 'N/A'}\nChapters Array Length: ${data["chapters"]?.length ?? 0}`;
                }
                // For arrays, show length and first item
                if (Array.isArray(data)) {
                    const preview = data.length > 0 ? JSON.stringify(data[0], null, 2) : 'Empty array';
                    return `Array (${data.length} items)\nFirst item: ${preview}`;
                }
                // For objects, stringify with formatting
                return JSON.stringify(data, null, 2);
            }
            // For primitive values, convert to string
            return String(data);
        }
        catch (_e: unknown) {
return 'Error formatting data';
        }
    };
    return (<Transition mounted={visible} transition="slide-up" duration={400}>
      {(styles) => <Paper shadow="md" p="md" style={{
                ...styles,
                position: 'fixed',
                bottom: 100, // Position higher up to be above other alerts
                left: 20,
                zIndex: 1100, // Higher z-index to ensure it's above other alerts
                maxWidth: '400px',
                maxHeight: '300px',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>

          <Text size="sm" fw={700} c="white" mb="xs">API Call Monitor</Text>
          
          <ScrollArea h={250} scrollbarSize={6}>
            <Stack gap="xs">
              {calls.map((call) => <Box key={call["id"]} p="xs" style={{
                    borderLeft: `3px solid ${call["status"] === 'success' ? 'var(--mantine-color-green-6)' :
                        call["status"] === 'error' ? 'var(--mantine-color-red-6)' :
                            'var(--mantine-color-blue-6)'}`,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '4px'
                }}>

                  <Group justify="space-between" mb="xs">
                    <Text size="xs" c="dimmed">
                      {call.timestamp.toLocaleTimeString()}
                    </Text>
                    <Badge size="xs" color={call["status"] === 'success' ? 'green' :
                    call["status"] === 'error' ? 'red' :
                        'blue'}>

                      {call["status"]}
                    </Badge>
                  </Group>
                  
                  <Text size="xs" fw={600} c="white" mb="xs">
                    {call.endpoint}
                  </Text>
                  
                  {call["status"] === 'success' && call.data !== null &&
                    <Box p="xs" style={{
                            backgroundColor: 'rgba(0, 0, 0, 0.3)',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            fontSize: '10px',
                            whiteSpace: 'pre-wrap',
                            color: 'var(--mantine-color-gray-4)',
                            maxHeight: '100px',
                            overflow: 'auto'
                        }}>

                      {/* Convert unknown data to string using formatData */}
                      <Text size="xs">{call.data !== undefined ? formatData(call.data) : 'No data'}</Text>
                    </Box>}
                  
                  {call["status"] === 'error' && call.error &&
                    <Text size="xs" c="red" mt="xs">
                      {call.error}
                    </Text>}
                </Box>)}
            </Stack>
          </ScrollArea>
        </Paper>}
    </Transition>);
}
