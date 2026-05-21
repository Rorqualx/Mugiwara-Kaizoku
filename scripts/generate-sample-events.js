/**
 * Generate Sample Events Script
 * 
 * This script generates sample system events for testing the events dashboard.
 * Run with: node scripts/generate-sample-events.js
 */

import { prisma } from '../src/server/db.js';
import { EventType, EventSource, EventLevel } from '../src/server/services/events/eventTypes.js';

async function generateSampleEvents() {
  console.log('🎯 Generating sample events...\n');

  // Sample event templates
  const eventTemplates = [
    // System events
    {
      type: EventType.SYSTEM_STARTUP,
      source: EventSource.SYSTEM,
      level: EventLevel.INFO,
      message: 'System started successfully',
      details: { version: '1.6.1', environment: 'development' }
    },
    {
      type: EventType.SYSTEM_ERROR,
      source: EventSource.SYSTEM,
      level: EventLevel.ERROR,
      message: 'Failed to connect to external service',
      details: { service: 'MangaDex', error: 'Connection timeout' }
    },
    
    // Library events
    {
      type: EventType.LIBRARY_SCAN_STARTED,
      source: EventSource.LIBRARY,
      level: EventLevel.INFO,
      message: 'Library scan started',
      relatedEntityId: '1',
      relatedEntityType: 'library'
    },
    {
      type: EventType.LIBRARY_SCAN_COMPLETED,
      source: EventSource.LIBRARY,
      level: EventLevel.INFO,
      message: 'Library scan completed: Found 25 new chapters',
      relatedEntityId: '1',
      relatedEntityType: 'library',
      details: { chaptersFound: 25, duration: '2m 15s' }
    },
    
    // Manga events
    {
      type: EventType.MANGA_ADDED,
      source: EventSource.MANGA,
      level: EventLevel.INFO,
      message: 'Added manga: One Piece',
      relatedEntityId: '1',
      relatedEntityType: 'manga'
    },
    {
      type: EventType.MANGA_METADATA_UPDATED,
      source: EventSource.METADATA,
      level: EventLevel.INFO,
      message: 'Updated metadata for: Naruto',
      relatedEntityId: '2',
      relatedEntityType: 'manga',
      details: { provider: 'AniList', fields: ['description', 'genres'] }
    },
    
    // Download events
    {
      type: EventType.DOWNLOAD_STARTED,
      source: EventSource.DOWNLOAD,
      level: EventLevel.INFO,
      message: 'Download started: One Piece Chapter 1100',
      relatedEntityId: '100',
      relatedEntityType: 'chapter',
      details: { downloadClient: 'transmission', size: '25MB' }
    },
    {
      type: EventType.DOWNLOAD_COMPLETED,
      source: EventSource.DOWNLOAD,
      level: EventLevel.INFO,
      message: 'Download completed: One Piece Chapter 1100',
      relatedEntityId: '100',
      relatedEntityType: 'chapter',
      details: { duration: '3m 45s', averageSpeed: '1.2MB/s' }
    },
    {
      type: EventType.DOWNLOAD_ERROR,
      source: EventSource.DOWNLOAD,
      level: EventLevel.ERROR,
      message: 'Download failed: Bleach Chapter 686',
      relatedEntityId: '686',
      relatedEntityType: 'chapter',
      details: { error: 'No seeders available', attempts: 3 }
    },
    
    // Integration events
    {
      type: EventType.INTEGRATION_CONNECTED,
      source: EventSource.MANGADEX,
      level: EventLevel.INFO,
      message: 'Connected to MangaDex API',
      details: { apiVersion: 'v5', rateLimit: '5 requests/second' }
    },
    {
      type: EventType.INTEGRATION_ERROR,
      source: EventSource.ANILIST,
      level: EventLevel.ERROR,
      message: 'AniList API rate limit exceeded',
      details: { retryAfter: 300, currentRate: 100 }
    },
    
    // User events
    {
      type: EventType.USER_LOGGED_IN,
      source: EventSource.USER,
      level: EventLevel.INFO,
      message: 'User logged in: admin',
      details: { ip: '127.0.0.1', userAgent: 'Mozilla/5.0' }
    },
    
    // Task events
    {
      type: EventType.TASK_CREATED,
      source: EventSource.TASK,
      level: EventLevel.INFO,
      message: 'Created task: Check for new chapters',
      relatedEntityId: '1',
      relatedEntityType: 'task'
    },
    {
      type: EventType.TASK_FAILED,
      source: EventSource.TASK,
      level: EventLevel.ERROR,
      message: 'Task failed: Update metadata',
      relatedEntityId: '2',
      relatedEntityType: 'task',
      details: { error: 'Network timeout', retries: 3 }
    },
    
    // Backup events
    {
      type: EventType.BACKUP_STARTED,
      source: EventSource.BACKUP,
      level: EventLevel.INFO,
      message: 'Backup started: Daily backup',
      relatedEntityId: '1',
      relatedEntityType: 'backup'
    },
    {
      type: EventType.BACKUP_COMPLETED,
      source: EventSource.BACKUP,
      level: EventLevel.INFO,
      message: 'Backup completed successfully',
      relatedEntityId: '1',
      relatedEntityType: 'backup',
      details: { size: '150MB', duration: '5m 30s', files: 1250 }
    },
    
    // Warning events
    {
      type: EventType.SYSTEM_ERROR,
      source: EventSource.DATABASE,
      level: EventLevel.WARNING,
      message: 'Database connection pool warning: High usage detected',
      details: { currentConnections: 45, maxConnections: 50 }
    },
    {
      type: EventType.INTEGRATION_ERROR,
      source: EventSource.PROWLARR,
      level: EventLevel.WARNING,
      message: 'Prowlarr indexer returned partial results',
      details: { indexer: 'Nyaa', expectedResults: 50, receivedResults: 23 }
    },
    
    // Critical events
    {
      type: EventType.SYSTEM_ERROR,
      source: EventSource.SYSTEM,
      level: EventLevel.CRITICAL,
      message: 'Critical: Database connection lost',
      details: { attempts: 5, lastError: 'Connection refused' }
    },
    
    // Debug events
    {
      type: EventType.DOWNLOAD_PROGRESS,
      source: EventSource.DOWNLOAD,
      level: EventLevel.DEBUG,
      message: 'Download progress update',
      details: { progress: 45, speed: '800KB/s' }
    }
  ];

  // Generate events with varied timestamps
  const now = new Date();
  const events = [];

  for (let i = 0; i < 100; i++) {
    // Pick a random template
    const template = eventTemplates[Math.floor(Math.random() * eventTemplates.length)];
    
    // Create timestamp (spread over last 7 days)
    const hoursAgo = Math.floor(Math.random() * 168); // 7 days * 24 hours
    const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
    
    events.push({
      ...template,
      timestamp,
      details: template.details || undefined
    });
  }

  // Sort by timestamp (newest first)
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Insert events
  console.log(`📝 Creating ${events.length} sample events...`);
  
  for (const event of events) {
    await prisma.systemEvent.create({
      data: event
    });
  }

  console.log('\n✅ Sample events generated successfully!');
  
  // Show summary
  const summary = await prisma.systemEvent.groupBy({
    by: ['level'],
    _count: true
  });
  
  console.log('\n📊 Event Summary:');
  summary.forEach(item => {
    console.log(`   ${item.level}: ${item._count} events`);
  });
  
  const total = await prisma.systemEvent.count();
  console.log(`   Total: ${total} events\n`);
}

// Run the script
generateSampleEvents()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
