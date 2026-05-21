# ESLint require-await Violation Fix Plan

**Status:** In Progress (20/105 fixed = 19%)
**Target:** Fix all remaining 85 violations in server files
**Deferred:** 5 ML-related violations (MLPipeline.ts, MLMetricsService.ts)

---

## ✅ Completed Files (20 violations fixed)

### High Priority (4+ violations each)
1. **ErrorHandler.ts** (5) - Stub methods converted to Promise.resolve
2. **monitoringService.ts** (4) - Synchronous methods converted to Promise.resolve
3. **MetadataProvider.ts** (4) - Stub methods converted to Promise.resolve
4. **WebsiteValidator.ts** (4) - Synchronous methods converted to Promise.resolve

### Medium Priority (3 violations)
5. **performanceService.ts** (3) - Synchronous cache methods converted to Promise.resolve

---

## 🔄 Remaining Files (85 violations)

### Medium Priority - 3 violations each (33 violations remaining)

#### Services (9 violations)
- **webhookService.ts** (3) - Likely synchronous notification methods
- **websocketService.ts** (3) - Likely synchronous broadcast methods

#### Pattern Recognition (24 violations)
- **PatternEvolutionTracker.ts** (3) - Analytics tracking methods
- **PatternEvolutionManager.ts** (3) - Manager coordination methods
- **ProductionEngine.ts** (3) - Engine coordination methods
- **VectorSearchService.ts** (3) - Search service methods
- **PatternCache.ts** (3) - Caching methods
- **BertEmbeddingService.ts** (2) - Will handle with low-priority
- **PatternStore.ts** (2) - Will handle with low-priority

#### Queue & Handlers (3 violations)
- **queue/handlers/index.ts** (3) - Handler registration methods

#### tRPC Routers (9 violations)
- **api.ts** (3) - Static data endpoints
- **kapowarr.ts** (3) - Integration endpoints
- **system.ts** (3) - System info endpoints

### Low Priority - 1-2 violations each (52 violations remaining)

#### Services (12 violations)
- subscriptionService.ts (1)
- conversion/ConversionJobWorker.ts (1)
- download/base.ts (1)
- download/volumeSplitter.ts (1)
- library/importRuleEngine.ts (1)
- library/metadataEnrichmentService.ts (1)
- metadataMerger.ts (1)
- notifications/NotificationService.ts (1)
- packImport/archiveExtractor.ts (1)
- search/BaseSearchProvider.ts (1)
- search/prowlarrProvider.ts (1)
- suwayomi/service.ts (1)

#### Base & Config (6 violations)
- base/CalendarProviderMixin.ts (2)
- config/calendar-providers.ts (1)
- config/feature-flags.ts (2)
- config/ml-config.ts (1)

#### Parsers (14 violations)
- CachedUnifiedParser.ts (1)
- UnifiedProviderAdapter.ts (1)
- benchmark/PerformanceBenchmark.ts (1)
- benchmark/runBenchmark.ts (1)
- cache/PostgresCacheProvider.ts (2)
- extractors/TableExtractor.ts (2)
- monitoring/MetricsCollector.ts (2)
- pattern-recognition/core/ActiveLearningSystem.ts (1)
- pattern-recognition/testing/ABTestingFramework.ts (1)
- pattern-recognition/training/DataCollector.ts (1)
- streaming/StreamingParser.ts (1)
- unified/index.ts (1)

#### Queue (9 violations)
- calendar/CalendarMaintenanceScheduler.ts (1)
- calendar/CalendarSyncScheduler.ts (1)
- download.ts (1)
- queueManager.ts (1)
- taskHandlers.ts (1)
- workers/autoDownloadWorker.ts (1)
- workers/calendarNotificationWorker.ts (1)
- workers/releaseDetectionWorker.ts (1)

#### Calendar Services (2 violations)
- services/calendar/ReleaseScheduleAggregator.ts (1)
- services/calendar/providers/AniListCalendarProvider.ts (1)

#### tRPC Routers (9 violations)
- bulk.ts (1) - Bulk operations
- calendar.ts (1) - Calendar endpoints
- files.ts (1) - File operations
- health.ts (1) - Health checks
- home.ts (2) - Home page data
- manga.ts (1) - Manga operations
- metadata.ts (2) - Metadata operations
- reader.ts (1) - Reader endpoints
- search.ts (1) - Search endpoints

#### Server Root (2 violations)
- index.ts (1)
- monitorQueues.ts (1)
- utils/rateLimit.ts (1)

---

## 🔧 Fix Patterns

### Pattern 1: Stub Methods (Throw Error)
```typescript
// Before
async method(): Promise<T> {
  throw new Error('Not implemented');
}

// After
method(): Promise<T> {
  return Promise.reject(new Error('Not implemented'));
}
```

### Pattern 2: Synchronous Methods
```typescript
// Before
async method(): Promise<void> {
  logger.info('message');
  this.someMap.set(key, value);
}

// After
method(): Promise<void> {
  logger.info('message');
  this.someMap.set(key, value);
  return Promise.resolve();
}
```

### Pattern 3: tRPC Static Data
```typescript
// Before
procedure.query(async () => ({ data: staticData }))

// After
procedure.query(() => Promise.resolve({ data: staticData }))
```

### Pattern 4: Error Result Returns
```typescript
// Before
async method(): Promise<AsyncResult<T>> {
  try {
    throw new Error('Not implemented');
  } catch (error) {
    return createErrorResult(transformError(error, { ... }));
  }
}

// After
method(): Promise<AsyncResult<T>> {
  return Promise.resolve(createErrorResult(transformError(
    new Error('Not implemented'), { ... }
  )));
}
```

---

## 📋 Next Steps

### Immediate (Continue current session)
1. Fix remaining medium-priority files (33 violations):
   - webhookService.ts (3)
   - websocketService.ts (3)
   - PatternEvolutionTracker.ts (3)
   - PatternEvolutionManager.ts (3)
   - ProductionEngine.ts (3)
   - VectorSearchService.ts (3)
   - PatternCache.ts (3)
   - queue/handlers/index.ts (3)
   - api.ts (3)
   - kapowarr.ts (3)
   - system.ts (3)

### Then (Batch process)
2. Fix all tRPC router low-priority files (9 violations)
3. Fix all services low-priority files (12 violations)
4. Fix all parser low-priority files (14 violations)
5. Fix all queue low-priority files (9 violations)
6. Fix remaining misc files (8 violations)

### Validation
```bash
# Check progress
npx eslint src/server --format json 2>/dev/null | jq '[.[] | .messages[] | select(.ruleId == "@typescript-eslint/require-await")] | length'

# Run type check
bun run type-check

# Final ESLint check
bun run lint
```

---

## 🎯 Success Criteria

- ✅ All 105 safe violations fixed
- ✅ 5 ML violations documented as deferred
- ✅ Type check passes
- ✅ ESLint passes
- ✅ No behavioral changes (Promise.resolve/reject maintains async interface)

---

**Estimated remaining time:** 60-90 minutes for all 85 violations
**Current progress:** 19% complete (20/105 fixed)
