/**
 * Load Balancer Module
 *
 * Provides load balancing strategies for distributing requests across
 * multiple provider instances.
 *
 * Strategies:
 * - round-robin: Rotate through providers sequentially
 * - least-connections: Select provider with fewest active connections
 * - weighted: Select based on provider priority weights
 *
 * Extracted from: provider-registry.ts (lines 640-703)
 * ESLint Fix: Lines 660-661 - no-case-declarations wrapped in block scope
 */

import { ProviderStatus } from './types';

import type { ProviderWrapper } from './provider-wrapper';

/**
 * Simple load balancer for provider selection
 */
export class LoadBalancer {
  private strategy: string;
  private currentIndex: number = 0;
  private connections: Map<string, number> = new Map();

  constructor(strategy: string) {
    this.strategy = strategy;
  }

  selectProvider(providers: ProviderWrapper[]): ProviderWrapper | null {
    const available = providers.filter(p =>
      p.getHealth().status === ProviderStatus.READY
    );
    if (available.length === 0) return null;
    switch (this.strategy) {
      case 'round-robin': {
        const provider = available[this.currentIndex % available.length] ?? null;
        this.currentIndex++;
        return provider;
      }
      case 'least-connections': {
        let min = Infinity;
        let selected: ProviderWrapper | null = null;
        for (const p of available) {
          const conn = this.connections.get(p.getConfig().id) ?? 0;
          if (conn < min) {
            min = conn;
            selected = p;
          }
        }

        if (selected) {
          this.connections.set(
            selected.getConfig().id,
            (this.connections.get(selected.getConfig().id) ?? 0) + 1
          );
        }

        return selected;
      }
      case 'weighted': {
        // Select based on priority weights
        const totalWeight = available.reduce((sum, p) => sum + p.getConfig().priority, 0);
        const random = Math.random() * totalWeight;
        let cumulative = 0;
        for (const p of available) {
          cumulative += p.getConfig().priority;
          if (random < cumulative) {
            return p;
          }
        }

        return available[0] ?? null;
      }
      default:
        return available[0] ?? null;
    }
  }

  releaseConnection(providerId: string): void {
    const current = this.connections.get(providerId) ?? 0;
    if (current > 0) {
      this.connections.set(providerId, current - 1);
    }
  }
}
