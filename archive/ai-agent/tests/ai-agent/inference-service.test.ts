/**
 * Qwen3.5-2B Inference Service Tests
 *
 * Tests for the AI agent inference service with optional model download.
 * Set TEST_AI_MODEL=true environment variable to run actual model tests.
 *
 * @module tests/ai-agent/inference-service
 */

import { Qwen35InferenceService } from '@/server/ai-agent/agent-core/inference-service';
import { createSuccessResult, isSuccess, isError } from '@/utils/async-result';

describe('Qwen35InferenceService', () => {
  const TEST_MODEL_PATH = process.env['AI_MODEL_PATH'] ?? '~/.cache/mugiwara-kaizoku/models/test-tiny.gguf';
  const TEST_CONFIG = {
    modelPath: TEST_MODEL_PATH,
    modelRepo: 'unsloth/Qwen3.5-2B-GGUF',
    modelFile: 'Qwen3.5-2B-Q4_K_M.gguf',
    downloadProgress: false,
    verbose: false,
  };

  beforeEach(() => {
    Qwen35InferenceService.resetInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = Qwen35InferenceService.getInstance();
      const instance2 = Qwen35InferenceService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should allow configuration on first get', () => {
      const instance = Qwen35InferenceService.getInstance({ verbose: true });
      expect(instance.getConfig().verbose).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should have default configuration', () => {
      const instance = Qwen35InferenceService.getInstance();
      const config = instance.getConfig();
      expect(config.contextSize).toBe(16384);
      expect(config.temperature).toBe(0.1);
      expect(config.enableToolCalling).toBe(true);
      expect(config.jsonMode).toBe(true);
    });

    it('should merge custom configuration', () => {
      const instance = Qwen35InferenceService.getInstance({
        temperature: 0.5,
        maxTokens: 512,
      });
      const config = instance.getConfig();
      expect(config.temperature).toBe(0.5);
      expect(config.maxTokens).toBe(512);
      expect(config.contextSize).toBe(16384); // default remains
    });
  });

  describe('Tool Registration', () => {
    it('should register tools', () => {
      const instance = Qwen35InferenceService.getInstance();
      const mockTool = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {
            param: { type: 'string' },
          },
          additionalProperties: false,
        } as const,
        execute: jest.fn().mockResolvedValue(createSuccessResult({})),
      };

      instance.registerTools([mockTool]);
      // Note: tools are internal, we can't directly assert
      // This test ensures no errors during registration
    });
  });

  // Only run model tests when TEST_AI_MODEL=true
  const runModelTests = process.env['TEST_AI_MODEL'] === 'true';
  const describeConditional = runModelTests ? describe : describe.skip;

  describeConditional('Model Integration (requires TEST_AI_MODEL=true)', () => {
    let service: Qwen35InferenceService;

    beforeAll(async () => {
      service = Qwen35InferenceService.getInstance(TEST_CONFIG);
    }, 300000); // 5 minute timeout for model download

    afterAll(async () => {
      if (service.isReady()) {
        await service.dispose();
      }
    }, 30000);

    it('should initialize successfully', async () => {
      const result = await service.initialize();
      expect(isSuccess(result)).toBe(true);
      expect(service.isReady()).toBe(true);
    }, 300000);

    it('should generate a response', async () => {
      const result = await service.initialize();
      if (isError(result)) {
        console.warn('Model initialization failed, skipping generation test');
        return;
      }

      const prompt = 'Hello, who are you?';
      const response = await service.generate(prompt);
      expect(isSuccess(response)).toBe(true);
      if (isSuccess(response)) {
        const data = response.data;
        expect(data.response).toBeDefined();
        expect(typeof data.response).toBe('string');
        expect(data.response.length).toBeGreaterThan(0);
        expect(data.confidence).toBeGreaterThan(0);
      }
    }, 60000);
  });

  describe('Error Handling', () => {
    it('should return error when generating without initialization', async () => {
      const service = Qwen35InferenceService.getInstance({
        modelPath: '/nonexistent/path/model.gguf',
      });

      const response = await service.generate('test prompt');
      expect(isError(response)).toBe(true);
      if (isError(response)) {
        expect(response.error.message).toContain('not initialized');
      }
    });

    it('should handle initialization failure gracefully', async () => {
      const service = Qwen35InferenceService.getInstance({
        modelPath: '/nonexistent/path/model.gguf',
        modelRepo: 'nonexistent/repo',
        modelFile: 'nonexistent.gguf',
      });

      const result = await service.initialize();
      expect(isError(result)).toBe(true);
      expect(service.isReady()).toBe(false);
    }, 30000);
  });
});