#!/usr/bin/env node

/**
 * Script to verify Fire Force metadata is correct
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyFireForce() {
  try {
    const fireForce = await prisma.manga.findFirst({
      where: {
        OR: [
          { title: { contains: 'Fire Force' } },
          { title: { contains: 'fire force' } }
        ]
      },
      include: {
        metadata: true,
        chapters: true
      }
    });

    if (!fireForce) {
      console.log('❌ Fire Force manga not found');
      return;
    }

    console.log('=== Fire Force Verification ===\n');
    console.log(`Manga: ${fireForce.title} (ID: ${fireForce.id})`);
    console.log(`Status: ${fireForce.status}`);
    
    if (fireForce.metadata) {
      console.log(`\nMetadata:`);
      console.log(`- Volumes: ${fireForce.metadata.volumes}`);
      console.log(`- Chapters: ${fireForce.metadata.chapters}`);
      console.log(`- Status: ${fireForce.metadata.status}`);
      console.log(`- Year: ${fireForce.metadata.year}`);
    }
    
    console.log(`\nDatabase Chapters: ${fireForce.chapters.length}`);
    
    // Check for mock chapters
    const mockChapters = fireForce.chapters.filter(ch => ch.title.includes('Mock'));
    if (mockChapters.length > 0) {
      console.log(`\n⚠️  Found ${mockChapters.length} mock chapters:`);
      mockChapters.forEach(ch => {
        console.log(`   - ${ch.title}`);
      });
    } else {
      console.log('\n✅ No mock chapters found');
    }
    
    // Verify metadata values
    if (fireForce.metadata?.volumes === 34 && fireForce.metadata?.chapters === 304) {
      console.log('\n✅ Metadata values are correct (34 volumes, 304 chapters)');
    } else {
      console.log('\n❌ Metadata values are incorrect');
      console.log('   Expected: 34 volumes, 304 chapters');
      console.log(`   Actual: ${fireForce.metadata?.volumes || 0} volumes, ${fireForce.metadata?.chapters || 0} chapters`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyFireForce();