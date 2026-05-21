#!/usr/bin/env node

/**
 * Script to fix Fire Force metadata with correct volume/chapter counts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixFireForceMetadata() {
  try {
    console.log('=== Fixing Fire Force Metadata ===\n');
    
    // Find Fire Force manga
    const fireForce = await prisma.manga.findFirst({
      where: {
        OR: [
          { title: { contains: 'Fire Force' } },
          { title: { contains: 'fire force' } }
        ]
      },
      include: {
        metadata: true
      }
    });

    if (!fireForce) {
      console.log('❌ Fire Force manga not found in database');
      return;
    }

    console.log(`Found: ${fireForce.title} (ID: ${fireForce.id})`);
    
    if (!fireForce.metadata) {
      console.log('❌ No metadata found for Fire Force');
      return;
    }
    
    console.log('\nCurrent metadata:');
    console.log(`- Volumes: ${fireForce.metadata.volumes}`);
    console.log(`- Chapters: ${fireForce.metadata.chapters}`);
    
    // Update metadata with correct values
    const updatedMetadata = await prisma.metadata.update({
      where: { id: fireForce.metadata.id },
      data: {
        volumes: 34,  // Correct number of volumes
        chapters: 304  // Correct number of chapters
      }
    });
    
    console.log('\n✅ Updated metadata:');
    console.log(`- Volumes: ${updatedMetadata.volumes}`);
    console.log(`- Chapters: ${updatedMetadata.chapters}`);
    
    // Verify the update
    const verifyManga = await prisma.manga.findUnique({
      where: { id: fireForce.id },
      include: { metadata: true }
    });
    
    console.log('\n🔍 Verification:');
    console.log(`- Manga: ${verifyManga?.title}`);
    console.log(`- Metadata Volumes: ${verifyManga?.metadata?.volumes}`);
    console.log(`- Metadata Chapters: ${verifyManga?.metadata?.chapters}`);
    
  } catch (error) {
    console.error('Error fixing metadata:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixFireForceMetadata();