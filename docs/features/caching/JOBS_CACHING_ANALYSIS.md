# Jobs Caching Analysis - Decision Document

*Date: 2025-10-19*
*Status: Analysis Complete - Implementation Deferred*
*Priority: LOW (Not Implemented)*

---

## 🎯 Analysis Summary

After analyzing the jobs router and job dashboard requirements, **hot cache integration for jobs was determined to have limited value** and is **not recommended at this time**.

---

## 📊 Current Implementation

### Jobs Router Endpoints

**File**: `src/server/trpc/routers/jobs.ts`

**Key Endpoints**:
1. `getByStatus` - Retrieves jobs filtered by status (PENDING, ACTIVE, COMPLETED, FAILED, etc.)
2. `getInProgress` - Retrieves jobs in processing pipeline (PENDING, ACTIVE, RETRYING)
3. Other endpoints for job management and mutations

**Current Performance**:
- Query time: 30-100ms (includes manga/chapter relations)
- Volume: Low (admin dashboard, not high-traffic user-facing)
- Access pattern: Polling every 2-3 seconds for real-time updates

---

## ❌ Why Jobs Were Not Cached

### 1. **Real-Time Requirements Conflict with Caching**

Job dashboards need **live status updates**, not cached data:

```
Scenario: User starts a download job
- t=0s: Job status is PENDING (cached)
- t=2s: Job status changes to ACTIVE (cache still shows PENDING)
- t=3s: Frontend polls (gets stale PENDING status from cache)
- t=5s: Cache expires, next poll shows ACTIVE
- Result: 3-5 second delay in status updates ❌
```

**Problem**: Even with short TTLs (2-5 seconds), users see stale job status, creating a poor UX.

### 2. **Rapid State Transitions**

Jobs change state frequently:
- PENDING → ACTIVE: ~1-2 seconds
- ACTIVE → COMPLETED: 5-30 seconds (downloads)
- ACTIVE → FAILED: Instantly on error

**Caching conflict**: By the time data is cached, it's already outdated.

### 3. **Low Traffic Volume**

Unlike reader pages or search (high-traffic user-facing endpoints), job dashboards are:
- **Admin-only**: Typically 1-5 concurrent viewers
- **Low query volume**: ~0.5 queries/second per admin
- **Cache miss rate**: Very high due to constantly changing data

**Cachebenefits minimal**: Shared cache hits are rare with constantly changing job states.

### 4. **Frontend Polling Pattern**

Typical dashboard polling:
```typescript
// Frontend polls every 2-3 seconds for updates
useInterval(() => {
  refetch(); // Polls getInProgress endpoint
}, 2000);
```

**With 5-second cache TTL**:
- Poll 1 (t=0s): Cache miss, queries DB, caches result
- Poll 2 (t=2s): Cache hit (stale data)
- Poll 3 (t=4s): Cache hit (stale data)
- Poll 4 (t=6s): Cache expired, queries DB

**Result**: Only 2 out of 4 polls benefit from cache, but those 2 show stale data ❌

---

## 🔧 The `jobs_volatile` Table

The `jobs_volatile` UNLOGGED table was created for **write-through caching**, not query result caching:

### Intended Design Pattern

```sql
CREATE UNLOGGED TABLE jobs_volatile (
    id BIGSERIAL PRIMARY KEY,
    queue_name TEXT NOT NULL,
    job_type TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    progress INTEGER DEFAULT 0,
    -- ... other fields
) WITH (fillfactor = 70);
```

**Intended Usage**:
1. **Write path**: Job service writes to BOTH `jobs` (permanent) and `jobs_volatile` (fast reads)
2. **Read path**: Dashboard queries `jobs_volatile` directly (no cache layer needed)
3. **Benefits**: Real-time data + fast queries (UNLOGGED table = 2-3x faster writes)

### Why Not Implemented?

Implementing `jobs_volatile` properly requires:

1. **Job Service Refactoring**:
   ```typescript
   // Current
   await prisma.jobs.create({ data: jobData });

   // Required for jobs_volatile
   await Promise.all([
       prisma.jobs.create({ data: jobData }),
       prisma.$executeRaw`INSERT INTO jobs_volatile VALUES (...)`
   ]);
   ```

2. **Job Update Refactoring**:
   ```typescript
   // Every status change must update both tables
   await Promise.all([
       prisma.jobs.update({ where: { id }, data: { status } }),
       prisma.$executeRaw`UPDATE jobs_volatile SET status = ${status} WHERE id = ${id}`
   ]);
   ```

3. **Cleanup Logic**:
   - `jobs_volatile` needs periodic cleanup (remove completed/failed jobs)
   - Orphan detection (jobs in volatile but not in permanent)

4. **Testing**:
   - Ensure both tables stay in sync
   - Handle edge cases (transaction failures, partial writes)

**Estimated effort**: 2-3 days of work + extensive testing

**Current value**: Low (job dashboard is not a performance bottleneck)

---

## 📈 Performance Analysis

### Current State (No Caching)

```
Job Dashboard Session (5 minutes of monitoring):
- Polls per minute: 30 (every 2 seconds)
- Total polls: 150
- Database queries: 150
- Average query time: 50ms
- Total time waiting: 7.5 seconds over 5 minutes
- User experience: Real-time updates ✅
```

### With Hot Cache (5-second TTL)

```
Job Dashboard Session (5 minutes of monitoring):
- Polls per minute: 30
- Total polls: 150
- Cache hits: ~100 (67%)
- Cache misses: ~50 (33%)
- Database queries: 50
- Total time waiting: 2.5 seconds (cache) + 2.5 seconds (DB) = 5 seconds
- Improvement: 2.5 seconds saved over 5 minutes
- User experience: Stale data 67% of the time ❌
```

**Trade-off**: Minimal performance gain (2.5 seconds over 5 minutes) for significant UX degradation (stale status).

---

## ✅ Recommended Solution

### Option 1: WebSocket / Server-Sent Events (Recommended)

Implement real-time job updates using WebSockets:

```typescript
// Server pushes job updates to connected clients
io.on('jobStatusChange', (jobId, newStatus) => {
  // Push to all connected dashboard viewers
  socket.emit('jobUpdate', { jobId, status: newStatus });
});
```

**Benefits**:
- Real-time updates (< 100ms latency)
- No polling overhead
- No stale data
- Scales well with multiple viewers

**Effort**: 1-2 days

### Option 2: Implement `jobs_volatile` (Future Work)

Full implementation of write-through caching with `jobs_volatile`:

**Benefits**:
- Real-time data + fast queries
- Reduces main database load
- Leverages existing UNLOGGED infrastructure

**Effort**: 2-3 days + testing

### Option 3: Status Quo (Current Choice)

Keep current implementation (direct database queries):

**Benefits**:
- Real-time accurate data
- Simple implementation
- Low traffic volume means performance is acceptable

**Current Performance**: 30-100ms per query is acceptable for admin dashboards

---

## 🎯 Conclusion

**Hot cache integration for jobs is NOT implemented** because:

1. ❌ Real-time requirements conflict with caching
2. ❌ Rapid state transitions make cached data stale immediately
3. ❌ Low traffic volume means minimal cache benefits
4. ❌ Frontend polling patterns create poor cache hit rates
5. ✅ Current performance (30-100ms) is acceptable for admin use

**Future enhancements** (if job dashboard performance becomes a bottleneck):
- **Priority 1**: Implement WebSocket push notifications (best UX, real-time)
- **Priority 2**: Implement `jobs_volatile` write-through caching (best performance + real-time)
- **Not Recommended**: Hot cache with TTL (poor UX, minimal gains)

---

## 📝 Integration Progress

### Completed Phases (3 of 5)

1. ✅ **Phase 1: Reader Hot Cache** - 15-30x improvement
2. ✅ **Phase 2: Manga Detail Pages** - 27-75x improvement
3. ✅ **Phase 3: Search Enhancement** - 20-1000x improvement

### Skipped Phase

4. ⏭️ **Phase 4: Jobs Dashboard** - SKIPPED (analysis shows limited value)

### Remaining Phase

5. ⏳ **Phase 5: Notifications** - Pending implementation

---

*Analysis completed by: Claude Code*
*Date: 2025-10-19*
*Decision: Skip jobs caching, proceed to notifications*
*Reasoning: Real-time requirements conflict with caching, low traffic volume*
