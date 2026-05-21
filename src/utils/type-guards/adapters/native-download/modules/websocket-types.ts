/**
 * WebSocket Type Guards
 *
 * This module contains type guards for validating WebSocket message objects,
 * ensuring type safety for real-time communication.
 *
 * @module WebSocketTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  AuthMessage,
  SubscribeMessage,
  DownloadProgressMessage,
  TaskUpdateMessage,
  ErrorMessage,
  WebSocketClientOptions,
  WebSocketEventMap,
  WebSocketClient,
  SubscriptionOptions,
  PresenceData,
  ScanProgressMessage,
  NotificationMessage,
  SystemStatusMessage,
  JobStatusMessage,
  MangaUpdateMessage,
  ChapterUpdateMessage,
  VolumeUpdateMessage
} from "@/types/api/v1/websocket";

/**
 * Type guard for AuthMessage
 * Validates that an object conforms to the AuthMessage interface
 */
export function isAuthMessage(obj: unknown): obj is AuthMessage {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "type" in candidate &&
    "data" in candidate
  );
}

/**
 * Type guard for SubscribeMessage
 * Validates that an object conforms to the SubscribeMessage interface
 */
export function isSubscribeMessage(obj: unknown): obj is SubscribeMessage {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "type" in candidate &&
    "channels" in candidate &&
    Array.isArray(candidate["channels"]) &&
    candidate["channels"].every((x: unknown) => typeof x === "string")
  );
}

/**
 * Type guard for DownloadProgressMessage
 * Validates that an object conforms to the DownloadProgressMessage interface
 */
export function isDownloadProgressMessage(obj: unknown): obj is DownloadProgressMessage {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "type" in candidate &&
    "chapterId" in candidate &&
    typeof candidate["chapterId"] === "number" &&
    "progress" in candidate &&
    typeof candidate["progress"] === "number" &&
    "status" in candidate &&
    typeof candidate["status"] === "string"
  );
}

/**
 * Type guard for TaskUpdateMessage
 * Validates that an object conforms to the TaskUpdateMessage interface
 */
export function isTaskUpdateMessage(obj: unknown): obj is TaskUpdateMessage {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "type" in candidate &&
    "taskId" in candidate &&
    typeof candidate["taskId"] === "string" &&
    "status" in candidate &&
    typeof candidate["status"] === "string" &&
    "progress" in candidate &&
    typeof candidate["progress"] === "number" &&
    (!("result" in candidate) || "result" in candidate)
  );
}

/**
 * Type guard for ErrorMessage
 * Validates that an object conforms to the ErrorMessage interface
 */
export function isErrorMessage(obj: unknown): obj is ErrorMessage {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "type" in candidate &&
    "code" in candidate &&
    typeof candidate["code"] === "string" &&
    "message" in candidate &&
    typeof candidate["message"] === "string" &&
    (!("details" in candidate) || "details" in candidate)
  );
}

/**
 * Type guard for WebSocketClientOptions
 * Validates that an object conforms to the WebSocketClientOptions interface
 */
export function isWebSocketClientOptions(obj: unknown): obj is WebSocketClientOptions {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("url" in candidate) || typeof candidate["url"] === "string") &&
    (!("reconnect" in candidate) || typeof candidate["reconnect"] === "boolean") &&
    (!("reconnectDelay" in candidate) || typeof candidate["reconnectDelay"] === "number") &&
    (!("maxReconnectAttempts" in candidate) || typeof candidate["maxReconnectAttempts"] === "number") &&
    (!("timeout" in candidate) || typeof candidate["timeout"] === "number") &&
    (!("headers" in candidate) || "headers" in candidate)
  );
}

/**
 * Type guard for WebSocketEventMap
 * Validates that an object conforms to the WebSocketEventMap interface
 */
export function isWebSocketEventMap(obj: unknown): obj is WebSocketEventMap {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("open" in candidate) || Array.isArray(candidate["open"])) &&
    (!("message" in candidate) || Array.isArray(candidate["message"])) &&
    (!("close" in candidate) || Array.isArray(candidate["close"])) &&
    (!("error" in candidate) || Array.isArray(candidate["error"]))
  );
}

/**
 * Type guard for WebSocketClient
 * Validates that an object conforms to the WebSocketClient interface
 */
export function isWebSocketClient(obj: unknown): obj is WebSocketClient {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "connect" in candidate &&
    typeof candidate["connect"] === "function" &&
    "disconnect" in candidate &&
    typeof candidate["disconnect"] === "function" &&
    "send" in candidate &&
    typeof candidate["send"] === "function" &&
    "subscribe" in candidate &&
    typeof candidate["subscribe"] === "function" &&
    "unsubscribe" in candidate &&
    typeof candidate["unsubscribe"] === "function"
  );
}

/**
 * Type guard for SubscriptionOptions
 * Validates that an object conforms to the SubscriptionOptions interface
 */
export function isSubscriptionOptions(obj: unknown): obj is SubscriptionOptions {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("channels" in candidate) || Array.isArray(candidate["channels"]) && candidate["channels"].every((x: unknown) => typeof x === "string")) &&
    (!("handler" in candidate) || typeof candidate["handler"] === "function")
  );
}

/**
 * Type guard for PresenceData
 * Validates that an object conforms to the PresenceData interface
 */
export function isPresenceData(obj: unknown): obj is PresenceData {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "userId" in candidate &&
    typeof candidate["userId"] === "string" &&
    "username" in candidate &&
    typeof candidate["username"] === "string" &&
    "status" in candidate &&
    typeof candidate["status"] === "string" &&
    "lastSeen" in candidate &&
    typeof candidate["lastSeen"] === "string"
  );
}

/**
 * Type guard for ScanProgressMessage
 * Validates that an object conforms to the ScanProgressMessage interface
 */
export function isScanProgressMessage(obj: unknown): obj is ScanProgressMessage {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "type" in candidate &&
    "libraryId" in candidate &&
    typeof candidate["libraryId"] === "number" &&
    "progress" in candidate &&
    typeof candidate["progress"] === "number" &&
    "status" in candidate &&
    typeof candidate["status"] === "string" &&
    (!("currentFile" in candidate) || typeof candidate["currentFile"] === "string") &&
    (!("totalFiles" in candidate) || typeof candidate["totalFiles"] === "number")
  );
}

/**
 * Type guard for NotificationMessage
 * Validates that an object conforms to the NotificationMessage interface
 */
export function isNotificationMessage(obj: unknown): obj is NotificationMessage {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "type" in candidate &&
    "title" in candidate &&
    typeof candidate["title"] === "string" &&
    "message" in candidate &&
    typeof candidate["message"] === "string" &&
    "level" in candidate &&
    typeof candidate["level"] === "string" &&
    (!("timestamp" in candidate) || typeof candidate["timestamp"] === "string") &&
    (!("action" in candidate) || "action" in candidate)
  );
}

/**
 * Type guard for SystemStatusMessage
 * Validates that an object conforms to the SystemStatusMessage interface
 */
export function isSystemStatusMessage(obj: unknown): obj is SystemStatusMessage {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "type" in candidate &&
    "status" in candidate &&
    typeof candidate["status"] === "string" &&
    "uptime" in candidate &&
    typeof candidate["uptime"] === "number" &&
    "memoryUsage" in candidate &&
    typeof candidate["memoryUsage"] === "number" &&
    "cpuUsage" in candidate &&
    typeof candidate["cpuUsage"] === "number" &&
    (!("activeJobs" in candidate) || typeof candidate["activeJobs"] === "number") &&
    (!("queuedJobs" in candidate) || typeof candidate["queuedJobs"] === "number")
  );
}

/**
 * Type guard for JobStatusMessage
 * Validates that an object conforms to the JobStatusMessage interface
 */
export function isJobStatusMessage(obj: unknown): obj is JobStatusMessage {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "type" in candidate &&
    "jobId" in candidate &&
    typeof candidate["jobId"] === "string" &&
    "status" in candidate &&
    typeof candidate["status"] === "string" &&
    "progress" in candidate &&
    typeof candidate["progress"] === "number" &&
    (!("result" in candidate) || "result" in candidate) &&
    (!("error" in candidate) || typeof candidate["error"] === "string")
  );
}

/**
 * Type guard for MangaUpdateMessage
 * Validates that an object conforms to the MangaUpdateMessage interface
 */
export function isMangaUpdateMessage(obj: unknown): obj is MangaUpdateMessage {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "type" in candidate &&
    "mangaId" in candidate &&
    typeof candidate["mangaId"] === "number" &&
    "action" in candidate &&
    typeof candidate["action"] === "string" &&
    (!("data" in candidate) || "data" in candidate)
  );
}

/**
 * Type guard for ChapterUpdateMessage
 * Validates that an object conforms to the ChapterUpdateMessage interface
 */
export function isChapterUpdateMessage(obj: unknown): obj is ChapterUpdateMessage {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "type" in candidate &&
    "chapterId" in candidate &&
    typeof candidate["chapterId"] === "number" &&
    "action" in candidate &&
    typeof candidate["action"] === "string" &&
    (!("data" in candidate) || "data" in candidate)
  );
}

/**
 * Type guard for VolumeUpdateMessage
 * Validates that an object conforms to the VolumeUpdateMessage interface
 */
export function isVolumeUpdateMessage(obj: unknown): obj is VolumeUpdateMessage {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "type" in candidate &&
    "volumeId" in candidate &&
    typeof candidate["volumeId"] === "number" &&
    "action" in candidate &&
    typeof candidate["action"] === "string" &&
    (!("data" in candidate) || "data" in candidate)
  );
}