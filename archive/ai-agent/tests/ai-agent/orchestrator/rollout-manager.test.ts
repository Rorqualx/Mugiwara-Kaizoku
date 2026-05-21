/**
 * Rollout Manager Tests
 *
 * Tests for percentage-based routing of AI agent enrichment.
 */

import {
  shouldUseAIAgent,
  getRolloutConfig,
  updateRolloutPercentage,
  getRolloutStats,
  type RolloutConfig,
} from '@/server/ai-agent/orchestrator/rollout-manager';

describe('Rollout Manager', () => {
  beforeEach(() => {
    // Reset rollout percentage to default (100%)
    updateRolloutPercentage(100);
  });

  describe('deterministic routing', () => {
    it('should consistently route same mangaId to same decision', () => {
      // Set rollout to 50% for testing
      updateRolloutPercentage(50);

      const mangaId = 12345;
      const decision1 = shouldUseAIAgent(mangaId);
      const decision2 = shouldUseAIAgent(mangaId);
      const decision3 = shouldUseAIAgent(mangaId);

      expect(decision1).toBe(decision2);
      expect(decision2).toBe(decision3);
    });

    it('should distribute differently across mangaIds', () => {
      updateRolloutPercentage(50);
      const decisions = new Set();
      // Test a few different mangaIds, expect some variation
      for (let i = 1; i <= 100; i++) {
        decisions.add(shouldUseAIAgent(i));
      }
      // With 50% rollout, we should have both true and false decisions
      // (probabilistic, but extremely likely)
      expect(decisions.size).toBe(2);
      expect(decisions.has(true)).toBe(true);
      expect(decisions.has(false)).toBe(true);
    });

    it('should respect rollout percentage 0%', () => {
      updateRolloutPercentage(0);
      for (let i = 1; i <= 100; i++) {
        expect(shouldUseAIAgent(i)).toBe(false);
      }
    });

    it('should respect rollout percentage 100%', () => {
      updateRolloutPercentage(100);
      for (let i = 1; i <= 100; i++) {
        expect(shouldUseAIAgent(i)).toBe(true);
      }
    });

    it('should clamp invalid percentages to valid range', () => {
      // Over 100
      updateRolloutPercentage(150);
      expect(getRolloutStats().rolloutPercentage).toBe(100);

      // Under 0
      updateRolloutPercentage(-50);
      expect(getRolloutStats().rolloutPercentage).toBe(0);
    });
  });

  describe('stats and configuration', () => {
    it('should return correct rollout stats', () => {
      updateRolloutPercentage(75);
      const stats = getRolloutStats();
      expect(stats.rolloutPercentage).toBe(75);
      expect(stats.enabled).toBe(true);
      expect(typeof stats.hashSalt).toBe('string');
    });

    it('should enable when percentage > 0', () => {
      updateRolloutPercentage(1);
      expect(getRolloutStats().enabled).toBe(true);
      updateRolloutPercentage(0);
      expect(getRolloutStats().enabled).toBe(false);
    });
  });
});
