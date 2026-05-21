/**
 * Event Stream API Endpoint
 * 
 * GET /api/v1/events/stream - Server-Sent Events stream for real-time updates
 */

import { z } from 'zod';

import { eventStreamService } from '@/server/api/services/eventStreamService';
import { createApiRoute } from '@/utils/api-route-factory';

// Query validation schema
const streamQuerySchema = z.object({
  events: z.string().optional(), // Comma-separated event types
  resources: z.string().optional(), // Comma-separated resource types
  lastEventId: z.string().optional(),
});

export default createApiRoute({
  requireAuth: true,
  permissions: {
    GET: { resource: 'events', action: 'read' },
  },
  validation: {
    query: streamQuerySchema,
  },
  handlers: {
    GET: (req, res): void => {
      // Parse filters
      const params = req.query as z.infer<typeof streamQuerySchema>;
      const eventsList = params.events?.split(',').map(e => e.trim()).filter(Boolean);
      const resourcesList = params.resources?.split(',').map(r => r.trim()).filter(Boolean);
      const filters = {
        ...(eventsList !== undefined ? { events: eventsList } : {}),
        ...(resourcesList !== undefined ? { resources: resourcesList } : {}),
      };

      // Auth guard must run before writeHead — once headers commit, a throw cannot return 401.
      const auth = req.auth as { userId: string } | undefined;
      if (!auth?.userId) {
        throw new Error('User ID not found in auth');
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable Nginx buffering
      });

      const clientId = eventStreamService.addClient(
        auth.userId,
        res,
        filters,
        params.lastEventId
      );
      
      // Keep connection open
      req.on('close', () => {
        eventStreamService.removeClient(clientId);
      });
      
      // Prevent timeout
      req.socket.setTimeout(0);
      
      // Send initial connection event
      res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);
    },
  },
});