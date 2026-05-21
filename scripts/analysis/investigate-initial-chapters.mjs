#!/usr/bin/env node

/**
 * Script to investigate where the initial 2 chapters come from when creating manga
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function investigate() {
  try {
    console.log('=== Investigating Initial Chapter Creation ===\n');
    
    // Look for Fire Force manga
    const fireForce = await prisma.manga.findFirst({
      where: {
        OR: [
          { title: { contains: 'Fire Force' } },
          { title: { contains: 'fire force' } }
        ]
      },
      include: {
        metadata: true,
        chapters: {
          orderBy: { index: 'asc' },
          take: 10
        }
      }
    });

    if (!fireForce) {
      console.log('❌ Fire Force manga not found');
      return;
    }

    console.log(`Found: ${fireForce.title} (ID: ${fireForce.id})`);
    console.log(`Source: ${fireForce.source}`);
    console.log(`Created: ${fireForce.createdAt}`);
    
    if (fireForce.metadata) {
      console.log(`\nMetadata:`);
      console.log(`- Volumes: ${fireForce.metadata.volumes}`);
      console.log(`- Chapters: ${fireForce.metadata.chapters}`);
    }
    
    console.log(`\nActual chapters in database: ${fireForce.chapters.length}`);
    
    if (fireForce.chapters.length > 0) {
      console.log('\nFirst few chapters:');
      fireForce.chapters.forEach(ch => {
        console.log(`- Chapter ${ch.index}: "${ch.title}" (ID: ${ch.id})`);
        console.log(`  File: ${ch.fileName}`);
        console.log(`  Created: ${ch.createdAt}`);
      });
    }
    
    // Check if there are any tasks related to this manga
    const tasks = await prisma.task.findMany({
      where: {
        mangaId: fireForce.id
      },
      orderBy: { createdAt: 'asc' },
      take: 10
    });
    
    if (tasks.length > 0) {
      console.log(`\n\nTasks for this manga:`);
      tasks.forEach(task => {
        console.log(`- ${task.type} (${task.status}) - Created: ${task.createdAt}`);
        if (task.payload) {
          console.log(`  Payload: ${JSON.stringify(task.payload)}`);
        }
      });
    }
    
    // Check system events
    const events = await prisma.event.findMany({
      where: {
        OR: [
          { relatedEntityId: fireForce.id.toString() },
          { message: { contains: fireForce.title } }
        ]
      },
      orderBy: { createdAt: 'asc' },
      take: 20
    });
    
    if (events.length > 0) {
      console.log(`\n\nSystem events:`);
      events.forEach(event => {
        console.log(`- ${event.type} (${event.level}) - ${event.message}`);
        console.log(`  Created: ${event.createdAt}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigate();