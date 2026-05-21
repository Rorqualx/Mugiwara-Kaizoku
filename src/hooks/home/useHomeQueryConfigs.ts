/**
 * Home Page Query Configurations
 *
 * Tiered query configurations for staggered cache expiration.
 * Prevents all queries from expiring simultaneously (thundering herd).
 *
 * Extracted from: src/pages/index.tsx (lines 91-116)
 */

/**
 * Critical content configuration (30 minutes)
 * For stable data that rarely changes (trending, popular, top 100)
 */
export const criticalQueryConfig = {
  staleTime: 30 * 60 * 1000, // 30 minutes
  refetchOnWindowFocus: false,
} as const;

/**
 * Dynamic content configuration (20 minutes)
 * For moderately changing data (format-based queries)
 */
export const dynamicQueryConfig = {
  staleTime: 20 * 60 * 1000, // 20 minutes
  refetchOnWindowFocus: false,
} as const;

/**
 * Fresh content configuration (15 minutes)
 * For frequently updated data (recent releases, new series)
 */
export const freshQueryConfig = {
  staleTime: 15 * 60 * 1000, // 15 minutes
  refetchOnWindowFocus: false,
} as const;

/**
 * Quick checks configuration (5 minutes)
 * For fast queries that need freshness
 */
export const quickQueryConfig = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  refetchOnWindowFocus: false,
} as const;
