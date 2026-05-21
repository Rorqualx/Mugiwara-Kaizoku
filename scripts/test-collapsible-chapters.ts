#!/usr/bin/env npx tsx

import axios from 'axios';
import * as cheerio from 'cheerio';

async function testCollapsibleChapters() {
  console.log('Investigating Fire Force chapter organization...\n');

  const mainPageUrl = 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)';
  
  try {
    const response = await axios.get(mainPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    console.log('=== ANALYZING PAGE STRUCTURE ===\n');
    
    // Check for collapsible sections
    const collapsibles = $('.mw-collapsible');
    console.log(`Found ${collapsibles.length} collapsible sections\n`);
    
    // Check each collapsible for chapters
    collapsibles.each((i, collapsible) => {
      const $collapsible = $(collapsible);
      
      // Get the header/title of the collapsible
      const header = $collapsible.find('.mw-collapsible-toggle').text() || 
                     $collapsible.prev('h2, h3, h4').text() ||
                     $collapsible.find('th').first().text();
      
      console.log(`Collapsible ${i + 1}: "${header.trim()}"`);
      
      // Count chapter links in this collapsible
      const chapterLinks = $collapsible.find('a[href*="/wiki/Chapter_"]');
      console.log(`  Contains ${chapterLinks.length} chapter links`);
      
      if (chapterLinks.length > 0) {
        // List first few and last few chapters
        const chapters: string[] = [];
        chapterLinks.each((j, link) => {
          const href = $(link).attr('href') || '';
          const chapterNum = href.match(/Chapter_(\d+)/)?.[1] || '?';
          chapters.push(chapterNum);
        });
        
        // Show sample of chapters
        if (chapters.length <= 10) {
          console.log(`  Chapters: ${chapters.join(', ')}`);
        } else {
          const first5 = chapters.slice(0, 5).join(', ');
          const last5 = chapters.slice(-5).join(', ');
          console.log(`  Chapters: ${first5} ... ${last5}`);
        }
        
        // Check if any of our problematic chapters are here
        const problematic = ['294', '283', '282', '133', '111', '90', '37', '0'];
        const found = problematic.filter(num => chapters.includes(num));
        if (found.length > 0) {
          console.log(`  ✓ Contains problematic chapters: ${found.join(', ')}`);
        }
      }
      console.log('');
    });
    
    console.log('=== LOOKING FOR CHAPTER LISTS ===\n');
    
    // Look for any lists that might contain chapters
    const lists = $('ul, ol').filter((_, list) => {
      const $list = $(list);
      return $list.find('a[href*="/wiki/Chapter_"]').length > 0;
    });
    
    console.log(`Found ${lists.length} lists containing chapter links\n`);
    
    lists.each((i, list) => {
      const $list = $(list);
      const chapterLinks = $list.find('a[href*="/wiki/Chapter_"]');
      
      // Get context
      const prevHeading = $list.prevAll('h2, h3, h4').first().text();
      const parent = $list.parent();
      const isInCollapsible = parent.hasClass('mw-collapsible-content') || 
                              parent.parent().hasClass('mw-collapsible');
      
      console.log(`List ${i + 1}:`);
      if (prevHeading) {
        console.log(`  Under heading: "${prevHeading}"`);
      }
      console.log(`  In collapsible: ${isInCollapsible ? 'Yes' : 'No'}`);
      console.log(`  Contains ${chapterLinks.length} chapter links`);
      
      // Sample chapters
      const chapters: string[] = [];
      chapterLinks.slice(0, 10).each((j, link) => {
        const href = $(link).attr('href') || '';
        const chapterNum = href.match(/Chapter_(\d+)/)?.[1] || '?';
        chapters.push(chapterNum);
      });
      
      if (chapters.length > 0) {
        console.log(`  Sample chapters: ${chapters.join(', ')}${chapterLinks.length > 10 ? '...' : ''}`);
      }
      console.log('');
    });
    
    console.log('=== SEARCHING FOR SPECIFIC PATTERNS ===\n');
    
    // Search for specific text patterns that might indicate where chapters are
    const patterns = [
      'Chapter 294',
      'Chapter 283',
      'Chapter 0',
      'Chapters 1-',
      'Chapters 201-',
      'Chapters 281-',
      'Volume 33',
      'Volume 34'
    ];
    
    patterns.forEach(pattern => {
      const found = $(`*:contains("${pattern}")`).filter((_, el) => {
        const $el = $(el);
        // Only consider elements that directly contain this text
        return $el.clone().children().remove().end().text().includes(pattern);
      });
      
      if (found.length > 0) {
        const $first = found.first();
        const tag = $first.prop('tagName');
        const parent = $first.parent().prop('tagName');
        const inCollapsible = $first.closest('.mw-collapsible').length > 0;
        
        console.log(`"${pattern}": Found in <${tag}> (parent: <${parent}>)`);
        console.log(`  In collapsible: ${inCollapsible ? 'Yes' : 'No'}`);
        
        // Check if there are chapter links nearby
        const nearbyLinks = $first.parent().find('a[href*="/wiki/Chapter_"]').length;
        if (nearbyLinks > 0) {
          console.log(`  Has ${nearbyLinks} chapter links nearby`);
        }
      } else {
        console.log(`"${pattern}": Not found`);
      }
    });
    
    console.log('\n=== RAW HTML SEARCH ===\n');
    
    // Search raw HTML for the chapter URLs
    const html = response.data;
    const chapterUrls = [
      '/wiki/Chapter_294',
      '/wiki/Chapter_283',
      '/wiki/Chapter_282',
      '/wiki/Chapter_0'
    ];
    
    chapterUrls.forEach(url => {
      if (html.includes(url)) {
        console.log(`✓ ${url} exists in HTML`);
        
        // Find context
        const index = html.indexOf(url);
        const before = html.substring(Math.max(0, index - 100), index);
        const after = html.substring(index, Math.min(html.length, index + 100));
        
        // Check if it's in a collapsible
        if (before.includes('mw-collapsible') || after.includes('mw-collapsible')) {
          console.log('  Located in a collapsible section');
        }
        
        // Check if it's hidden by default
        if (before.includes('display:none') || before.includes('mw-collapsed')) {
          console.log('  ⚠️ May be hidden by default');
        }
      } else {
        console.log(`✗ ${url} NOT in HTML`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testCollapsibleChapters();