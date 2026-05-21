/**
 * Production Engine
 *
 * Production-ready wrapper for the Pattern Recognition Engine
 * with optimizations, monitoring, and error handling.
 */

import cluster from 'cluster';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import os from 'os';

import express from 'express';
import Redis from 'ioredis';
import pino from 'pino';

import { PatternRecognitionEngine } from '../core/PatternRecognitionEngine';

import type { EngineConfig, RecognitionRequest, RecognitionResponse} from '../types';
import type { Request, Response } from 'express';

export interface ProductionConfig extends EngineConfig {
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
  clustering?: {
    enabled: boolean;
    workers: number;
  };
  monitoring?: {
    enabled: boolean;
    metricsPort: number;
    healthCheckInterval: number;
  };
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
  };
}

export class ProductionEngine extends EventEmitter {
  private engine: PatternRecognitionEngine;
  private config: ProductionConfig;
  private redis: Redis | null = null;
  private logger: pino.Logger;
  private isHealthy = true;
  private healthCheckInterval?: NodeJS.Timeout;
  private requestProcessingInterval?: NodeJS.Timeout;
  private requestQueue: RecognitionRequest[] = [];
  private processing = false;

  constructor(config: ProductionConfig) {
    super();

    this.config = {
      ...config,
      clustering: {
        enabled: config.clustering?.enabled ?? false,
        workers: config.clustering?.workers ?? os.cpus().length
      },
      monitoring: {
        enabled: config.monitoring?.enabled ?? true,
        metricsPort: config.monitoring?.metricsPort ?? 9090,
        healthCheckInterval: config.monitoring?.healthCheckInterval ?? 30000
      },
      logging: {
        level: config.logging?.level ?? 'info',
        ...(config.logging?.file && { file: config.logging.file })
      }
    };

    // Initialize logger
    const loggingFile = this.config.logging?.file;
    const loggingLevel = this.config.logging?.level ?? 'info';
    this.logger = pino({
      level: loggingLevel,
      ...(loggingFile && {
        transport: {
          target: 'pino/file',
          options: { destination: loggingFile }
        }
      })
    });

    // Initialize engine
    this.engine = new PatternRecognitionEngine(config);

    // Initialize Redis if configured
    if (this.config.redis) {
      this.initializeRedis();
    }
  }

  /**
   * Initialize Redis connection
   */
  private initializeRedis(): void {
    const redisConfig = this.config.redis;
    if (!redisConfig) {
      return;
    }

    this.redis = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      ...(redisConfig.password && { password: redisConfig.password }),
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.redis.on('connect', () => {
      this.logger.info('Redis connected');
    });

    this.redis.on('error', (error: unknown) => {
      this.logger.error('Redis error:', error);
      this.isHealthy = false;
    });
  }

  /**
   * Start the production engine
   */
  async start(): Promise<void> {
    if (this.config.clustering?.enabled && cluster.isPrimary) {
      await this.startCluster();
    } else {
      await this.startWorker();
    }
  }

  /**
   * Start cluster mode
   */
  private startCluster(): Promise<void> {
    const workers = this.config.clustering?.workers ?? os.cpus().length;
    this.logger.info(`Starting cluster with ${workers} workers`);

    // Fork workers
    for (let i = 0; i < workers; i++) {
      cluster.fork();
    }

    // Handle worker events
    cluster.on('exit', (worker, code, signal) => {
      this.logger.warn(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
      cluster.fork();
    });

    // Start monitoring
    if (this.config.monitoring?.enabled) {
      this.startMonitoring();
    }

    return Promise.resolve();
  }

  /**
   * Start worker process
   */
  private async startWorker(): Promise<void> {
    const workerId = cluster.worker?.id ?? 0;
    this.logger.info(`Starting worker ${workerId}`);

    // Initialize engine
    await this.engine.initialize();

    // Start health checks
    this.startHealthChecks();

    // Start request processing
    this.startRequestProcessing();

    // Handle graceful shutdown
    process.on('SIGTERM', () => { void (async () => { await this.shutdown(); })(); });
    process.on('SIGINT', () => { void (async () => { await this.shutdown(); })(); });

    this.logger.info(`Worker ${workerId} started successfully`);
  }

  /**
   * Process recognition request with production features
   */
  async recognize(request: RecognitionRequest): Promise<RecognitionResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    this.logger.debug({ requestId, url: request.url }, 'Processing recognition request');

    try {
      // Check cache first (Redis)
      if (this.redis) {
        const cached = await this.getCachedResult(request);
        if (cached) {
          this.logger.debug({ requestId, cacheHit: true }, 'Cache hit');
          return cached;
        }
      }

      // Add to queue for rate limiting
      if (this.requestQueue.length > 100) {
        throw new Error('Request queue full');
      }

      this.requestQueue.push(request);

      // Process request
      const response = await this.processRequest(request);

      // Cache result
      if (this.redis && response.success) {
        await this.cacheResult(request, response);
      }

      // Log metrics
      const duration = Date.now() - startTime;
      this.logger.info({
        requestId,
        duration,
        success: response.success,
        confidence: response.confidence
      }, 'Request completed');

      return response;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({ requestId, errorMessage }, 'Recognition failed');

      // Return error response
      return {
        success: false,
        matches: [],
        confidence: 0,
        extractedData: {},
        performanceMetrics: {
          totalTime: Date.now() - startTime,
          featureExtractionTime: 0,
          inferenceTime: 0,
          cacheHit: false
        }
      };
    }
  }

  /**
   * Process request with retry logic using recursive approach
   */
  private async processRequest(request: RecognitionRequest, retries: number = 3, attempt: number = 1): Promise<RecognitionResponse> {
    try {
      // Execute recognition without await
      return await this.engine.recognize(request);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (attempt >= retries) {
        throw new Error(`Max retries exceeded: ${errorMessage}`);
      }

      this.logger.warn({ retry: attempt, errorMessage }, 'Retrying request');

      // Delay before next attempt
      await this.delay(Math.pow(2, attempt - 1) * 1000); // Exponential backoff

      // Recursively call processRequest for next attempt
      return this.processRequest(request, retries, attempt + 1);
    }
  }

  /**
   * Get cached result from Redis
   */
  private async getCachedResult(request: RecognitionRequest): Promise<RecognitionResponse | null> {
    if (!this.redis) return null;

    const key = this.getCacheKey(request);
    const cached = await this.redis.get(key);

    if (cached) {
      return JSON.parse(cached) as RecognitionResponse;
    }

    return null;
  }

  /**
   * Cache result in Redis
   */
  private async cacheResult(request: RecognitionRequest, response: RecognitionResponse): Promise<void> {
    if (!this.redis) return;

    const key = this.getCacheKey(request);
    const ttl = 3600; // 1 hour

    await this.redis.setex(key, ttl, JSON.stringify(response));
  }

  /**
   * Generate cache key
   */
  private getCacheKey(request: RecognitionRequest): string {
    const hash = crypto.createHash('md5').update(request.html).digest('hex');
    return `pattern:${hash}`;
  }

  /**
   * Start request processing loop
   */
  private startRequestProcessing(): void {
    this.requestProcessingInterval = setInterval(() => {
      if (!this.processing && this.requestQueue.length > 0) {
        void this.processQueue();
      }
    }, 100);
  }

  /**
   * Process request queue with parallel processing
   */
  private async processQueue(): Promise<void> {
    this.processing = true;

    try {
      // Process requests in parallel with concurrency limit
      const batchSize = Math.min(this.requestQueue.length, 5); // Configurable concurrency
      const batch = this.requestQueue.splice(0, batchSize);

      if (batch.length === 0) {
        return;
      }

      // Process all requests in parallel
      await Promise.all(
        batch.map(async (request) => {
          try {
            await this.engine.recognize(request);
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Queue processing error:', errorMessage);
          }
        })
      );
    } finally {
      this.processing = false;
    }
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    const interval = this.config.monitoring?.healthCheckInterval ?? 30000;
    this.healthCheckInterval = setInterval(() => {
      void this.performHealthCheck();
    }, interval);
  }

  /**
   * Perform health check
   */
  private performHealthCheck(): Promise<void> {
    try {
      // Check engine metrics
      const metrics = this.engine.getMetrics();

      // Check memory usage
      const memoryUsage = process.memoryUsage();
      const memoryMB = memoryUsage.heapUsed / 1024 / 1024;

      // Check Redis connection
      const redisHealthy = !this.redis || this.redis["status"] === 'ready';

      // Determine health status
      this.isHealthy =
        metrics.performance.memoryUsage < 500 &&
        memoryMB < 1000 &&
        redisHealthy &&
        this.requestQueue.length < 1000;

      if (!this.isHealthy) {
        this.logger.warn({
          memoryMB,
          queueSize: this.requestQueue.length,
          redisHealthy
        }, 'Health check failed');
      }
      return Promise.resolve();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Health check errorMessage:', errorMessage);
      this.isHealthy = false;
      return Promise.resolve();
    }
  }

  /**
   * Start monitoring server
   */
  private startMonitoring(): void {
    const app = express();
    const metricsPort = this.config.monitoring?.metricsPort ?? 9090;

    // Health endpoint
    app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: this.isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      });
    });

    // Metrics endpoint
    app.get('/metrics', async (_req: Request, res: Response) => {
      const metrics = await this.getMetrics();
      res.json(metrics);
    });

    // Ready endpoint
    app.get('/ready', (_req: Request, res: Response) => {
      res.status(this.isHealthy ? 200 : 503).send(this.isHealthy ? 'Ready' : 'Not ready');
    });

    app.listen(metricsPort, () => {
      this.logger.info(`Monitoring server listening on port ${metricsPort}`);
    });
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics(): Promise<unknown> {
    const engineMetrics = this.engine.getMetrics();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return Promise.resolve({
      engine: engineMetrics,
      system: {
        memory: {
          heapUsed: memoryUsage.heapUsed / 1024 / 1024,
          heapTotal: memoryUsage.heapTotal / 1024 / 1024,
          external: memoryUsage.external / 1024 / 1024,
          rss: memoryUsage.rss / 1024 / 1024
        },
        cpu: {
          user: cpuUsage.user / 1000000,
          system: cpuUsage.system / 1000000
        },
        uptime: process.uptime()
      },
      queue: {
        size: this.requestQueue.length,
        processing: this.processing
      },
      redis: this.redis ? {
        status: this.redis["status"],
        commandQueue: this.redis.commandQueue.length
      } : null,
      health: this.isHealthy
    });
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down production engine...');

    // Stop health checks and request processing
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.requestProcessingInterval) {
      clearInterval(this.requestProcessingInterval);
    }

    // Process remaining queue
    if (this.requestQueue.length > 0) {
      this.logger.info(`Processing ${this.requestQueue.length} remaining requests...`);
      await this.processQueue();
    }

    // Shutdown engine
    await this.engine.shutdown();

    // Close Redis connection
    if (this.redis) {
      await this.redis.quit();
    }

    this.logger.info('Production engine shut down successfully');
    process.exit(0);
  }

  /**
   * Export engine state for backup
   */
  async exportState(): Promise<unknown> {
    return this.engine.exportState();
  }

  /**
   * Import engine state from backup
   */
  async importState(state: unknown): Promise<void> {
    return this.engine.importState(state);
  }
}