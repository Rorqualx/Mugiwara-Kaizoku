import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

interface FailedManga {
  name: string;
  url: string;
  category: string;
}

interface PatternAnalysis {
  pattern: string;
  description: string;
  manga: string[];
  count: number;
  priority: 'high' | 'medium' | 'low';
}

async function analyzeFailedPatterns() {
  console.log('🔍 Analyzing Failed Manga Patterns\n');
  
  // Read the latest test results
  const results = JSON.parse(fs.readFileSync('fandom-only-parser-results.json', 'utf-8'));
  
  // Extract failed manga
  const failedManga: FailedManga[] = results.results
    .filter(r => !r.success && !r.error)
    .map(r => ({
      name: r.name,
      url: r.url,
      category: r.category
    }));
  
  console.log(`Found ${failedManga.length} failed manga to analyze\n`);
  
  const patterns: Map<string, PatternAnalysis> = new Map();
  
  // Analyze each failed manga
  for (const manga of failedManga) {
    console.log(`\n📖 Analyzing ${manga.name}...`);
    
    try {
      const response = await fetch(manga.url);
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Analyze page structure
      const analysis = await analyzePage($, manga);
      
      // Group by pattern
      for (const pattern of analysis.patterns) {
        if (!patterns.has(pattern.type)) {
          patterns.set(pattern.type, {
            pattern: pattern.type,
            description: pattern.description,
            manga: [],
            count: 0,
            priority: 'low'
          });
        }
        
        const p = patterns.get(pattern.type)!;
        p.manga.push(manga.name);
        p.count++;
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
  
  // Calculate priorities
  const patternArray = Array.from(patterns.values());
  patternArray.forEach(p => {
    if (p.count >= 5) p.priority = 'high';
    else if (p.count >= 3) p.priority = 'medium';
  });
  
  // Sort by count
  patternArray.sort((a, b) => b.count - a.count);
  
  // Generate report
  console.log('\n\n📊 PATTERN ANALYSIS REPORT');
  console.log('=' .repeat(60));
  
  console.log('\n🎯 High Priority Patterns (5+ manga):');
  patternArray.filter(p => p.priority === 'high').forEach(p => {
    console.log(`\n${p.pattern}:`);
    console.log(`  Description: ${p.description}`);
    console.log(`  Count: ${p.count} manga`);
    console.log(`  Examples: ${p.manga.slice(0, 3).join(', ')}${p.manga.length > 3 ? '...' : ''}`);
  });
  
  console.log('\n📌 Medium Priority Patterns (3-4 manga):');
  patternArray.filter(p => p.priority === 'medium').forEach(p => {
    console.log(`\n${p.pattern}:`);
    console.log(`  Count: ${p.count} manga`);
    console.log(`  Examples: ${p.manga.join(', ')}`);
  });
  
  console.log('\n📋 Low Priority Patterns (1-2 manga):');
  patternArray.filter(p => p.priority === 'low').forEach(p => {
    console.log(`${p.pattern}: ${p.manga.join(', ')}`);
  });
  
  // Save detailed analysis
  const detailedReport = {
    timestamp: new Date().toISOString(),
    totalFailed: failedManga.length,
    patterns: patternArray,
    recommendations: generateRecommendations(patternArray)
  };
  
  fs.writeFileSync('failed-pattern-analysis.json', JSON.stringify(detailedReport, null, 2));
  console.log('\n\n✅ Detailed analysis saved to failed-pattern-analysis.json');
}

async function analyzePage($: cheerio.CheerioAPI, manga: FailedManga) {
  const patterns: {type: string, description: string}[] = [];
  
  // Check for collapsible sections
  if ($('.mw-collapsible, .collapsible, .NavFrame').length > 0) {
    patterns.push({
      type: 'collapsible-sections',
      description: 'Uses collapsible/expandable sections for content'
    });
  }
  
  // Check for tabbed interface
  if ($('.tabber, .tabbertab, .wds-tabs, .tabs').length > 0) {
    patterns.push({
      type: 'tabbed-interface',
      description: 'Uses tabs to organize content'
    });
  }
  
  // Check for category pages
  if (manga.url.includes('Category:') || $('.category-page').length > 0) {
    patterns.push({
      type: 'category-page',
      description: 'Links from a category page rather than direct content'
    });
  }
  
  // Check for navbox-only pages
  const tables = $('table');
  const navboxes = tables.filter((_, t) => {
    const classes = $(t).attr('class') || '';
    return classes.includes('navbox') || classes.includes('navigation');
  });
  
  if (navboxes.length > 0 && navboxes.length === tables.length) {
    patterns.push({
      type: 'navbox-only',
      description: 'Only navigation boxes, no content tables'
    });
  }
  
  // Check for lists without tables
  const hasLists = $('ul li, ol li').filter((_, li) => {
    const text = $(li).text();
    return /Chapter \d+|Volume \d+/i.test(text);
  }).length > 10;
  
  if (hasLists && tables.length === 0) {
    patterns.push({
      type: 'list-based',
      description: 'Uses HTML lists instead of tables'
    });
  }
  
  // Check for single large table
  const largeTables = tables.filter((_, t) => $(t).find('tr').length > 50);
  if (largeTables.length === 1) {
    patterns.push({
      type: 'single-large-table',
      description: 'One large table with all volumes/chapters'
    });
  }
  
  // Check for accordion pattern
  if ($('.mw-collapsible-content, .accordion, .toggle').length > 0) {
    patterns.push({
      type: 'accordion-layout',
      description: 'Accordion-style expandable content'
    });
  }
  
  // Check for definition lists
  if ($('dl dt').filter((_, dt) => /Volume \d+/i.test($(dt).text())).length > 0) {
    patterns.push({
      type: 'definition-list',
      description: 'Uses definition lists (dl/dt/dd) for structure'
    });
  }
  
  // Check for guide/overview pages
  if (manga.url.includes('Guide') || manga.url.includes('Overview')) {
    patterns.push({
      type: 'guide-page',
      description: 'Guide or overview page, not direct chapter list'
    });
  }
  
  // Check for mixed content tables
  const mixedTables = tables.filter((_, t) => {
    const text = $(t).text();
    return text.includes('Volume') && text.includes('Episode') && text.includes('Chapter');
  });
  
  if (mixedTables.length > 0) {
    patterns.push({
      type: 'mixed-media-table',
      description: 'Tables mix manga, anime, and other media info'
    });
  }
  
  // If no patterns found, mark as unique
  if (patterns.length === 0) {
    patterns.push({
      type: 'unique-layout',
      description: 'Unique or unrecognized layout pattern'
    });
  }
  
  return { patterns };
}

function generateRecommendations(patterns: PatternAnalysis[]): string[] {
  const recommendations: string[] = [];
  
  const highPriority = patterns.filter(p => p.priority === 'high');
  
  if (highPriority.length > 0) {
    recommendations.push(`Implement ${highPriority[0].pattern} pattern first - affects ${highPriority[0].count} manga`);
  }
  
  const collapsible = patterns.find(p => p.pattern === 'collapsible-sections');
  if (collapsible && collapsible.count >= 3) {
    recommendations.push('Collapsible sections are common - add expand/collapse handling');
  }
  
  const tabbed = patterns.find(p => p.pattern === 'tabbed-interface');
  if (tabbed && tabbed.count >= 3) {
    recommendations.push('Tabbed interfaces need special handling - parse all tabs');
  }
  
  return recommendations;
}

analyzeFailedPatterns().catch(console.error);