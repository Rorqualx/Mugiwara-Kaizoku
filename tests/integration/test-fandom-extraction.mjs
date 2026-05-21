#!/usr/bin/env node

import axios from 'axios';
import * as cheerio from 'cheerio';

async function testFandomExtraction() {
  const url = 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)';
  
  console.log('Fetching Fire Force Fandom page...');
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MangaManager/1.0)'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    console.log('\n=== ANALYZING FIRE FORCE WIKI PAGE ===\n');
    console.log('Response length:', response.data.length);
    console.log('First 500 chars:', response.data.substring(0, 500));
    
    // Check page title - try different selectors
    const pageTitle = $('.page-header__title').text().trim() || 
                     $('.mw-page-title-main').text().trim() ||
                     $('h1').first().text().trim();
    console.log('Page Title:', pageTitle);
    
    // Check for any h1 tags
    console.log('\nAll H1 tags:');
    $('h1').each((i, elem) => {
      console.log(`  H1[${i}]: ${$(elem).text().trim()}`);
    });
    
    // Check main article content for metadata
    console.log('\n=== MAIN ARTICLE CONTENT ===');
    
    // Look for the first paragraph which often contains title info
    const firstParagraph = $('.mw-parser-output > p').first().text();
    console.log('First paragraph:', firstParagraph ? firstParagraph.substring(0, 300) : 'Not found');
    
    // Look for text containing Japanese characters or romanization
    $('.mw-parser-output p, .mw-parser-output li').each((i, elem) => {
      const text = $(elem).text();
      // Check for Japanese text patterns
      if (text.includes('炎炎ノ消防隊') || text.includes("En'en no Shōbōtai") || text.includes('Enen no Shouboutai')) {
        console.log(`\nFound title reference in element ${i}:`);
        console.log(text.substring(0, 200));
      }
    });
    
    // Look for all infobox fields - try multiple selectors
    console.log('\n=== INFOBOX FIELDS ===');
    
    // Check for portable infobox
    console.log('Portable infobox found:', $('.portable-infobox').length > 0);
    console.log('PI data rows found:', $('.pi-data').length);
    console.log('Infobox found:', $('.infobox').length > 0);
    console.log('Aside elements found:', $('aside').length);
    
    // Examine the aside element more closely
    $('aside').each((i, elem) => {
      console.log(`\nAside[${i}] classes:`, $(elem).attr('class'));
      console.log(`Aside[${i}] data attributes:`, $(elem).data());
      
      // Look for any divs or sections inside aside
      $(elem).find('section, div[class*="pi-"], div[data-source]').each((j, child) => {
        const classes = $(child).attr('class');
        const dataSource = $(child).attr('data-source');
        if (classes || dataSource) {
          console.log(`  Child[${j}]: class="${classes}" data-source="${dataSource}"`);
          const text = $(child).text().trim().substring(0, 100);
          if (text) console.log(`    Text: ${text}`);
        }
      });
    });
    
    // Try to find any table with class containing 'infobox'
    $('[class*="infobox"]').each((i, elem) => {
      console.log(`Found element with infobox class: ${$(elem).attr('class')}`);
    });
    
    // Look for table rows in any infobox
    $('aside tr, .infobox tr, table.infobox tr').each((i, elem) => {
      const label = $(elem).find('th').text().trim();
      const value = $(elem).find('td').text().trim();
      if (label && value) {
        console.log(`${label}: ${value.substring(0, 100)}`);
      }
    });
    
    $('.pi-data').each((i, elem) => {
      const label = $(elem).find('.pi-data-label').text().trim();
      const value = $(elem).find('.pi-data-value').text().trim();
      if (label && value) {
        console.log(`${label}: ${value}`);
      }
    });
    
    // Check for data-source attributes
    console.log('\n=== DATA-SOURCE ATTRIBUTES ===');
    $('[data-source]').each((i, elem) => {
      const source = $(elem).attr('data-source');
      const value = $(elem).find('.pi-data-value').text().trim();
      if (source && value) {
        console.log(`data-source="${source}": ${value}`);
      }
    });
    
    // Look for alternative title sections in content
    console.log('\n=== CONTENT SECTIONS WITH TITLES ===');
    $('h2, h3').each((i, heading) => {
      const text = $(heading).text().trim();
      const lowerText = text.toLowerCase();
      if (lowerText.includes('title') || lowerText.includes('name') || 
          lowerText.includes('also known') || lowerText.includes('alternative')) {
        console.log(`Found heading: "${text}"`);
        const nextElem = $(heading).next();
        if (nextElem.length) {
          console.log(`  Next element text: ${nextElem.text().trim().substring(0, 100)}...`);
        }
      }
    });
    
    // Check specific Japanese/English title fields
    console.log('\n=== SPECIFIC TITLE FIELDS ===');
    const titleFields = ['kanji', 'romaji', 'english', 'japanese', 'romanized', 'literal'];
    titleFields.forEach(field => {
      // Check various selector patterns
      const selectors = [
        `.pi-item[data-source="${field}"] .pi-data-value`,
        `.pi-data-label:contains("${field}") + .pi-data-value`,
        `.pi-data-label:contains("${field.charAt(0).toUpperCase() + field.slice(1)}") + .pi-data-value`
      ];
      
      selectors.forEach(selector => {
        try {
          const value = $(selector).text().trim();
          if (value) {
            console.log(`Found ${field}: ${value}`);
          }
        } catch {
          // Selector might not be valid, ignore
        }
      });
    });
    
    // Check for any Japanese text in the infobox
    console.log('\n=== JAPANESE/KANJI TEXT ===');
    $('.pi-data-value').each((i, elem) => {
      const text = $(elem).text().trim();
      // Check if contains Japanese characters
      if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) {
        console.log(`Found Japanese text: ${text}`);
      }
    });
    
    // Look for publication information
    console.log('\n=== PUBLICATION INFO ===');
    const pubLabels = ['Author', 'Publisher', 'Magazine', 'Demographic', 'Published'];
    pubLabels.forEach(label => {
      $(`.pi-data-label:contains("${label}")`).each((i, elem) => {
        const value = $(elem).siblings('.pi-data-value').text().trim() || 
                     $(elem).next('.pi-data-value').text().trim();
        if (value) {
          console.log(`${label}: ${value}`);
        }
      });
    });
    
  } catch (error) {
    console.error('Error fetching page:', error.message);
  }
}

testFandomExtraction();