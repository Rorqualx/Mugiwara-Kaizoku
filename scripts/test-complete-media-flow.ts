#!/usr/bin/env tsx
/**
 * Test script to verify complete media flow with Fire Force
 */

import { FandomService } from '../src/server/services/fandom/FandomService.js';
import { SourceManagementService } from '../src/components/addManga/services/sourceManagementService.js';

async function testMediaExtraction() {
  console.log('\n=== Testing Complete Media Flow ===\n');

  // Test Fandom Service directly
  const fandomService = new FandomService('fire-force');

  try {
    console.log('1. Fetching Fire Force metadata from Fandom...');
    const metadata = await fandomService.getPageMetadata('Fire Force (manga)');

    console.log('\n✅ Fandom Metadata:');
    console.log('   - Title:', metadata?.title);
    console.log('   - Has coverImage:', !!metadata?.coverImage);
    console.log('   - Cover URL:', metadata?.coverImage);
    console.log('   - Has gallery:', !!metadata?.gallery);
    console.log('   - Gallery length:', metadata?.gallery?.length || 0);
    console.log('   - Gallery sample:', metadata?.gallery?.slice(0, 3));
    console.log('   - Has volumes:', !!metadata?.volumes);
    console.log('   - Volumes count:', metadata?.volumes || 0);

    // Simulate what WizardContext would do
    console.log('\n2. Simulating WizardContext initialization...');
    const initialMetadata: any = {
      fandom: {
        id: 'fire-force:fire-force-manga',
        title: metadata?.title || '',
        coverImage: metadata?.coverImage || '',
        gallery: metadata?.gallery || [],
        volumeData: [],
        volumes: metadata?.volumes,
        chapters: metadata?.chapters
      }
    };

    // Simulate media gallery state
    const mediaGallery = {
      covers: [],
      coversWithProviders: [],
      banners: [],
      gallery: [],
      volumeCovers: [],
      chapterCovers: []
    };

    // Mock setMediaGallery function
    const setMediaGallery = (updater: any) => {
      if (typeof updater === 'function') {
        Object.assign(mediaGallery, updater(mediaGallery));
      } else {
        Object.assign(mediaGallery, updater);
      }
    };

    console.log('\n3. Calling extractPrimaryProviderMedia...');
    const sourceService = new SourceManagementService(null as any);
    sourceService.extractPrimaryProviderMedia(
      'fandom',
      initialMetadata.fandom,
      setMediaGallery
    );

    console.log('\n✅ Media Gallery After Extraction:');
    console.log('   - Covers:', mediaGallery.covers.length);
    console.log('   - Cover URLs:', mediaGallery.covers);
    console.log('   - Gallery items:', mediaGallery.gallery.length);
    console.log('   - Gallery sample:', mediaGallery.gallery.slice(0, 3));
    console.log('   - Volume covers:', mediaGallery.volumeCovers.length);
    console.log('   - Chapter covers:', mediaGallery.chapterCovers.length);

    // Test Anilist flow
    console.log('\n4. Testing Anilist metadata flow...');
    const anilistMetadata = {
      id: 'anilist:103936',
      title: 'Fire Force',
      coverImage: 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx103936-qC1iFQRm1sVS.jpg',
      bannerImage: 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/103936-3KnzEbKyuWqG.jpg',
      gallery: [], // Anilist doesn't have gallery
      volumeData: []
    };

    // Simulate processing additional source (what happens in the actual app)
    // Add Anilist cover to covers
    if (anilistMetadata.coverImage) {
      setMediaGallery((prev: any) => ({
        ...prev,
        covers: [...new Set([...prev.covers, anilistMetadata.coverImage])],
        coversWithProviders: [...prev.coversWithProviders, { url: anilistMetadata.coverImage, provider: 'anilist' }]
      }));
    }

    // Add Anilist banner
    if (anilistMetadata.bannerImage) {
      setMediaGallery((prev: any) => ({
        ...prev,
        banners: [...new Set([...prev.banners, anilistMetadata.bannerImage])]
      }));
    }

    console.log('\n✅ Media Gallery After Anilist:');
    console.log('   - Total covers:', mediaGallery.covers.length);
    console.log('   - All cover URLs:', mediaGallery.covers);
    console.log('   - Covers with providers:', mediaGallery.coversWithProviders);
    console.log('   - Banners:', mediaGallery.banners.length);
    console.log('   - Banner URLs:', mediaGallery.banners);

    // Verify all expected covers are present
    console.log('\n5. Verification Summary:');
    const hasFandomCover = mediaGallery.covers.some(url => url.includes('fandom.com'));
    const hasAnilistCover = mediaGallery.covers.some(url => url.includes('anilist.co'));
    const hasFandomGallery = mediaGallery.gallery.length > 0;

    console.log(`   ✅ Fandom cover present: ${hasFandomCover}`);
    console.log(`   ✅ Anilist cover present: ${hasAnilistCover}`);
    console.log(`   ✅ Fandom gallery populated: ${hasFandomGallery} (${mediaGallery.gallery.length} items)`);
    console.log(`   ✅ All covers tracked: ${mediaGallery.coversWithProviders.length} covers with provider info`);

    if (!hasFandomCover || !hasAnilistCover || !hasFandomGallery) {
      console.log('\n❌ ISSUE DETECTED:');
      if (!hasFandomCover) console.log('   - Fandom cover missing from mediaGallery.covers');
      if (!hasAnilistCover) console.log('   - Anilist cover missing from mediaGallery.covers');
      if (!hasFandomGallery) console.log('   - Fandom gallery not populated');
    } else {
      console.log('\n✅ All media extraction working correctly!');
    }

  } catch (error) {
    console.error('Error during test:', error);
  }
}

async function main() {
  console.log('Starting complete media flow test...');
  await testMediaExtraction();
  process.exit(0);
}

main().catch(console.error);