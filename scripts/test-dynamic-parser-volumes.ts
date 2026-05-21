#!/usr/bin/env npx tsx

import { DynamicWikiParser } from '../src/server/services/fandom/dynamic/DynamicWikiParser';
import axios from 'axios';
import * as cheerio from 'cheerio';

async function testDynamicParserVolumes() {
  console.log('Testing DynamicWikiParser on Fire Force List of Volumes page...\n');

  const url = 'https://fire-force.fandom.com/wiki/List_of_Volumes';
  const missingChapters = ['294', '283', '282', '133', '111', '90', '37', '0'];
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const parser = new DynamicWikiParser($);
    
    console.log('=== EXTRACTING CHAPTERS USING DYNAMIC PARSER ===\n');
    
    // First analyze the page structure
    const structure = await parser.analyzePageStructure(response.data, url);
    console.log(`Page structure: ${structure.type}\n`);
    
    // Then extract data based on the structure
    const result = await parser.extractData({ structure, $, url, html: response.data });
    const chapters = result.data?.chapters || [];
    
    console.log(`Total chapters extracted: ${chapters.length}\n`);
    
    // Check if missing chapters are now extracted
    console.log('=== CHECKING FOR MISSING CHAPTERS ===\n');
    
    const foundMissing: string[] = [];
    const stillMissing: string[] = [];
    
    missingChapters.forEach(chapterNum => {
      const found = chapters.find(ch => 
        ch.number === chapterNum || 
        ch.number === parseInt(chapterNum) ||
        ch.url?.includes(`Chapter_${chapterNum}`)
      );
      
      if (found) {
        foundMissing.push(chapterNum);
        console.log(`Chapter ${chapterNum}: ✓ FOUND`);
        console.log(`  Title: "${found.title}"`);
        console.log(`  Volume: ${found.volume || 'Not specified'}`);
        console.log(`  URL: ${found.url || 'Not specified'}`);
      } else {
        stillMissing.push(chapterNum);
        console.log(`Chapter ${chapterNum}: ✗ NOT FOUND`);
      }
    });
    
    console.log('\n=== SUMMARY ===');
    console.log(`Successfully extracted: ${foundMissing.length}/${missingChapters.length} missing chapters`);
    
    if (foundMissing.length > 0) {
      console.log(`Found chapters: ${foundMissing.join(', ')}`);
    }
    
    if (stillMissing.length > 0) {
      console.log(`Still missing: ${stillMissing.join(', ')}`);
      
      // Debug: Check what chapters we did extract in the relevant volumes
      console.log('\n=== DEBUG: CHAPTERS IN RELEVANT VOLUMES ===');
      
      const relevantVolumes = [1, 5, 11, 13, 16, 32, 33];
      relevantVolumes.forEach(volNum => {
        const volumeChapters = chapters.filter(ch => ch.volume === volNum);
        if (volumeChapters.length > 0) {
          console.log(`\nVolume ${volNum}:`);
          volumeChapters.forEach(ch => {
            console.log(`  Chapter ${ch.number}: "${ch.title}"`);
          });
        }
      });
    }
    
    // Check for duplicate extractions
    const chapterNumbers = chapters.map(ch => ch.number);
    const duplicates = chapterNumbers.filter((num, index) => chapterNumbers.indexOf(num) !== index);
    
    if (duplicates.length > 0) {
      console.log('\n⚠️ WARNING: Duplicate chapter numbers found:', [...new Set(duplicates)].join(', '));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testDynamicParserVolumes();