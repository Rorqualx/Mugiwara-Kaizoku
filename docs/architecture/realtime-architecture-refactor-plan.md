# Real-Time Architecture Refactor Plan

*Status: Proposed*
*Author: Claude Code*
*Created: 2025-11-27*
*Priority: Critical (Performance)*

---

## Executive Summary

The application currently has **45+ independent polling mechanisms** running simultaneously, causing:
- 79,562 console errors on `/library/add`
- 12 of 21 pages timing out (>60 seconds)
- Request storms when backend is slow/unavailable

This plan proposes a **unified real-time architecture** that uses:
1. **WebSocket** as primary real-time channel
2. **PostgreSQL LISTEN/NOTIFY** for server-side event propagation
3. **Polling as fallback only** when WebSocket disconnects

---

## Current State Analysis

### Polling Inventory (45+ mechanisms)

| Interval | Count | Examples |
|----------|-------|----------|
| 1-2s | 3 | Download progress, Volume split |
| 3s | 2 | Conversion jobs, Activity API |
| 5s | 6 | Task dashboard, Background tasks, Root store |
| 10s | 5 | Task counts, Download manager, Reading progress |
| 30s | 7 | Integration status, System status, Notifications |
| 60s | 4 | Calendar events, Pattern learning |

### Problem: Multiplicative Request Growth

```
When backend is slow:
  3 retries × 45 polls × every 5s = 540 requests/minute
  With request failures cascading = exponential growth
```

### Existing Infrastructure (Underutilized)

The codebase already has:
- ✅ WebSocket server (`src/server/websocket.ts`)
- ✅ WebSocket service (`src/server/api/services/websocket-service/`)
- ✅ PostgreSQL LISTEN/NOTIFY bridge (`src/server/realtime/PostgresNotificationBridge.ts`)
- ✅ Client WebSocket hook (`src/hooks/pattern-learning/websocket.ts`)

These are only used for pattern learning - not for general data updates.

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 RealTimeProvider                          │  │
│  │  - Single WebSocket connection                            │  │
│  │  - Subscription management                                │  │
│  │  - Fallback polling coordinator                           │  │
│  │  - Connection state (connected/disconnected/error)        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐│
│  │ useRealtimeQuery │ │ useRealtimeQuery │ │ useRealtimeQuery ││
│  │ (jobs)           │ │ (downloads)      │ │ (notifications)  ││
│  │                  │ │                  │ │                  ││
│  │ - Subscribe to   │ │ - Subscribe to   │ │ - Subscribe to   ││
│  │   "jobs:*"       │ │   "downloads:*"  │ │   "notifications"││
│  │ - Update React   │ │ - Update React   │ │ - Update React   ││
│  │   Query cache    │ │   Query cache    │ │   Query cache    ││
│  └──────────────────┘ └──────────────────┘ └──────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SERVER                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              WebSocket Service (existing)                 │  │
│  │  - Connection management                                  │  │
│  │  - Channel subscriptions                                  │  │
│  │  - Message routing                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              │ LISTEN/NOTIFY                    │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         PostgreSQL Notification Bridge (existing)         │  │
│  │  - Database change detection                              │  │
│  │  - Event broadcasting                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐│
│  │ Job Service      │ │ Download Service │ │ Notification Svc ││
│  │                  │ │                  │ │                  ││
│  │ NOTIFY on:       │ │ NOTIFY on:       │ │ NOTIFY on:       ││
│  │ - job_created    │ │ - download_start │ │ - notif_created  ││
│  │ - job_updated    │ │ - download_prog  │ │ - notif_read     ││
│  │ - job_completed  │ │ - download_done  │ │                  ││
│  └──────────────────┘ └──────────────────┘ └──────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1)

**Goal:** Create unified client-side real-time infrastructure

#### 1.1 Create RealTimeProvider

**File:** `src/providers/RealTimeProvider.tsx`

```typescript
interface RealTimeContextValue {
  // Connection state
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';

  // Subscription management
  subscribe: (channel: string, callback: (data: unknown) => void) => () => void;
  unsubscribe: (channel: string) => void;

  // Manual reconnect
  reconnect: () => void;

  // Fallback polling state
  isPollingFallback: boolean;
}

// Channels:
// - "jobs:active" - Active job updates
// - "jobs:queued" - Queue changes
// - "downloads:progress" - Download progress
// - "downloads:completed" - Download completions
// - "notifications:new" - New notifications
// - "system:status" - System status changes
// - "manga:updated" - Manga data changes
// - "library:scan" - Library scan progress
```

#### 1.2 Create useRealtimeQuery Hook

**File:** `src/hooks/useRealtimeQuery.ts`

```typescript
interface UseRealtimeQueryOptions<TData> {
  // Standard React Query options
  queryKey: QueryKey;
  queryFn: () => Promise<TData>;

  // Real-time options
  channel: string; // WebSocket channel to subscribe to

  // Fallback options (used when WebSocket disconnected)
  fallbackPollingInterval?: number; // Default: 30000ms
  disableFallbackPolling?: boolean; // Default: false
}

function useRealtimeQuery<TData>(options: UseRealtimeQueryOptions<TData>) {
  const { isConnected, subscribe } = useRealTime();

  // When WebSocket connected: invalidate query on channel message
  // When WebSocket disconnected: fall back to polling

  const effectiveRefetchInterval = isConnected
    ? false  // No polling when WebSocket connected
    : options.fallbackPollingInterval ?? 30000;

  return useQuery({
    ...options,
    refetchInterval: effectiveRefetchInterval,
  });
}
```

#### 1.3 Extend Existing WebSocket Hook

**File:** `src/hooks/useUnifiedWebSocket.ts`

Extend the pattern-learning websocket hook to be a general-purpose WebSocket connection manager.

---

### Phase 2: Server-Side Events (Week 2)

**Goal:** Emit events from services when data changes

#### 2.1 Create Event Emitter Service

**File:** `src/server/services/realtime/EventEmitter.ts`

```typescript
class RealtimeEventEmitter {
  // Emit events to PostgreSQL NOTIFY
  emit(channel: string, payload: unknown): void;

  // Channel types
  emitJobUpdate(job: Job): void;
  emitDownloadProgress(downloadId: string, progress: number): void;
  emitNotification(notification: Notification): void;
  emitSystemStatus(status: SystemStatus): void;
}
```

#### 2.2 Integrate with Existing Services

Add event emission to:

| Service | Events |
|---------|--------|
| `JobService` | `job:created`, `job:updated`, `job:completed`, `job:failed` |
| `DownloadService` | `download:started`, `download:progress`, `download:completed` |
| `NotificationService` | `notification:created`, `notification:read` |
| `LibraryService` | `library:scan:started`, `library:scan:progress`, `library:scan:completed` |
| `MangaService` | `manga:updated`, `manga:created` |

#### 2.3 Configure PostgreSQL LISTEN/NOTIFY

Extend `PostgresNotificationBridge` to handle new channels.

---

### Phase 3: Migration (Weeks 3-4)

**Goal:** Replace polling with real-time subscriptions

#### 3.1 Priority Order (by request volume)

| Priority | Component | Current Polling | Target |
|----------|-----------|-----------------|--------|
| 1 | Download progress | 1-2s | WebSocket push |
| 2 | Job status | 3-5s | WebSocket push |
| 3 | Task dashboard | 5-10s | WebSocket push |
| 4 | Notifications | 10-30s | WebSocket push |
| 5 | System status | 30s | WebSocket push |
| 6 | Calendar/Pattern learning | 60s | Keep polling (low frequency) |

#### 3.2 Migration Steps per Component

For each component:
1. Replace `useQuery` with `useRealtimeQuery`
2. Configure appropriate channel subscription
3. Remove manual `refetchInterval`
4. Test with WebSocket connected
5. Test with WebSocket disconnected (fallback polling)

#### 3.3 Files to Modify

**High Priority (Download Progress):**
- `src/components/suwayomi/DownloadButton.tsx`
- `src/components/library/DownloadManagerModal.tsx`
- `src/hooks/useVolumeSplitProgress.ts`

**High Priority (Jobs):**
- `src/pages/jobs/conversion.tsx`
- `src/pages/jobs/dashboard.tsx`
- `src/hooks/useSystemJobStatus.ts`
- `src/components/taskActionBar.tsx`

**Medium Priority (Notifications/Status):**
- `src/components/NotificationsDropdown.tsx`
- `src/contexts/IntegrationStatusContext.tsx`
- `src/components/system/StatusContent.tsx`

**Low Priority (Can keep polling):**
- `src/hooks/useCalendar.ts` (60s, conditional)
- `src/hooks/pattern-learning/*.ts` (60s)

---

### Phase 4: Cleanup & Optimization (Week 5)

#### 4.1 Remove Deprecated Providers

- Remove `DomainProvider` (already marked `@deprecated`)
- Consolidate settings queries into single source

#### 4.2 Optimize Provider Hierarchy

Current (12 levels):
```
SessionProvider > UserProvider > QueryClientProvider > ColorSchemeProvider >
ThemeProvider > NavbarProvider > ModalsProvider > StoreProvider >
RootStoreProvider > DomainProvider > ProwlarrProvider > IntegrationStatusProvider
```

Target (8 levels):
```
SessionProvider > QueryClientProvider > ColorSchemeProvider >
ThemeProvider > NavbarProvider > ModalsProvider >
StoreProvider > RealTimeProvider
```

#### 4.3 Consolidate Duplicate Queries

| Query | Currently Fetched In | Target |
|-------|---------------------|--------|
| `settings.get({ key: 'all' })` | RootStoreProvider, ProwlarrContext | Single fetch in RootStoreProvider, share via context |
| `system.getStatus` | IntegrationStatusContext, StatusContent | Single subscription, share via RealTimeProvider |

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Console errors (/library/add) | 79,562 | < 100 |
| Network failures (/library/add) | 40,468 | 0 |
| Pages timing out | 12/21 | 0/21 |
| Homepage load time | >60s | <3s |
| Active polling intervals (when WS connected) | 45+ | 0 |
| Active polling intervals (when WS disconnected) | 45+ | 5-10 (critical only) |

---

## Risk Mitigation

### Risk: WebSocket Infrastructure Not Production-Ready

**Mitigation:** The existing WebSocket infrastructure is already in production for pattern learning. We're extending, not building from scratch.

### Risk: Breaking Existing Functionality

**Mitigation:**
1. Feature flag for new real-time system
2. Gradual migration (one component at a time)
3. Keep fallback polling during transition
4. Comprehensive testing at each phase

### Risk: Increased Server Memory (WebSocket connections)

**Mitigation:**
1. Connection pooling (already implemented in existing WebSocket service)
2. Graceful degradation under load
3. Monitor memory usage during rollout

---

## Quick Wins Already Implemented

These changes were applied immediately to stop the bleeding:

1. ✅ **Reduced React Query retries** from 3 to 1 (AppProviders.tsx, RootStoreProvider.tsx)
2. ✅ **Added exponential backoff** to retry delays (AppProviders.tsx)
3. ✅ **Disabled polling in development** mode (RootStoreProvider.tsx)
4. ✅ **Added max reconnect attempts** to WebSocket hooks (pattern-learning/websocket.ts)

---

## File References

### Existing Infrastructure
- `src/server/websocket.ts` - WebSocket server
- `src/server/api/services/websocket-service/` - WebSocket service modules
- `src/server/realtime/PostgresNotificationBridge.ts` - PostgreSQL LISTEN/NOTIFY
- `src/hooks/pattern-learning/websocket.ts` - Client WebSocket hook

### New Files to Create
- `src/providers/RealTimeProvider.tsx` - Unified real-time context
- `src/hooks/useRealtimeQuery.ts` - Real-time aware query hook
- `src/hooks/useUnifiedWebSocket.ts` - General-purpose WebSocket hook
- `src/server/services/realtime/EventEmitter.ts` - Server-side event emission

### Files to Modify
- See Phase 3.3 for complete list

---

## Appendix: Current Polling Locations

<details>
<summary>Full list of 45+ polling mechanisms (click to expand)</summary>

### React Query refetchInterval
- `src/pages/jobs/conversion.tsx:68` - 3000ms
- `src/pages/jobs/conversion.tsx:74` - 5000ms
- `src/pages/jobs/dashboard.tsx:321` - 5000ms
- `src/pages/jobs/dashboard.tsx:332` - 10000ms
- `src/pages/jobs/dashboard.tsx:342` - 5000ms
- `src/pages/settings/file-conversion.tsx:60` - 5000ms
- `src/pages/settings/integrations/index.tsx:102` - 30000ms
- `src/hooks/useSystemJobStatus.ts:34` - 5000ms (conditional)
- `src/hooks/useVolumeSplitProgress.ts:199` - 1000ms
- `src/hooks/useVolumeSplitProgress.ts:282` - 2000ms
- `src/hooks/useCalendar.ts:98` - 60000ms (conditional)
- `src/hooks/useEvents.ts:179` - 3000ms
- `src/hooks/useSystemEvents.ts:216` - 30000ms (conditional)
- `src/hooks/useBackgroundTask.ts:110` - 5000ms
- `src/hooks/pattern-learning/core.ts:101` - 60000ms
- `src/hooks/pattern-learning/evolution.ts:22` - 60000ms
- `src/components/taskActionBar.tsx:31` - 10000ms
- `src/components/taskActionBar.tsx:36` - 10000ms
- `src/components/NotificationsDropdown.tsx:73` - 10000ms (conditional)
- `src/components/NotificationsDropdown.tsx:82` - 30000ms
- `src/components/suwayomi/DownloadButton.tsx:307` - 30000ms
- `src/components/suwayomi/DownloadButton.tsx:333` - 1000ms
- `src/components/suwayomi/SuwayomiDownloadManager.tsx:80` - 10000ms
- `src/components/suwayomi/DownloadManager.tsx:87` - 10000ms
- `src/components/library/DownloadManagerModal.tsx:26` - 2000ms
- `src/components/volumeChapters/hooks/reading-progress.ts:100` - 10000ms
- `src/components/system/StatusContent.tsx:257` - 30000ms
- `src/components/mobile/ResponsiveNavigation.tsx:41` - 30000ms
- `src/components/settings/suwayomi/suwayomi-source-manager/hooks.tsx:45` - 30000ms
- `src/contexts/IntegrationStatusContext.tsx:98` - 60000ms

### setInterval
- `src/store/RootStoreProvider.tsx:120` - 5000ms
- `src/hooks/useTimer.ts:90` - configurable
- `src/hooks/pattern-learning/confidence.ts:20` - 30000ms
- `src/hooks/useDownloadQueue.ts:168` - 5000ms
- `src/hooks/performance/usePerformanceMonitor.ts:148` - configurable
- `src/hooks/jobs/useCompletedJobs.tsx:302` - configurable
- `src/hooks/usePatternLearning.ts:389` - configurable
- `src/server/services/fandom/FandomAPIClient.ts:75` - 60000ms
- `src/server/api/services/apiRateLimit.ts:38` - 60000ms
- `src/server/utils/query-optimizer.ts:219` - 60000ms

</details>

---

*Last Updated: 2025-11-27*
