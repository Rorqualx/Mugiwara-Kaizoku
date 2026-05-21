/**
 * Pattern Recognition Feedback API
 *
 * Handles user corrections and feedback for the ML pattern learning system.
 * Processes corrections, triggers learning, and updates pattern confidence.
 *
 * Security:
 * - Requires authentication (OWASP A01:2021)
 * - Prevents spam and abuse of ML feedback system
 *
 * @module pages/api/pattern-recognition/feedback
 */

// Helper functions for safe type handling
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isChangeRecord(value: unknown): value is Record<string, unknown> & { from: unknown; to: unknown } {
  return isRecord(value) && 'from' in value && 'to' in value;
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : String(value);
}

import { getServerSession } from 'next-auth/next';
import { z } from 'zod';

import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/server/db';
import { PatternEvolutionTracker } from '@/server/parsers/pattern-recognition/analytics/PatternEvolutionTracker';
import { DatabasePatternStore } from '@/server/parsers/pattern-recognition/persistence/DatabasePatternStore';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { createApiRoute } from '@/utils/api-route-factory';
import { logger } from '@/utils/logger';


const patternStore = new DatabasePatternStore(prisma);
const evolutionTracker = new PatternEvolutionTracker(prisma, patternStore);
// Validation schema for feedback
const feedbackSchema = z.object({
  original: z.object({
    title: z.string().optional(),
    author: z.string().optional(),
    year: z.number().optional(),
    chapters: z.array(z.unknown()).optional(),
    volumes: z.array(z.unknown()).optional()
  }),
  corrected: z.object({
    title: z.string().optional(),
    author: z.string().optional(),
    year: z.number().optional(),
    chapters: z.array(z.unknown()).optional(),
    volumes: z.array(z.unknown()).optional()
  }),
  feedback: z.object({
    source: z.string(),
    url: z.string().optional(),
    confidence: z.number().min(0).max(1),
    userId: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
  })
});
/**
 * Calculate what changed between original and corrected data
 */
function calculateChanges(original: Record<string, unknown>, corrected: Record<string, unknown>): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  for (const key in corrected) {
    if (JSON.stringify(original[key]) !== JSON.stringify(corrected[key])) {
      changes[key] = {
        from: original[key],
        to: corrected[key]
      };
    }
  }
  return changes;
}
export default createApiRoute({
  requireAuth: true, // SECURITY: Require authentication to prevent spam/abuse (OWASP A01:2021)
  validation: {
    POST: feedbackSchema
  },
  handlers: {
    POST: async (req, res): Promise<void> => {
      // SECURITY: Verify authentication (OWASP A01:2021)
      const session = await getServerSession(req, res, authOptions);
      if (!session?.user) {
        logger.warn('Unauthorized pattern feedback attempt', {
          ip: req.headers['x-forwarded-for'] ?? req.socket.remoteAddress
        });
        return res.status(401).json({
          error: 'Authentication required',
          code: 'UNAUTHORIZED'
        });
      }

      try {
        const { original, corrected, feedback } = feedbackSchema.parse(req.body);
        // Calculate what changed
        const changes = calculateChanges(original, corrected);

        // Create learning feedback with authenticated user ID
        const _learningFeedback = {
          original,
          corrected,
          changes,
          source: String(feedback.source),
          url: feedback.url,
          userId: session.user.id, // Use authenticated user ID (session.user guaranteed by guard at line 88)
          confidence: feedback.confidence,
          metadata: isRecord(feedback.metadata) ? feedback.metadata : {},
          timestamp: new Date()
        };
        // Process pattern learning
        const patterns: Array<{
          type: 'title' | 'author';
          pattern: string;
          correction: string;
          source: string;
        }> = [];
        // Learn from title changes
        if (changes['title']) {
          const titleChange = changes['title'];
          if (isChangeRecord(titleChange)) {
            patterns.push({
              type: 'title' as const,
              pattern: safeString(titleChange.from),
              correction: safeString(titleChange.to),
              source: safeString(feedback.source)
            });
          }
        }
        // Learn from author changes
        if (changes['author']) {
          const authorChange = changes['author'];
          if (isChangeRecord(authorChange)) {
            patterns.push({
              type: 'author' as const,
              pattern: safeString(authorChange.from),
              correction: safeString(authorChange.to),
              source: safeString(feedback.source)
            });
          }
        }
        // Store learned patterns in parallel
        const savePatternPromises = patterns.map((pattern, index) =>
          patternStore.savePattern({
            id: `${pattern.type}_${Date.now()}_${index}`,
            name: `${pattern.type}_learned`,
            type: pattern.type,
            features: {
              structural: {
                tagCounts: {},
                maxDepth: 0,
                averageDepth: 0,
                elementCount: 0,
                domDepth: 0,
                domPath: [],
                siblingCount: 0,
                childCount: 0,
                parentTag: '',
                tagName: '',
                classList: [],
                attributes: {},
                position: 0
              },
              semantic: {
                keywordDensity: {},
                topicDistribution: {},
                sentimentScore: 0,
                readabilityScore: 0,
                textContent: '',
                textLength: 0,
                wordCount: 0
              },
              statistical: {
                wordCount: 0,
                avgWordLength: 0,
                sentenceCount: 0,
                avgSentenceLength: 0,
                paragraphCount: 0,
                textLength: 0,
                averageWordLength: 0
              },
              visual: {
                isVisible: true,
                isAboveFold: false,
                boundingBox: { x: 0, y: 0, width: 0, height: 0 },
                fontSize: 0,
                fontWeight: '',
                color: '',
                backgroundColor: '',
                zIndex: 0
              },
              contextual: {
                nearbyText: []
              }
            },
            selector: '',
            confidence: feedback.confidence,
            accuracy: 0.5,
            usageCount: 1,
            successRate: 0.5, // Start with neutral success rate
            lastUsed: new Date(),
            created: new Date(),
            version: 1,
            source: 'learned' as const,
            metadata: {
              source: safeString(pattern.source),
              correction: safeString(pattern.correction),
              pattern: safeString(pattern.pattern)
            }
          })
        );

        // Track pattern evolution in parallel
        const trackEvolutionPromises = patterns.map(p =>
          evolutionTracker.trackEvolution(p.type)
        );

        // Execute all operations in parallel
        await Promise.all([
          ...savePatternPromises,
          ...trackEvolutionPromises
        ]);
        // Log the feedback for analysis
        logger.info('Pattern recognition feedback received:', {
          source: safeString(feedback.source),
          changesCount: Object.keys(changes).length,
          patterns: patterns.length
        });

        // Emit WebSocket event for feedback submitted
        void realtimeEmitter.emitSystemEvent({
          eventType: 'pattern:feedback:submitted',
          source: 'pattern-recognition-feedback-api',
          message: `Pattern feedback submitted: ${patterns.length} patterns learned`,
          data: { patternsLearned: patterns.length, changesCount: Object.keys(changes).length, feedbackSource: safeString(feedback.source) },
        });

        return res.status(200).json({
          success: true,
          message: 'Feedback processed successfully',
          patternsLearned: patterns.length,
          changes: Object.keys(changes).length
        });
      }
      catch (error: unknown) {
        logger.error('Pattern recognition feedback error:', error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: 'Invalid feedback data',
            details: error.errors
          });
        }
        return res.status(500).json({
          error: 'Failed to process feedback',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }
});