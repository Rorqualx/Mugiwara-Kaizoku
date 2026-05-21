#!/usr/bin/env npx tsx

import axios from 'axios';
import * as cheerio from 'cheerio';

async function testChapterScraping() {
  console.log('Testing Fire Force chapter scraping issues...\n');

  const problematicChapters = [
    'https://fire-force.fandom.com/wiki/Chapter_294',
    'https://fire-force.fandom.com/wiki/Chapter_283',
    'https://fire-force.fandom.com/wiki/Chapter_282',
    'https://fire-force.fandom.com/wiki/Chapter_133',
    'https://fire-force.fandom.com/wiki/Chapter_111',
    'https://fire-force.fandom.com/wiki/Chapter_90',
    'https://fire-force.fandom.com/wiki/Chapter_37',
    'https://fire-force.fandom.com/wiki/Chapter_0'
  ];

  // First, let's check the main manga page to see how these chapters appear there
  console.log('=== CHECKING MAIN MANGA PAGE ===\n');
  
  try {
    const mainPageUrl = 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)';
    const response = await axios.get(mainPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    // Look for chapter links
    const allChapterLinks = $('a[href*="/wiki/Chapter_"]');
    console.log(`Total chapter links found on main page: ${allChapterLinks.length}\n`);
    
    // Check if our problematic chapters are linked
    for (const chapterUrl of problematicChapters) {
      const chapterNum = chapterUrl.match(/Chapter_(\d+)/)?.[1] || '0';
      const linkExists = $(`a[href*="/wiki/Chapter_${chapterNum}"]`).length > 0;
      
      if (linkExists) {
        const link = $(`a[href*="/wiki/Chapter_${chapterNum}"]`).first();
        const parent = link.parent();
        const grandparent = parent.parent();
        
        console.log(`Chapter ${chapterNum}: ✓ Found on main page`);
        console.log(`  Text: "${link.text().trim()}"`);
        console.log(`  Parent tag: ${parent.prop('tagName')}`);
        console.log(`  In table: ${grandparent.is('table') || grandparent.parent().is('table')}`);
        console.log(`  In list: ${parent.is('li') || grandparent.is('ul, ol')}`);
        
        // Check if it's in a volume table
        const volumeTable = link.closest('table').filter((_, table) => {
          return $(table).text().includes('Volume');
        });
        if (volumeTable.length) {
          const volumeMatch = volumeTable.text().match(/Volume\s*(\d+)/i);
          console.log(`  In Volume: ${volumeMatch ? volumeMatch[1] : 'Unknown'}`);
        }
      } else {
        console.log(`Chapter ${chapterNum}: ✗ NOT found on main page`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('Error fetching main page:', error);
  }

  console.log('\n=== ANALYZING INDIVIDUAL CHAPTER PAGES ===\n');

  for (const url of problematicChapters) {
    const chapterNum = url.match(/Chapter_(\d+)/)?.[1] || '0';
    console.log(`\nChapter ${chapterNum}: ${url}`);
    console.log('=' .repeat(50));
    
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Check page title
      const pageTitle = $('h1').first().text().trim();
      console.log(`Page title: "${pageTitle}"`);
      
      // Look for infobox
      const infobox = $('.portable-infobox, .infobox').first();
      if (infobox.length) {
        console.log('✓ Infobox found');
        
        // Extract key information
        const chapterTitle = infobox.find('.pi-item[data-source="title"] .pi-data-value').text().trim() ||
                           infobox.find('.pi-title').text().trim();
        const chapterNumber = infobox.find('.pi-item[data-source="chapter"] .pi-data-value').text().trim();
        const volumeNumber = infobox.find('.pi-item[data-source="volume"] .pi-data-value').text().trim();
        const pages = infobox.find('.pi-item[data-source="pages"] .pi-data-value').text().trim();
        
        console.log(`  Title: "${chapterTitle}"`);
        console.log(`  Chapter #: "${chapterNumber}"`);
        console.log(`  Volume: "${volumeNumber}"`);
        console.log(`  Pages: "${pages}"`);
        
        // Check for cover image
        const coverImg = infobox.find('img').first();
        if (coverImg.length) {
          const imgSrc = coverImg.attr('src') || coverImg.attr('data-src');
          console.log(`  Cover image: ${imgSrc ? '✓ Found' : '✗ Not found'}`);
          if (imgSrc && imgSrc.startsWith('data:')) {
            console.log(`    (Lazy loaded with data URI)`);
          }
        } else {
          console.log(`  Cover image: ✗ Not found`);
        }
      } else {
        console.log('✗ No infobox found');
      }
      
      // Check for navigation links
      const prevChapter = $('a:contains("Previous")').filter((_, el) => {
        return $(el).attr('href')?.includes('/wiki/Chapter_');
      }).first();
      
      const nextChapter = $('a:contains("Next")').filter((_, el) => {
        return $(el).attr('href')?.includes('/wiki/Chapter_');
      }).first();
      
      console.log(`Navigation:`);
      if (prevChapter.length) {
        const prevNum = prevChapter.attr('href')?.match(/Chapter_(\d+)/)?.[1];
        console.log(`  Previous: Chapter ${prevNum}`);
      } else {
        console.log(`  Previous: Not found`);
      }
      
      if (nextChapter.length) {
        const nextNum = nextChapter.attr('href')?.match(/Chapter_(\d+)/)?.[1];
        console.log(`  Next: Chapter ${nextNum}`);
      } else {
        console.log(`  Next: Not found`);
      }
      
      // Check for any special structures
      const hasTabs = $('.wds-tabber, .tabber').length > 0;
      const hasGallery = $('.gallery, .wikia-gallery').length > 0;
      const hasCollapsible = $('.mw-collapsible').length > 0;
      
      if (hasTabs || hasGallery || hasCollapsible) {
        console.log('Special structures:');
        if (hasTabs) console.log('  - Has tabs');
        if (hasGallery) console.log('  - Has gallery');
        if (hasCollapsible) console.log('  - Has collapsible sections');
      }
      
      // Check if page exists or is a redirect
      const isRedirect = response.request.res.responseUrl !== url;
      if (isRedirect) {
        console.log(`⚠️ Page redirected to: ${response.request.res.responseUrl}`);
      }
      
      // Check for any error messages
      const noArticle = $('.noarticletext').length > 0;
      if (noArticle) {
        console.log('⚠️ Page shows "no article" message');
      }
      
    } catch (error: any) {
      console.log(`✗ Error fetching chapter: ${error.message}`);
      if (error.response?.status === 404) {
        console.log('  Page not found (404)');
      }
    }
  }

  console.log('\n=== CHECKING VOLUME ASSOCIATIONS ===\n');
  
  // Check if these chapters are properly associated with volumes
  try {
    const mainPageUrl = 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)';
    const response = await axios.get(mainPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    // Find all volume tables
    const volumeTables = $('table').filter((_, table) => {
      const $table = $(table);
      return $table.find('th').text().includes('Volume') || 
             $table.find('a[href*="/wiki/Volume_"]').length > 0;
    });
    
    console.log(`Found ${volumeTables.length} volume tables\n`);
    
    // Check which volumes contain our problematic chapters
    const chapterNumbers = ['294', '283', '282', '133', '111', '90', '37', '0'];
    
    volumeTables.each((i, table) => {
      const $table = $(table);
      const volumeHeader = $table.find('th a[href*="/wiki/Volume_"]').first();
      
      if (volumeHeader.length) {
        const volumeText = volumeHeader.text();
        const volumeNum = volumeText.match(/Volume\s*(\d+)/i)?.[1];
        
        // Check if any of our chapters are in this volume
        const foundChapters: string[] = [];
        chapterNumbers.forEach(num => {
          if ($table.find(`a[href*="/wiki/Chapter_${num}"]`).length > 0) {
            foundChapters.push(num);
          }
        });
        
        if (foundChapters.length > 0) {
          console.log(`Volume ${volumeNum}: Contains chapters ${foundChapters.join(', ')}`);
        }
      }
    });
    
  } catch (error) {
    console.error('Error checking volume associations:', error);
  }
}

testChapterScraping();