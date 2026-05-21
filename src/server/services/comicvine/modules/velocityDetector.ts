/**
 * Velocity Detection Prevention for ComicVine API
 * 
 * Prevents patterns that could trigger velocity detection:
 * - Adds random jitter to delays
 * - Varies request patterns
 * - Implements human-like request timing
 */

import { logger } from '@/utils/logger';

/**
 * Configuration for velocity detection prevention
 */
export interface VelocityConfig {
  minJitterMs?: number;
  maxJitterMs?: number;
  burstThreshold?: number;
  burstCooldownMs?: number;
  humanizeRequests?: boolean;
}

/**
 * Request pattern tracking
 */
interface RequestPattern {
  timestamps: number[];
  resources: string[];
  velocityScore: number;
}

/**
 * Velocity Detection Prevention
 * 
 * Adds human-like variations to request patterns to avoid detection
 */
export class VelocityDetector {
  private pattern: RequestPattern;
  private readonly MIN_JITTER_MS: number;
  private readonly MAX_JITTER_MS: number;
  private readonly BURST_THRESHOLD: number;
  private readonly BURST_COOLDOWN_MS: number;
  private readonly HUMANIZE_REQUESTS: boolean;
  
  // Time windows for pattern analysis
  private readonly SHORT_WINDOW_MS = 10000; // 10 seconds
  private readonly MEDIUM_WINDOW_MS = 60000; // 1 minute
  private readonly LONG_WINDOW_MS = 300000; // 5 minutes
  
  constructor(config: VelocityConfig = {}) {
    this.MIN_JITTER_MS = config.minJitterMs ?? 100;
    this.MAX_JITTER_MS = config.maxJitterMs ?? 500;
    this.BURST_THRESHOLD = config.burstThreshold ?? 5;
    this.BURST_COOLDOWN_MS = config.burstCooldownMs ?? 10000;
    this.HUMANIZE_REQUESTS = config.humanizeRequests !== false;
    
    this.pattern = {
      timestamps: [],
      resources: [],
      velocityScore: 0
    };
    
    logger.info('Velocity detector initialized', {
      minJitterMs: this.MIN_JITTER_MS,
      maxJitterMs: this.MAX_JITTER_MS,
      burstThreshold: this.BURST_THRESHOLD,
      humanizeRequests: this.HUMANIZE_REQUESTS
    });
  }
  
  /**
   * Calculate additional delay to prevent velocity detection
   * 
   * @param baseDelayMs - Base delay from rate limiter
   * @param resource - Resource being accessed
   * @returns Additional delay in milliseconds
   */
  public calculateAdditionalDelay(baseDelayMs: number, resource: string): number {
    const now = Date.now();
    
    // Clean old timestamps
    this.cleanOldTimestamps(now);
    
    // Track this request
    this.pattern.timestamps.push(now);
    this.pattern.resources.push(resource);
    
    // Calculate velocity score
    this.updateVelocityScore(now);
    
    let additionalDelay = 0;
    
    // 1. Add random jitter to prevent consistent timing
    const jitter = this.getRandomJitter();
    additionalDelay += jitter;
    
    // 2. Check for burst patterns in short window
    const burstDelay = this.getBurstDelay(now);
    additionalDelay += burstDelay;
    
    // 3. Add human-like variations
    if (this.HUMANIZE_REQUESTS) {
      const humanDelay = this.getHumanLikeDelay();
      additionalDelay += humanDelay;
    }
    
    // 4. Apply velocity score multiplier
    if (this.pattern.velocityScore > 0.5) {
      const velocityMultiplier = 1 + this.pattern.velocityScore;
      additionalDelay = Math.round(additionalDelay * velocityMultiplier);
    }
    
    logger.debug('Velocity detection prevention applied', {
      resource,
      baseDelayMs,
      additionalDelayMs: additionalDelay,
      jitterMs: jitter,
      burstDelayMs: burstDelay,
      velocityScore: this.pattern.velocityScore.toFixed(2)
    });
    
    return additionalDelay;
  }
  
  /**
   * Clean timestamps older than the long window
   */
  private cleanOldTimestamps(now: number): void {
    const cutoff = now - this.LONG_WINDOW_MS;
    const validIndices: number[] = [];

    for (let i = 0; i < this.pattern.timestamps.length; i++) {
      const timestamp = this.pattern.timestamps[i];
      // TypeScript strict indexing returns number | undefined, but we're iterating within bounds
      if (timestamp !== undefined && timestamp > cutoff) {
        validIndices.push(i);
      }
    }

    // Map valid indices to their values - filter handles the strict indexing undefined case
    this.pattern.timestamps = validIndices
      .map(i => this.pattern.timestamps[i])
      .filter((t): t is number => t !== undefined);
    this.pattern.resources = validIndices
      .map(i => this.pattern.resources[i])
      .filter((r): r is string => r !== undefined);
  }
  
  /**
   * Update velocity score based on request patterns
   */
  private updateVelocityScore(now: number): void {
    // Count requests in different time windows
    const shortWindowCount = this.countRequestsInWindow(now, this.SHORT_WINDOW_MS);
    const mediumWindowCount = this.countRequestsInWindow(now, this.MEDIUM_WINDOW_MS);
    const longWindowCount = this.countRequestsInWindow(now, this.LONG_WINDOW_MS);
    
    // Calculate velocity indicators
    const shortVelocity = shortWindowCount / (this.SHORT_WINDOW_MS / 1000); // requests per second
    const mediumVelocity = mediumWindowCount / (this.MEDIUM_WINDOW_MS / 1000);
    const longVelocity = longWindowCount / (this.LONG_WINDOW_MS / 1000);
    
    // Check for acceleration (velocity increasing)
    const acceleration = shortVelocity > mediumVelocity && mediumVelocity > longVelocity;
    
    // Calculate score (0 to 1)
    let score = 0;
    
    // High velocity in short window
    if (shortVelocity > 0.5) { // More than 0.5 requests per second
      score += 0.3;
    }
    
    // Sustained velocity in medium window
    if (mediumVelocity > 0.2) { // More than 0.2 requests per second
      score += 0.3;
    }
    
    // Acceleration pattern detected
    if (acceleration) {
      score += 0.4;
    }
    
    // Check for consistent intervals (robot-like behavior)
    const intervalConsistency = this.checkIntervalConsistency();
    if (intervalConsistency > 0.8) {
      score += 0.3;
    }
    
    // Cap at 1.0
    this.pattern.velocityScore = Math.min(1.0, score);
  }
  
  /**
   * Count requests in a time window
   */
  private countRequestsInWindow(now: number, windowMs: number): number {
    const cutoff = now - windowMs;
    return this.pattern.timestamps.filter(t => t > cutoff).length;
  }
  
  /**
   * Check for consistent intervals between requests
   */
  private checkIntervalConsistency(): number {
    if (this.pattern.timestamps.length < 3) {
      return 0;
    }
    
    const intervals: number[] = [];
    for (let i = 1; i < this.pattern.timestamps.length; i++) {
      const current = this.pattern.timestamps[i];
      const previous = this.pattern.timestamps[i - 1];
      // TypeScript strict indexing returns number | undefined, but we're iterating within bounds
      if (current !== undefined && previous !== undefined) {
        intervals.push(current - previous);
      }
    }
    
    if (intervals.length === 0) {
      return 0;
    }
    
    // Calculate standard deviation of intervals
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => {
      return sum + Math.pow(interval - mean, 2);
    }, 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    // Low standard deviation means consistent intervals (robot-like)
    // High standard deviation means variable intervals (human-like)
    const consistency = mean > 0 ? 1 - Math.min(1, stdDev / mean) : 0;
    
    return consistency;
  }
  
  /**
   * Get random jitter to add to delay
   */
  private getRandomJitter(): number {
    return Math.floor(
      Math.random() * (this.MAX_JITTER_MS - this.MIN_JITTER_MS) + this.MIN_JITTER_MS
    );
  }
  
  /**
   * Get additional delay for burst prevention
   */
  private getBurstDelay(now: number): number {
    const recentCount = this.countRequestsInWindow(now, this.BURST_COOLDOWN_MS);
    
    if (recentCount >= this.BURST_THRESHOLD) {
      // Exponential backoff for bursts
      const burstMultiplier = Math.pow(2, recentCount - this.BURST_THRESHOLD);
      const delay = this.BURST_COOLDOWN_MS * burstMultiplier;
      
      logger.warn('Burst pattern detected, applying cooldown', {
        recentRequests: recentCount,
        threshold: this.BURST_THRESHOLD,
        delayMs: delay
      });
      
      return delay;
    }
    
    return 0;
  }
  
  /**
   * Get human-like delay variations
   */
  private getHumanLikeDelay(): number {
    const patterns = [
      () => 0, // No delay (quick click)
      () => Math.random() * 200, // Very short pause
      () => 300 + Math.random() * 500, // Reading pause
      () => 1000 + Math.random() * 2000, // Thinking pause
      () => 3000 + Math.random() * 5000, // Long pause (distraction)
    ];
    
    // Weight towards shorter delays
    const weights = [0.3, 0.3, 0.2, 0.15, 0.05];
    const random = Math.random();
    let cumulative = 0;
    
    for (let i = 0; i < weights.length; i++) {
      const weight = weights[i];
      const pattern = patterns[i];
      // TypeScript strict indexing returns T | undefined, but we're iterating within bounds
      if (weight !== undefined && pattern !== undefined) {
        cumulative += weight;
        if (random < cumulative) {
          return Math.round(pattern());
        }
      }
    }
    
    return 0;
  }
  
  /**
   * Get current velocity statistics
   */
  public getStats(): {
    velocityScore: number;
    recentRequests: number;
    intervalConsistency: number;
    recommendation: string;
  } {
    const now = Date.now();
    const recentRequests = this.countRequestsInWindow(now, this.SHORT_WINDOW_MS);
    const consistency = this.checkIntervalConsistency();
    
    let recommendation = 'Normal';
    if (this.pattern.velocityScore > 0.7) {
      recommendation = 'Slow down - high velocity detected';
    } else if (consistency > 0.8) {
      recommendation = 'Add more variation - pattern too consistent';
    } else if (recentRequests >= this.BURST_THRESHOLD) {
      recommendation = 'Cooldown needed - burst detected';
    }
    
    return {
      velocityScore: this.pattern.velocityScore,
      recentRequests,
      intervalConsistency: consistency,
      recommendation
    };
  }
  
  /**
   * Reset pattern tracking
   */
  public reset(): void {
    this.pattern = {
      timestamps: [],
      resources: [],
      velocityScore: 0
    };
    logger.info('Velocity detector reset');
  }
}