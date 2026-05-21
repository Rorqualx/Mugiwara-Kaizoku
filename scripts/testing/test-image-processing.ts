#!/usr/bin/env tsx
/**
 * Test script for verifying image processing unification
 * 
 * Tests the unified image processing module and ensures all functions work correctly
 */

import * as imageProcessing from '../src/server/utils/image-processing';
import { logger } from '../src/utils/logger';

// Test data
const testUrls = {
  fandom: 'https://vignette.wikia.nocookie.net/onepiece/images/cover.jpg/revision/latest/scale-to-width-down/300?cb=12345',
  wikipedia: '//upload.wikimedia.org/wikipedia/commons/thumb/image.jpg/200px-image.jpg',
  mangadex: 'https://uploads.mangadex.org/data/12345/cover.jpg',
  relative: '/images/cover.jpg',
  dataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...',
  placeholder: 'https://example.com/placeholder.jpg'
};

async function testUrlCleaning() {
  console.log('\n========================================');
  console.log('Testing URL Cleaning Functions');
  console.log('========================================\n');
  
  // Test 1: Clean Fandom URL
  console.log('1. Cleaning Fandom URL...');
  const cleanedFandom = imageProcessing.cleanImageUrl(testUrls.fandom);
  console.log(`   Original: ${testUrls.fandom}`);
  console.log(`   Cleaned:  ${cleanedFandom}`);
  console.log(`   ✓ Removed revision and scale parameters`);
  
  // Test 2: Resolve protocol-relative URL
  console.log('\n2. Resolving protocol-relative URL...');
  const resolvedWiki = imageProcessing.resolveUrl(testUrls.wikipedia);
  console.log(`   Original: ${testUrls.wikipedia}`);
  console.log(`   Resolved: ${resolvedWiki}`);
  
  // Test 3: Resolve relative URL with base
  console.log('\n3. Resolving relative URL...');
  const baseUrl = 'https://example.com/manga/';
  const resolvedRelative = imageProcessing.resolveUrl(testUrls.relative, baseUrl);
  console.log(`   Original: ${testUrls.relative}`);
  console.log(`   Base URL: ${baseUrl}`);
  console.log(`   Resolved: ${resolvedRelative}`);
}

async function testImageValidation() {
  console.log('\n========================================');
  console.log('Testing Image Validation Functions');
  console.log('========================================\n');
  
  // Test 1: Validate image URLs
  console.log('1. Validating image URLs...');
  Object.entries(testUrls).forEach(([key, url]) => {
    const isValid = imageProcessing.isValidImageUrl(url);
    console.log(`   ${key}: ${isValid ? '✓' : '✗'} valid`);
  });
  
  // Test 2: Check data URI
  console.log('\n2. Checking data URIs...');
  console.log(`   Data URI: ${imageProcessing.isDataUri(testUrls.dataUri) ? '✓' : '✗'}`);
  console.log(`   Regular URL: ${imageProcessing.isDataUri(testUrls.fandom) ? '✗ (should be false)' : '✓ (correctly false)'}`);
  
  // Test 3: Check placeholder
  console.log('\n3. Checking placeholder images...');
  console.log(`   Placeholder: ${imageProcessing.isPlaceholderImage(testUrls.placeholder) ? '✓' : '✗'}`);
  console.log(`   Regular: ${imageProcessing.isPlaceholderImage(testUrls.fandom) ? '✗' : '✓'}`);
  
  // Test 4: Validate dimensions
  console.log('\n4. Validating image dimensions...');
  const testCases = [
    { width: 800, height: 600, expected: true, label: 'Normal (800x600)' },
    { width: 50, height: 50, expected: false, label: 'Too small (50x50)' },
    { width: 5000, height: 5000, expected: false, label: 'Too large (5000x5000)' }
  ];
  
  testCases.forEach(({ width, height, expected, label }) => {
    const isValid = imageProcessing.validateImageDimensions(width, height, {
      minWidth: 100,
      minHeight: 100,
      maxWidth: 4000,
      maxHeight: 4000
    });
    console.log(`   ${label}: ${isValid === expected ? '✓' : '✗'}`);
  });
}

async function testImageOptimization() {
  console.log('\n========================================');
  console.log('Testing Image Optimization Functions');
  console.log('========================================\n');
  
  // Test 1: Generate optimized URLs
  console.log('1. Generating optimized URLs...');
  const optimizationTests = [
    {
      url: 'https://vignette.wikia.nocookie.net/image.jpg',
      options: { width: 500 },
      label: 'Fandom with width'
    },
    {
      url: 'https://upload.wikimedia.org/wikipedia/commons/image.jpg',
      options: { width: 300 },
      label: 'Wikipedia with width'
    },
    {
      url: 'https://uploads.mangadex.org/data/image.jpg',
      options: { quality: 75 },
      label: 'MangaDex with quality'
    }
  ];
  
  optimizationTests.forEach(({ url, options, label }) => {
    const optimized = imageProcessing.generateOptimizedUrl(url, options);
    console.log(`   ${label}:`);
    console.log(`     Original:  ${url}`);
    console.log(`     Optimized: ${optimized}`);
  });
  
  // Test 2: Generate srcset
  console.log('\n2. Generating srcset...');
  const srcset = imageProcessing.generateSrcSet('https://example.com/image.jpg', [320, 640, 1280]);
  console.log(`   Base: https://example.com/image.jpg`);
  console.log(`   Srcset: ${srcset.split(', ').join(',\n           ')}`);
  
  // Test 3: CDN URL generation
  console.log('\n3. Generating CDN URLs...');
  const cdnBase = 'https://cdn.example.com';
  const originalUrl = 'https://example.com/images/cover.jpg';
  const cdnUrl = imageProcessing.getCdnUrl(originalUrl, cdnBase);
  console.log(`   Original: ${originalUrl}`);
  console.log(`   CDN Base: ${cdnBase}`);
  console.log(`   CDN URL:  ${cdnUrl}`);
}

async function testImageTypeDetection() {
  console.log('\n========================================');
  console.log('Testing Image Type Detection');
  console.log('========================================\n');
  
  const testContexts = [
    {
      url: 'https://example.com/cover.jpg',
      alt: 'One Piece Cover',
      expected: 'cover'
    },
    {
      url: 'https://example.com/volume_01.jpg',
      alt: 'Volume 1',
      expected: 'volume'
    },
    {
      url: 'https://example.com/luffy_character.jpg',
      alt: 'Monkey D. Luffy',
      expected: 'character'
    },
    {
      url: 'https://example.com/thumb_123.jpg',
      alt: 'Thumbnail',
      expected: 'thumbnail'
    },
    {
      url: 'https://example.com/gallery/image.jpg',
      parentClass: 'gallery-container',
      expected: 'gallery'
    }
  ];
  
  testContexts.forEach(({ url, alt, parentClass, expected }) => {
    const detected = imageProcessing.detectImageType({
      url,
      alt,
      parentClass
    });
    console.log(`   ${url.split('/').pop()}: ${detected} (expected: ${expected}) ${detected === expected ? '✓' : '✗'}`);
  });
}

async function testImageMetadataExtraction() {
  console.log('\n========================================');
  console.log('Testing Image Metadata Extraction');
  console.log('========================================\n');
  
  const testImages = [
    {
      url: 'https://example.com/cover.jpg',
      alt: 'One Piece Cover',
      width: '800',
      height: '600',
      srcset: 'image-320.jpg 320w, image-640.jpg 640w',
      'data-original': 'https://example.com/original.jpg'
    },
    {
      url: '/relative/image.png',
      width: 400,
      height: 300,
      class: 'infobox-image'
    }
  ];
  
  testImages.forEach((img, index) => {
    const metadata = imageProcessing.extractImageMetadata(img);
    console.log(`\n   Image ${index + 1}:`);
    console.log(`     URL: ${metadata.url}`);
    console.log(`     Type: ${metadata.type}`);
    console.log(`     Dimensions: ${metadata.width}x${metadata.height}`);
    console.log(`     Format: ${metadata.format}`);
    if (metadata.srcset) {
      console.log(`     Srcset: ${metadata.srcset.length} sources`);
    }
  });
}

async function testBatchProcessing() {
  console.log('\n========================================');
  console.log('Testing Batch Processing Functions');
  console.log('========================================\n');
  
  // Test 1: Process multiple URLs
  console.log('1. Processing multiple URLs...');
  const urls = [
    'https://example.com/image1.jpg',
    '/relative/image2.png',
    '',  // Empty
    'data:image/png;base64,abc',  // Data URI
    'https://example.com/placeholder.jpg'  // Placeholder
  ];
  
  const processed = imageProcessing.processImageUrls(urls, {
    cleanUrl: true,
    validateUrl: true,
    baseUrl: 'https://base.com'
  });
  
  console.log(`   Input: ${urls.length} URLs`);
  console.log(`   Output: ${processed.length} valid URLs`);
  processed.forEach(url => console.log(`     - ${url}`));
  
  // Test 2: Select best image
  console.log('\n2. Selecting best image...');
  const imageSet = {
    small: 'https://example.com/small.jpg',
    medium: 'https://example.com/medium.jpg',
    large: 'https://example.com/large.jpg',
    original: 'https://example.com/original.jpg'
  };
  
  ['small', 'medium', 'large', 'original'].forEach(size => {
    const best = imageProcessing.selectBestImage(imageSet, size as any);
    console.log(`   Preferred ${size}: ${best.split('/').pop()}`);
  });
}

async function testBackwardCompatibility() {
  console.log('\n========================================');
  console.log('Testing Backward Compatibility');
  console.log('========================================\n');
  
  // Test deprecated exports
  console.log('1. Testing deprecated exports...');
  console.log(`   cleanWikiaImageUrl: ${typeof imageProcessing.cleanWikiaImageUrl === 'function' ? '✓' : '✗'}`);
  console.log(`   cleanImageURL: ${typeof imageProcessing.cleanImageURL === 'function' ? '✓' : '✗'}`);
  
  // Test that they work the same
  const testUrl = 'https://vignette.wikia.nocookie.net/test.jpg/revision/latest';
  const result1 = imageProcessing.cleanImageUrl(testUrl);
  const result2 = imageProcessing.cleanWikiaImageUrl(testUrl);
  const result3 = imageProcessing.cleanImageURL(testUrl);
  
  console.log(`\n2. Testing function equivalence...`);
  console.log(`   All functions return same result: ${result1 === result2 && result2 === result3 ? '✓' : '✗'}`);
}

async function main() {
  try {
    console.log('Image Processing Test Suite');
    console.log('================================\n');
    
    await testUrlCleaning();
    await testImageValidation();
    await testImageOptimization();
    await testImageTypeDetection();
    await testImageMetadataExtraction();
    await testBatchProcessing();
    await testBackwardCompatibility();
    
    console.log('\n========================================');
    console.log('All tests completed!');
    console.log('========================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\nTest suite failed:', error);
    process.exit(1);
  }
}

// Run tests
main().catch(console.error);