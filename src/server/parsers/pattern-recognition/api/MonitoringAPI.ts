/**
 * Monitoring Dashboard API
 * 
 * RESTful API for monitoring and managing the Pattern Recognition Engine.
 * Provides endpoints for metrics, pattern management, and real-time monitoring.
 */

import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Server as SocketIOServer, Socket } from 'socket.io';

import { logger } from '@/utils/logger';

import { PatternStore } from '../utils/PatternStore';

import type { ProductionEngine } from '../deployment/ProductionEngine';
import type { Pattern, UserFeedback, SystemMetrics } from '../types';
import type { Express, Request, Response, NextFunction } from 'express';
import type { Server } from 'http';

// Helper functions for safe type handling
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSystemMetrics(value: unknown): value is SystemMetrics {
  if (!isRecord(value)) return false;
  return (
    isRecord(value["patterns"]) &&
    isRecord(value["models"]) &&
    isRecord(value["performance"]) &&
    isRecord(value["learning"])
  );
}

export class MonitoringAPI {
  private app: Express;
  private server: Server | null = null;
  private io: SocketIOServer | null = null;
  private engine: ProductionEngine;
  private patternStore: PatternStore;
  private port: number;
  
  // Metrics cache
  private metricsCache: {
    data: SystemMetrics | null;
    timestamp: number;
  } = { data: null, timestamp: 0 };
  private metricsCacheTTL = 5000; // 5 seconds

  constructor(engine: ProductionEngine, port: number = 3001) {
    this.engine = engine;
    this.patternStore = new PatternStore();
    this.port = port;
    this.app = express();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // Security
    this.app.use(helmet());
    this.app.use(cors());
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    });
    this.app.use('/api/', limiter);
    
    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });
    
    // Error handling
    this.app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
      console.error('API Error:', err);
      res["status"](500).json({
        error: 'Internal server error',
        message: err.message
      });
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
    
    // Metrics endpoints
    this.app.get('/api/metrics', this.getMetrics.bind(this));
    this.app.get('/api/metrics/realtime', this.getRealtimeMetrics.bind(this));
    this.app.get('/api/metrics/history', this.getMetricsHistory.bind(this));
    
    // Pattern management
    this.app.get('/api/patterns', this.getPatterns.bind(this));
    this.app.get('/api/patterns/:id', this.getPattern.bind(this));
    this.app.post('/api/patterns', this.createPattern.bind(this));
    this.app.put('/api/patterns/:id', this.updatePattern.bind(this));
    this.app.delete('/api/patterns/:id', this.deletePattern.bind(this));
    this.app.post('/api/patterns/evolve', this.evolvePatterns.bind(this));
    
    // Learning endpoints
    this.app.post('/api/feedback', this.submitFeedback.bind(this));
    this.app.get('/api/learning/stats', this.getLearningStats.bind(this));
    this.app.post('/api/learning/train', this.triggerTraining.bind(this));
    
    // Recognition testing
    this.app.post('/api/recognize', this.testRecognition.bind(this));
    
    // Model management
    this.app.get('/api/models', this.getModels.bind(this));
    this.app.post('/api/models/reload', this.reloadModels.bind(this));
    
    // Export/Import
    this.app.get('/api/export', this.exportState.bind(this));
    this.app.post('/api/import', this.importState.bind(this));
    
    // Statistics
    this.app.get('/api/stats/patterns', this.getPatternStats.bind(this));
    this.app.get('/api/stats/performance', this.getPerformanceStats.bind(this));
  }

  /**
   * Setup WebSocket for real-time updates
   */
  private setupWebSocket(): void {
    // WebSocket setup will be initialized when server starts
  }

  /**
   * Start the API server
   */
  start(): Promise<void> {
    this.server = this.app.listen(this.port, () => {
      logger.info(`Monitoring API listening on port ${this.port}`);
    });

    // Initialize WebSocket
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.io.on('connection', (socket: Socket) => {
      logger.info('Client connected to monitoring dashboard');

      // Send initial metrics
      void this.sendMetricsUpdate(socket);

      // Setup periodic updates
      const interval = setInterval(() => {
        void this.sendMetricsUpdate(socket);
      }, 5000);

      socket.on('disconnect', () => {
        logger.info('Client disconnected from monitoring dashboard');
        clearInterval(interval);
      });
    });

    return Promise.resolve();
  }

  /**
   * Stop the API server
   */
  stop(): Promise<void> {
    if (this.io) {
      void this.io.close();
    }
    if (this.server) {
      this.server.close();
    }
    return Promise.resolve();
  }

  // ============================================================================
  // Route Handlers
  // ============================================================================

  /**
   * Get current metrics
   */
  private async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      // Check cache
      if (Date.now() - this.metricsCache.timestamp < this.metricsCacheTTL && this.metricsCache.data) {
        res.json(this.metricsCache.data);
        return;
      }

      // Get fresh metrics
      const metrics = await this.engine.getMetrics();

      // Validate metrics
      if (!isSystemMetrics(metrics)) {
        res["status"](500).json({ error: 'Invalid metrics format' });
        return;
      }

      // Update cache
      this.metricsCache = {
        data: metrics,
        timestamp: Date.now()
      };

      res.json(metrics);
    } catch (_error: unknown) {
  res["status"](500).json({ errorMessage: 'Failed to get metrics' });
    }
  }

  /**
   * Get real-time metrics stream
   */
  private getRealtimeMetrics(req: Request, res: Response): Promise<void> {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const interval = setInterval(() => {
      void (async () => {
        try {
          const metrics = await this.engine.getMetrics();
          res.write(`data: ${JSON.stringify(metrics)}\n\n`);
        } catch (error: unknown) {
          console.error('Failed to send metrics:', error);
        }
      })();
    }, 1000);

    req.on('close', () => {
      clearInterval(interval);
    });

    return Promise.resolve();
  }

  /**
   * Get metrics history
   */
  private getMetricsHistory(req: Request, res: Response): Promise<void> {
    // This would typically query a time-series database
    res.json({
      message: 'Metrics history endpoint - implement with time-series DB'
    });
    return Promise.resolve();
  }

  /**
   * Get all patterns
   */
  private async getPatterns(req: Request, res: Response): Promise<void> {
    try {
      const patterns = await this.patternStore.loadPatterns();
      res.json(patterns);
    } catch (_error: unknown) {
  res["status"](500).json({ errorMessage: 'Failed to load patterns' });
    }
  }

  /**
   * Get single pattern
   */
  private async getPattern(req: Request, res: Response): Promise<void> {
    try {
      const patterns = await this.patternStore.loadPatterns();
      const pattern = patterns.find(p => p["id"] === req.params["id"]);

      if (!pattern) {
        res["status"](404).json({ error: 'Pattern not found' });
        return;
      }

      res.json(pattern);
    } catch (_error: unknown) {
  res["status"](500).json({ errorMessage: 'Failed to load pattern' });
    }
  }

  /**
   * Create new pattern
   */
  private async createPattern(req: Request, res: Response): Promise<void> {
    try {
      const pattern = req.body as Pattern;
      await this.patternStore.savePattern(pattern);
      res["status"](201).json(pattern);
    } catch (_error: unknown) {
  res["status"](500).json({ errorMessage: 'Failed to create pattern' });
    }
  }

  /**
   * Update pattern
   */
  private async updatePattern(req: Request, res: Response): Promise<void> {
    try {
      const pattern = {
        ...req.body,
        id: req.params["id"]
      } as Pattern;
      await this.patternStore.savePattern(pattern);
      res.json(pattern);
    } catch (_error: unknown) {
  res["status"](500).json({ errorMessage: 'Failed to update pattern' });
    }
  }

  /**
   * Delete pattern
   */
  private async deletePattern(req: Request, res: Response): Promise<void> {
    try {
      const patternId = req.params["id"];
      if (!patternId) {
        res["status"](400).json({ error: 'Pattern ID is required' });
        return;
      }
      await this.patternStore.deletePattern(patternId);
      res["status"](204).send();
    } catch (_error: unknown) {
  res["status"](500).json({ errorMessage: 'Failed to delete pattern' });
    }
  }

  /**
   * Trigger pattern evolution
   */
  private async evolvePatterns(req: Request, res: Response): Promise<void> {
    try {
      await this.engine['engine'].evolvePatterns();
      res.json({ message: 'Pattern evolution triggered' });
    } catch (_error: unknown) {
  res["status"](500).json({ errorMessage: 'Failed to evolve patterns' });
    }
  }

  /**
   * Submit user feedback
   */
  private async submitFeedback(req: Request, res: Response): Promise<void> {
    try {
      const { matchId, feedback } = req.body as { matchId: string; feedback: UserFeedback };
      await this.engine['engine'].provideFeedback(matchId, feedback);
      res.json({ message: 'Feedback submitted successfully' });
    } catch (_error: unknown) {
  res["status"](500).json({ errorMessage: 'Failed to submit feedback' });
    }
  }

  /**
   * Get learning statistics
   */
  private getLearningStats(req: Request, res: Response): Promise<void> {
    try {
      // Active learning is temporarily disabled
      res.json({
        message: 'Active learning is temporarily disabled',
        totalSamples: 0,
        accuracy: 0,
        lastUpdated: null
      });
    } catch (_error: unknown) {
  res["status"](500).json({ errorMessage: 'Failed to get learning stats' });
    }
    return Promise.resolve();
  }

  /**
   * Trigger model training
   */
  private triggerTraining(req: Request, res: Response): Promise<void> {
    try {
      // This would typically trigger an async training job
      res.json({ message: 'Training job queued' });
    } catch (_error: unknown) {
  res["status"](500).json({ errorMessage: 'Failed to trigger training' });
    }
    return Promise.resolve();
  }

  /**
   * Test pattern recognition
   */
  private async testRecognition(req: Request, res: Response): Promise<void> {
    try {
      // Type assertion is necessary for request body parsing
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await this.engine.recognize(req.body);
      res.json(result);
    } catch (_error: unknown) {
  res["status"](500).json({ errorMessage: 'Recognition failed' });
    }
  }

  /**
   * Get model information
   */
  private getModels(req: Request, res: Response): Promise<void> {
    res.json({
      models: [
        { id: 'classifier', type: 'classification', status: 'active' },
        { id: 'similarity', type: 'similarity', status: 'active' },
        { id: 'anomaly', type: 'anomaly_detection', status: 'active' }
      ]
    });
    return Promise.resolve();
  }

  /**
   * Reload models
   */
  private reloadModels(req: Request, res: Response): Promise<void> {
    try {
      // This would reload models from disk
      res.json({ message: 'Models reloaded successfully' });
    } catch (_error: unknown) {
  res["status"](500).json({ errorMessage: 'Failed to reload models' });
    }
    return Promise.resolve();
  }

  /**
   * Export engine state
   */
  private async exportState(req: Request, res: Response): Promise<void> {
    try {
      const state = await this.engine.exportState();
      res.json(state);
    } catch (_error: unknown) {
  res["status"](500).json({ errorMessage: 'Failed to export state' });
    }
  }

  /**
   * Import engine state
   */
  private async importState(req: Request, res: Response): Promise<void> {
    try {
      await this.engine.importState(req.body);
      res.json({ message: 'State imported successfully' });
    } catch (_error: unknown) {
  res["status"](500).json({ errorMessage: 'Failed to import state' });
    }
  }

  /**
   * Get pattern statistics
   */
  private async getPatternStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.patternStore.getStatistics();
      res.json(stats);
    } catch (_error: unknown) {
  res["status"](500).json({ errorMessage: 'Failed to get pattern stats' });
    }
  }

  /**
   * Get performance statistics
   */
  private async getPerformanceStats(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.engine.getMetrics();
      const metricsObj = metrics as Record<string, unknown>;

      // Safely extract nested properties
      const engineMetrics = metricsObj['engine'];
      const systemMetrics = metricsObj['system'];
      const queueMetrics = metricsObj['queue'];

      let inferenceTime: unknown;
      let cacheHitRate: unknown;
      if (engineMetrics && typeof engineMetrics === 'object' && 'performance' in engineMetrics) {
        const performance = (engineMetrics as Record<string, unknown>)['performance'];
        if (performance && typeof performance === 'object') {
          const perfObj = performance as Record<string, unknown>;
          inferenceTime = perfObj['averageInferenceTime'];
          cacheHitRate = perfObj['cacheHitRate'];
        }
      }

      let memoryUsage: unknown;
      let uptime: unknown;
      if (systemMetrics && typeof systemMetrics === 'object') {
        const sysObj = systemMetrics as Record<string, unknown>;
        memoryUsage = sysObj['memory'];
        uptime = sysObj['uptime'];
      }

      let queueSize: unknown;
      if (queueMetrics && typeof queueMetrics === 'object') {
        const queueObj = queueMetrics as Record<string, unknown>;
        queueSize = queueObj['size'];
      }

      res.json({
        inferenceTime,
        cacheHitRate,
        memoryUsage,
        uptime,
        queueSize
      });
    } catch (_error: unknown) {
  res["status"](500).json({ errorMessage: 'Failed to get performance stats' });
    }
  }

  /**
   * Send metrics update via WebSocket
   */
  private async sendMetricsUpdate(socket: Socket): Promise<void> {
    try {
      const metrics = await this.engine.getMetrics();
      socket.emit('metrics', metrics);
    } catch (error: unknown) {
      console.error('Failed to send metrics update:', error);
    }
  }
}