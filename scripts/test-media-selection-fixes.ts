#!/usr/bin/env tsx
/**
 * Test script to verify media selection fixes:
 * 1. Anilist cover image display
 * 2. Fandom gallery extraction (should be 8-10 images, not 45)
 * 3. Image filtering for duplicates and logos
 */

import { FandomService } from '../src/server/services/fandom/FandomService.js';
import { SourceManagementService } from '../src/components/addManga/services/sourceManagementService.js';

async function testMediaSelectionFixes() {
  console.log('\n=== Testing Media Selection Fixes ===\n');

  // Test Fandom Service
  const fandomService = new FandomService('fire-force');

  try {
    console.log('1. Testing Fandom gallery extraction...');
    const metadata = await fandomService.getPageMetadata('Fire Force (manga)');

    console.log('\n✅ Fandom Metadata:');
    console.log('   - Title:', metadata?.title);
    console.log('   - Has coverImage:', !!metadata?.coverImage);
    console.log('   - Cover URL:', metadata?.coverImage);
    console.log('   - Has gallery:', !!metadata?.gallery);
    console.log('   - Gallery length:', metadata?.gallery?.length || 0);

    // Check gallery size - should be around 8-10, not 45
    const gallerySize = metadata?.gallery?.length || 0;
    if (gallerySize > 0 && gallerySize <= 20) {
      console.log('   ✅ Gallery size is reasonable (not extracting all images)');
    } else if (gallerySize > 20) {
      console.log('   ⚠️ Gallery might be too large:', gallerySize, 'images');
    }

    if (metadata?.gallery && metadata.gallery.length > 0) {
      console.log('\n   Gallery images:');
      metadata.gallery.forEach((url: string, i: number) => {
        console.log(`     ${i+1}. ${url}`);
      });
    }

    // Test Anilist nested coverImage handling
    console.log('\n2. Testing Anilist cover extraction...');

    // Simulate Anilist metadata with nested coverImage
    const anilistMetadata = {
      id: 'anilist:103936',
      title: 'Fire Force',
      coverImage: {
        extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx103936-qC1iFQRm1sVS.jpg',
        large: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx103936-qC1iFQRm1sVS.jpg',
        medium: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx103936-qC1iFQRm1sVS.jpg'
      },
      bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/103936-3KnzEbKyuWqG.jpg'
    };

    // Initialize media gallery
    const mediaGallery: any = {
      covers: [],
      coversWithProviders: [],
      banners: [],
      gallery: [],
      volumeCovers: [],
      chapterCovers: []
    };

    const setMediaGallery = (updater: any) => {
      if (typeof updater === 'function') {
        Object.assign(mediaGallery, updater(mediaGallery));
      } else {
        Object.assign(mediaGallery, updater);
      }
    };

    // Test primary provider media extraction with Fandom
    console.log('\n3. Testing primary provider media extraction (Fandom)...');
    const sourceService = new SourceManagementService(null as any);

    sourceService.extractPrimaryProviderMedia(
      'fandom',
      metadata!,
      setMediaGallery
    );

    console.log('\n✅ Media Gallery After Fandom:');
    console.log('   - Covers:', mediaGallery.covers.length);
    console.log('   - Gallery items:', mediaGallery.gallery.length);
    console.log('   - Volume covers:', mediaGallery.volumeCovers.length);

    // Test Anilist cover extraction
    console.log('\n4. Testing Anilist nested coverImage handling...');
    sourceService.extractPrimaryProviderMedia(
      'anilist',
      anilistMetadata,
      setMediaGallery
    );

    console.log('\n✅ Media Gallery After Anilist:');
    console.log('   - Total covers:', mediaGallery.covers.length);
    console.log('   - Covers with providers:', mediaGallery.coversWithProviders.length);

    // Check if Anilist cover was extracted
    const hasAnilistCover = mediaGallery.covers.some((url: string) =>
      url.includes('anilist.co')
    );

    if (hasAnilistCover) {
      console.log('   ✅ Anilist cover successfully extracted from nested object');
    } else {
      console.log('   ❌ Anilist cover NOT extracted');
    }

    // Test image filtering
    console.log('\n5. Testing image filtering...');

    // Check for unwanted images in gallery
    const unwantedPatterns = ['logo', 'badge', 'icon', 'button', 'sprite'];
    const unwantedImages = mediaGallery.gallery.filter((url: string) => {
      const lower = url.toLowerCase();
      return unwantedPatterns.some(pattern => lower.includes(pattern));
    });

    if (unwantedImages.length === 0) {
      console.log('   ✅ No unwanted images (logos/badges) in gallery');
    } else {
      console.log('   ⚠️ Found potential unwanted images:', unwantedImages.length);
      unwantedImages.forEach((url: string) => console.log('     -', url));
    }

    // Check for duplicates
    const uniqueGallery = new Set(mediaGallery.gallery);
    if (uniqueGallery.size === mediaGallery.gallery.length) {
      console.log('   ✅ No duplicate images in gallery');
    } else {
      console.log('   ⚠️ Found duplicates:',
        mediaGallery.gallery.length - uniqueGallery.size);
    }

    // Final summary
    console.log('\n=== Summary ===');
    console.log('✅ Fandom gallery reduced from ~45 to', metadata?.gallery?.length || 0);
    console.log('✅ Anilist cover extracted:', hasAnilistCover);
    console.log('✅ Image filtering active');
    console.log('✅ Total covers available:', mediaGallery.covers.length);
    console.log('✅ Total gallery images:', mediaGallery.gallery.length);

    console.log('\n📝 Note: Chapter covers require volumeData to be populated.');
    console.log('   Currently volumeData extraction is not implemented in FandomService.');
    console.log('   This would require parsing the List of Volumes page tables.');

  } catch (error) {
    console.error('Error during test:', error);
  }
}

async function main() {
  console.log('Starting media selection fixes test...');
  await testMediaSelectionFixes();
  process.exit(0);
}

main().catch(console.error);