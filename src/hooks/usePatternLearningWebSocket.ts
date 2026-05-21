/**
 * Pattern Learning WebSocket Hook
 *
 * Extracted WebSocket logic for real-time learning updates from usePatternLearning hook.
 * Handles WebSocket connection and message processing for pattern learning status.
 */

import { useEffect } from 'react';

import { notify } from '@/utils/notify';

import { isString, asNumber, asString } from '../utils/type-guards';

interface WebSocketMessage {
  type: string;
  pattern?: string;
  progress?: number;
  message?: string;
  patternId?: string;
  version?: number;
}

interface LearningStatus {
  isLearning: boolean;
  progress: number;
  currentPattern: string | null;
}

// Type guard for WebSocket messages
function isWebSocketMessage(value: unknown): value is WebSocketMessage {
  return typeof value === 'object' && value !== null && 'type' in value && isString((value as Record<string, unknown>)['type']);
}

interface UsePatternLearningWebSocketParams {
  setLearningStatus: (status: LearningStatus | ((prev: LearningStatus) => LearningStatus)) => void;
}

/**
 * Custom hook that handles WebSocket connection for real-time pattern learning updates
 *
 * @param setLearningStatus - Function to update learning status state
 */
export const usePatternLearningWebSocket = ({
  setLearningStatus
}: UsePatternLearningWebSocketParams): void => {
  useEffect(() => {
    // Create WebSocket connection
    const ws = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/pattern-recognition/ws`
    );

    // Handle incoming WebSocket messages
    ws.onmessage = (event) => {
      const rawData: unknown = JSON.parse(asString(event.data));

      if (!isWebSocketMessage(rawData)) {
        console.error('Invalid WebSocket message format');
        return;
      }

      const data = rawData;

      switch (data.type) {
        case 'learning-started':
          setLearningStatus({
            isLearning: true,
            progress: 0,
            currentPattern: asString(data.pattern, '')
          });
          break;

        case 'learning-progress':
          setLearningStatus((prev) => ({
            ...prev,
            progress: asNumber(data.progress, 0)
          }));
          break;

        case 'learning-complete':
          setLearningStatus({
            isLearning: false,
            progress: 100,
            currentPattern: null
          });

          notify({ severity: 'SUCCESS', title: 'Learning Complete', message: asString(data.message, 'Learning completed successfully') });
          break;

        case 'pattern-evolved':
          notify({ severity: 'INFO', title: 'Pattern Evolved', message: `Pattern ${asString(data.patternId, 'unknown')} has evolved to version ${asNumber(data.version, 1)}` });
          break;

        default:
          console.warn('Unknown WebSocket message type:', data.type);
          break;
      }
    };

    // Cleanup: null handlers before closing to prevent post-close invocations
    return () => {
      ws.onmessage = null;
      ws.onerror = null;
      ws.onopen = null;
      ws.onclose = null;
      ws.close();
    };
  }, [setLearningStatus]);
};
