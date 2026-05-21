/**
 * Comprehensive Fandom Workflow Test
 * Tests ALL components of the Fandom implementation for Fire Force
 */

import chalk from 'chalk';
import * as cheerio from 'cheerio';

// Import all Fandom components
import { FandomService } from '../src/server/services/fandom/FandomService';
import { FandomProvider } from '../src/server/services/search/providers/FandomProvider';
import { DynamicWikiParser } from '../src/server/services/fandom/dynamic/DynamicWikiParser';
import { WikiContentScraper } from '../src/server/services/fandom/dynamic/WikiContentScraper';
import { FandomAdapter } from '../src/server/parsers/adapters/FandomAdapter';
import {
  parsePageAdaptive,
  detectWikiStructure,
  parseInfoboxData,
} from '../src/server/services/metadata/utils/fandomTableParser';
import { logger } from '../src/utils/logger';

// Test URLs
const FIRE_FORCE_URLS = {
  mainPage: 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)',
  volumesList: 'https://fire-force.fandom.com/wiki/List_of_Volumes',
  chapter0: 'https://fire-force.fandom.com/wiki/Chapter_0',
};

const WIKI_SUBDOMAIN = 'fire-force';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'partial';
  data: unknown;
  errors: string[];
  duration: number;
}

const results: TestResult[] = [];

function logSection(title: string): void {
  console.log('\n' + chalk.blue('═'.repeat(60)));
  console.log(chalk.blue.bold(`  ${title}`));
  console.log(chalk.blue('═'.repeat(60)) + '\n');
}

function logTest(name: string, status: 'pass' | 'fail' | 'partial', details?: string): void {
  const icon = status === 'pass' ? '✅' : status === 'partial' ? '⚠️' : '❌';
  const color = status === 'pass' ? chalk.green : status === 'partial' ? chalk.yellow : chalk.red;
  console.log(`${icon} ${color(name)}${details ? ` - ${details}` : ''}`);
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });
  return response.text();
}

// ============================================================
// TEST 1: FandomProvider Search
// ============================================================
async function testFandomProviderSearch(): Promise<TestResult> {
  const start = Date.now();
  const errors: string[] = [];
  let data: unknown = null;

  try {
    logSection('TEST 1: FandomProvider Search');

    const provider = new FandomProvider({
      name: 'Fandom',
      identifier: 'fandom',
    });

    console.log('Searching for "Fire Force"...');
    const searchResults = await provider.search('Fire Force', {
      type: 'MANGA',
      limit: 5,
    });

    data = searchResults;
    console.log(`Found ${searchResults.length} results`);

    if (searchResults.length === 0) {
      errors.push('No search results returned');
      logTest('FandomProvider.search()', 'fail', 'No results');
    } else {
      searchResults.forEach((result, i) => {
        console.log(chalk.cyan(`\n  Result ${i + 1}:`));
        console.log(`    Title: ${result.title}`);
        console.log(`    URL: ${result.url ?? result.wikiUrl ?? 'N/A'}`);
        console.log(`    Status: ${result.status ?? 'N/A'}`);
        console.log(`    Volumes: ${result.volumes ?? 'N/A'}`);
        console.log(`    Chapters: ${result.chapters ?? 'N/A'}`);
        if (result.metadata) {
          console.log(`    Metadata keys: ${Object.keys(result.metadata).join(', ')}`);
        }
      });
      logTest('FandomProvider.search()', 'pass', `${searchResults.length} results`);
    }
  } catch (error) {
    errors.push(String(error));
    logTest('FandomProvider.search()', 'fail', String(error));
  }

  return {
    name: 'FandomProvider Search',
    status: errors.length === 0 ? 'pass' : 'fail',
    data,
    errors,
    duration: Date.now() - start,
  };
}

// ============================================================
// TEST 2: FandomService APIs
// ============================================================
async function testFandomServiceAPIs(): Promise<TestResult> {
  const start = Date.now();
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  try {
    logSection('TEST 2: FandomService API Methods');

    const service = new FandomService(WIKI_SUBDOMAIN);

    // Test search
    console.log('Testing FandomService.search()...');
    try {
      const searchResult = await service.search('Fire Force');
      data.search = searchResult;
      console.log(`  Search returned ${searchResult.length} items`);
      if (searchResult.length > 0) {
        console.log(`  First: ${searchResult[0].title}`);
        logTest('FandomService.search()', 'pass');
      } else {
        errors.push('Search returned no results');
        logTest('FandomService.search()', 'fail', 'No results');
      }
    } catch (e) {
      errors.push(`search: ${e}`);
      logTest('FandomService.search()', 'fail', String(e));
    }

    // Test getMangaInfo
    console.log('\nTesting FandomService.getMangaInfo()...');
    try {
      const mangaInfo = await service.getMangaInfo('Fire_Force_(manga)');
      data.mangaInfo = mangaInfo;
      if (mangaInfo) {
        console.log(`  Title: ${mangaInfo.title}`);
        console.log(`  Author: ${mangaInfo.author ?? mangaInfo.metadata?.author ?? 'N/A'}`);
        console.log(`  Volumes: ${mangaInfo.volumes ?? 'N/A'}`);
        console.log(`  Chapters: ${mangaInfo.chapters ?? 'N/A'}`);
        console.log(`  Volume List: ${mangaInfo.volumeList?.length ?? 0} volumes`);
        console.log(`  Chapter List: ${mangaInfo.chapterList?.length ?? 0} chapters`);
        console.log(`  Source: ${mangaInfo.source ?? 'N/A'}`);
        logTest('FandomService.getMangaInfo()', mangaInfo.volumeList?.length ? 'pass' : 'partial');
      } else {
        errors.push('getMangaInfo returned null');
        logTest('FandomService.getMangaInfo()', 'fail', 'Null result');
      }
    } catch (e) {
      errors.push(`getMangaInfo: ${e}`);
      logTest('FandomService.getMangaInfo()', 'fail', String(e));
    }

    // Test getPageMetadata
    console.log('\nTesting FandomService.getPageMetadata()...');
    try {
      const pageMetadata = await service.getPageMetadata('Fire_Force_(manga)');
      data.pageMetadata = pageMetadata;
      if (pageMetadata) {
        console.log(`  Keys: ${Object.keys(pageMetadata).join(', ')}`);
        logTest('FandomService.getPageMetadata()', 'pass');
      } else {
        errors.push('getPageMetadata returned null');
        logTest('FandomService.getPageMetadata()', 'fail', 'Null result');
      }
    } catch (e) {
      errors.push(`getPageMetadata: ${e}`);
      logTest('FandomService.getPageMetadata()', 'fail', String(e));
    }

    // Test bulkFetchVolumeChapterData
    console.log('\nTesting FandomService.bulkFetchVolumeChapterData()...');
    try {
      const volumeChapterData = await service.bulkFetchVolumeChapterData(
        FIRE_FORCE_URLS.volumesList,
        { maxVolumes: 5 }
      );
      data.volumeChapterData = volumeChapterData;
      if (volumeChapterData) {
        console.log(`  Volumes: ${volumeChapterData.volumes?.length ?? 0}`);
        console.log(`  Chapters: ${volumeChapterData.chapters?.length ?? 0}`);
        if (volumeChapterData.volumes?.length) {
          console.log(`  First volume: ${JSON.stringify(volumeChapterData.volumes[0], null, 2).substring(0, 200)}`);
        }
        logTest('FandomService.bulkFetchVolumeChapterData()',
          volumeChapterData.volumes?.length ? 'pass' : 'partial');
      } else {
        errors.push('bulkFetchVolumeChapterData returned null');
        logTest('FandomService.bulkFetchVolumeChapterData()', 'fail', 'Null result');
      }
    } catch (e) {
      errors.push(`bulkFetchVolumeChapterData: ${e}`);
      logTest('FandomService.bulkFetchVolumeChapterData()', 'fail', String(e));
    }

  } catch (error) {
    errors.push(String(error));
  }

  return {
    name: 'FandomService APIs',
    status: errors.length === 0 ? 'pass' : errors.length < 3 ? 'partial' : 'fail',
    data,
    errors,
    duration: Date.now() - start,
  };
}

// ============================================================
// TEST 3: Static Table Parser
// ============================================================
async function testStaticTableParser(): Promise<TestResult> {
  const start = Date.now();
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  try {
    logSection('TEST 3: Static Table Parser (fandomTableParser)');

    // Fetch volumes list page
    console.log('Fetching volumes list page...');
    const html = await fetchHtml(FIRE_FORCE_URLS.volumesList);
    data.htmlLength = html.length;
    console.log(`  HTML length: ${html.length} chars`);

    // Test structure detection
    console.log('\nTesting detectWikiStructure()...');
    const structure = detectWikiStructure(html);
    data.structure = structure;
    console.log(`  Detected structure: ${structure}`);
    logTest('detectWikiStructure()', structure !== 'unknown' ? 'pass' : 'partial', structure);

    // Test infobox parsing on main page
    console.log('\nTesting parseInfobox() on main page...');
    const mainHtml = await fetchHtml(FIRE_FORCE_URLS.mainPage);
    const $ = cheerio.load(mainHtml);
    const infoboxData = parseInfoboxData($);
    data.infobox = infoboxData;
    console.log(`  Infobox keys: ${Object.keys(infoboxData).join(', ') || 'NONE'}`);
    if (Object.keys(infoboxData).length > 0) {
      Object.entries(infoboxData).slice(0, 5).forEach(([key, value]) => {
        console.log(`    ${key}: ${String(value).substring(0, 50)}`);
      });
      logTest('parseInfobox()', 'pass', `${Object.keys(infoboxData).length} fields`);
    } else {
      errors.push('parseInfobox returned empty object');
      logTest('parseInfobox()', 'fail', 'No data extracted');
    }

    // Test adaptive parsing
    console.log('\nTesting parsePageAdaptive() on volumes list...');
    const adaptiveResult = parsePageAdaptive(html);
    data.adaptive = adaptiveResult;
    console.log(`  Volumes found: ${adaptiveResult.volumes?.length ?? 0}`);
    console.log(`  Chapters found: ${adaptiveResult.chapters?.length ?? 0}`);
    if (adaptiveResult.volumes?.length) {
      console.log(`  First volume: ${JSON.stringify(adaptiveResult.volumes[0], null, 2).substring(0, 200)}`);
      logTest('parsePageAdaptive()', 'pass', `${adaptiveResult.volumes.length} volumes`);
    } else {
      errors.push('parsePageAdaptive found no volumes');
      logTest('parsePageAdaptive()', 'fail', 'No volumes');
    }

  } catch (error) {
    errors.push(String(error));
    logTest('Static Table Parser', 'fail', String(error));
  }

  return {
    name: 'Static Table Parser',
    status: errors.length === 0 ? 'pass' : errors.length < 2 ? 'partial' : 'fail',
    data,
    errors,
    duration: Date.now() - start,
  };
}

// ============================================================
// TEST 4: DynamicWikiParser
// ============================================================
async function testDynamicWikiParser(): Promise<TestResult> {
  const start = Date.now();
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  try {
    logSection('TEST 4: DynamicWikiParser');

    const parser = new DynamicWikiParser(WIKI_SUBDOMAIN);

    // Fetch HTML
    console.log('Fetching volumes list page for dynamic parsing...');
    const html = await fetchHtml(FIRE_FORCE_URLS.volumesList);

    // Test structure analysis
    console.log('\nTesting structure analysis...');
    const $ = cheerio.load(html);

    // Check what elements exist
    const elementCounts = {
      tables: $('table').length,
      galleries: $('.wikia-gallery, .gallery').length,
      tabs: $('.tabber, .wds-tabber, .tabbertab').length,
      collapsibles: $('.mw-collapsible').length,
      infoboxes: $('.infobox, .portable-infobox').length,
      volumeLinks: $('a[href*="/wiki/Volume_"]').length,
      chapterLinks: $('a[href*="/wiki/Chapter_"]').length,
      piData: $('.pi-data').length,
      piItem: $('.pi-item').length,
    };
    data.elementCounts = elementCounts;
    console.log('  Element counts:', elementCounts);

    // Test parse method
    console.log('\nTesting DynamicWikiParser.parse()...');
    try {
      const parseResult = await parser.parse(html);
      data.parseResult = parseResult;
      console.log(`  Parse result keys: ${Object.keys(parseResult).join(', ')}`);
      console.log(`  Volumes: ${parseResult.volumes?.length ?? 0}`);
      console.log(`  Chapters: ${parseResult.chapters?.length ?? 0}`);
      if (parseResult.volumes?.length) {
        logTest('DynamicWikiParser.parse()', 'pass', `${parseResult.volumes.length} volumes`);
      } else {
        errors.push('DynamicWikiParser found no volumes');
        logTest('DynamicWikiParser.parse()', 'partial', 'No volumes');
      }
    } catch (e) {
      errors.push(`parse: ${e}`);
      logTest('DynamicWikiParser.parse()', 'fail', String(e));
    }

  } catch (error) {
    errors.push(String(error));
    logTest('DynamicWikiParser', 'fail', String(error));
  }

  return {
    name: 'DynamicWikiParser',
    status: errors.length === 0 ? 'pass' : 'partial',
    data,
    errors,
    duration: Date.now() - start,
  };
}

// ============================================================
// TEST 5: WikiContentScraper
// ============================================================
async function testWikiContentScraper(): Promise<TestResult> {
  const start = Date.now();
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  try {
    logSection('TEST 5: WikiContentScraper');

    const scraper = new WikiContentScraper(WIKI_SUBDOMAIN);

    // Test scrapeWikiContent
    console.log('Testing WikiContentScraper.scrapeWikiContent()...');
    try {
      const scrapeResult = await scraper.scrapeWikiContent(FIRE_FORCE_URLS.volumesList, {
        maxVolumes: 5,
        maxChapters: 20,
        includeGallery: true,
      });
      data.scrapeResult = scrapeResult;
      console.log(`  Volumes: ${scrapeResult.volumes?.length ?? 0}`);
      console.log(`  Chapters: ${scrapeResult.chapters?.length ?? 0}`);
      console.log(`  Gallery images: ${scrapeResult.gallery?.length ?? 0}`);
      if (scrapeResult.volumes?.length) {
        console.log(`  First volume: ${JSON.stringify(scrapeResult.volumes[0], null, 2).substring(0, 300)}`);
        logTest('WikiContentScraper.scrapeWikiContent()', 'pass');
      } else {
        errors.push('WikiContentScraper found no volumes');
        logTest('WikiContentScraper.scrapeWikiContent()', 'partial', 'No volumes');
      }
    } catch (e) {
      errors.push(`scrapeWikiContent: ${e}`);
      logTest('WikiContentScraper.scrapeWikiContent()', 'fail', String(e));
    }

  } catch (error) {
    errors.push(String(error));
    logTest('WikiContentScraper', 'fail', String(error));
  }

  return {
    name: 'WikiContentScraper',
    status: errors.length === 0 ? 'pass' : 'partial',
    data,
    errors,
    duration: Date.now() - start,
  };
}

// ============================================================
// TEST 6: FandomAdapter
// ============================================================
async function testFandomAdapter(): Promise<TestResult> {
  const start = Date.now();
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  try {
    logSection('TEST 6: FandomAdapter');

    const adapter = new FandomAdapter();

    // Test extract
    console.log('Testing FandomAdapter.extract()...');
    try {
      const extractResult = await adapter.extract(FIRE_FORCE_URLS.mainPage);
      data.extractResult = extractResult;
      if (extractResult) {
        console.log(`  Title: ${extractResult.title}`);
        console.log(`  Description: ${extractResult.description?.substring(0, 100) ?? 'N/A'}...`);
        console.log(`  Author: ${extractResult.author ?? 'N/A'}`);
        console.log(`  Volumes: ${extractResult.volumes ?? 'N/A'}`);
        console.log(`  Chapters: ${extractResult.chapters ?? 'N/A'}`);
        console.log(`  Volume data count: ${extractResult.volumeData?.length ?? 0}`);
        console.log(`  Chapter data count: ${extractResult.chapterData?.length ?? 0}`);
        logTest('FandomAdapter.extract()', extractResult.title ? 'pass' : 'partial');
      } else {
        errors.push('FandomAdapter.extract returned null');
        logTest('FandomAdapter.extract()', 'fail', 'Null result');
      }
    } catch (e) {
      errors.push(`extract: ${e}`);
      logTest('FandomAdapter.extract()', 'fail', String(e));
    }

  } catch (error) {
    errors.push(String(error));
    logTest('FandomAdapter', 'fail', String(error));
  }

  return {
    name: 'FandomAdapter',
    status: errors.length === 0 ? 'pass' : 'partial',
    data,
    errors,
    duration: Date.now() - start,
  };
}

// ============================================================
// TEST 7: Raw HTML Inspection
// ============================================================
async function testRawHtmlInspection(): Promise<TestResult> {
  const start = Date.now();
  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  try {
    logSection('TEST 7: Raw HTML Inspection');

    // Fetch main page
    console.log('Fetching main page for inspection...');
    const mainHtml = await fetchHtml(FIRE_FORCE_URLS.mainPage);
    const $main = cheerio.load(mainHtml);

    // Check for infobox variations
    console.log('\nChecking infobox selectors...');
    const infoboxSelectors = [
      '.portable-infobox',
      '.infobox',
      '.pi-data',
      '.pi-item',
      '.pi-data-label',
      '.pi-data-value',
      'aside.portable-infobox',
      'table.infobox',
      '[data-source]',
      '.pi-image',
    ];

    infoboxSelectors.forEach(selector => {
      const count = $main(selector).length;
      console.log(`  ${selector}: ${count} elements`);
      if (count > 0) {
        data[`selector_${selector}`] = count;
      }
    });

    // Try to find the actual infobox content
    console.log('\nLooking for actual infobox content...');

    // Try portable infobox
    const portableInfobox = $main('aside.portable-infobox');
    if (portableInfobox.length > 0) {
      console.log('  Found portable-infobox!');
      const piItems = portableInfobox.find('.pi-item.pi-data');
      console.log(`  PI items: ${piItems.length}`);
      piItems.each((i, el) => {
        const label = $main(el).find('.pi-data-label').text().trim();
        const value = $main(el).find('.pi-data-value').text().trim();
        console.log(`    ${label}: ${value.substring(0, 50)}`);
      });
      data.portableInfoboxItems = piItems.length;
    } else {
      console.log('  No portable-infobox found');

      // Try any aside element
      const asides = $main('aside');
      console.log(`  Aside elements: ${asides.length}`);
      asides.each((i, el) => {
        const classes = $main(el).attr('class') ?? 'no-class';
        console.log(`    Aside ${i}: ${classes}`);
      });
    }

    // Check for data attributes that might contain metadata
    console.log('\nChecking for data attributes...');
    const dataSourceElements = $main('[data-source]');
    console.log(`  Elements with data-source: ${dataSourceElements.length}`);
    dataSourceElements.slice(0, 10).each((i, el) => {
      const source = $main(el).attr('data-source');
      const text = $main(el).text().trim().substring(0, 50);
      console.log(`    ${source}: ${text}`);
    });

    // Check volumes page structure
    console.log('\nFetching volumes list page for inspection...');
    const volumesHtml = await fetchHtml(FIRE_FORCE_URLS.volumesList);
    const $vol = cheerio.load(volumesHtml);

    console.log('\nChecking volume page selectors...');
    const volumeSelectors = [
      'table.wikitable',
      'table.article-table',
      'table',
      '.mw-collapsible',
      '.mw-collapsible-content',
      '.wikia-gallery',
      '.gallery',
      '.gallerybox',
      'a[href*="/wiki/Volume_"]',
      'a[href*="/wiki/Chapter_"]',
    ];

    volumeSelectors.forEach(selector => {
      const count = $vol(selector).length;
      console.log(`  ${selector}: ${count} elements`);
    });

    // Look at actual table structure
    console.log('\nInspecting first table...');
    const firstTable = $vol('table').first();
    if (firstTable.length) {
      const headers = firstTable.find('th').map((_, el) => $vol(el).text().trim()).get();
      console.log(`  Headers: ${headers.join(', ')}`);
      const firstRow = firstTable.find('tr').eq(1);
      const cells = firstRow.find('td').map((_, el) => $vol(el).text().trim().substring(0, 30)).get();
      console.log(`  First row cells: ${cells.join(' | ')}`);
    }

    logTest('Raw HTML Inspection', 'pass', 'Inspection complete');

  } catch (error) {
    errors.push(String(error));
    logTest('Raw HTML Inspection', 'fail', String(error));
  }

  return {
    name: 'Raw HTML Inspection',
    status: errors.length === 0 ? 'pass' : 'fail',
    data,
    errors,
    duration: Date.now() - start,
  };
}

// ============================================================
// MAIN
// ============================================================
async function main(): Promise<void> {
  console.log(chalk.magenta.bold('\n' + '='.repeat(60)));
  console.log(chalk.magenta.bold('  COMPREHENSIVE FANDOM WORKFLOW TEST - FIRE FORCE'));
  console.log(chalk.magenta.bold('='.repeat(60)));
  console.log(`\nTarget Wiki: ${WIKI_SUBDOMAIN}.fandom.com`);
  console.log(`Test URLs:`);
  Object.entries(FIRE_FORCE_URLS).forEach(([name, url]) => {
    console.log(`  ${name}: ${url}`);
  });

  // Run all tests
  results.push(await testFandomProviderSearch());
  results.push(await testFandomServiceAPIs());
  results.push(await testStaticTableParser());
  results.push(await testDynamicWikiParser());
  results.push(await testWikiContentScraper());
  results.push(await testFandomAdapter());
  results.push(await testRawHtmlInspection());

  // Summary
  logSection('TEST SUMMARY');

  let passed = 0;
  let partial = 0;
  let failed = 0;

  results.forEach(result => {
    const icon = result.status === 'pass' ? '✅' : result.status === 'partial' ? '⚠️' : '❌';
    const color = result.status === 'pass' ? chalk.green : result.status === 'partial' ? chalk.yellow : chalk.red;
    console.log(`${icon} ${color(result.name)} (${result.duration}ms)`);
    if (result.errors.length > 0) {
      result.errors.forEach(err => console.log(chalk.red(`     └─ ${err}`)));
    }

    if (result.status === 'pass') passed++;
    else if (result.status === 'partial') partial++;
    else failed++;
  });

  console.log('\n' + chalk.blue('─'.repeat(60)));
  console.log(`Total: ${results.length} tests`);
  console.log(chalk.green(`  Passed: ${passed}`));
  console.log(chalk.yellow(`  Partial: ${partial}`));
  console.log(chalk.red(`  Failed: ${failed}`));
  console.log(chalk.blue('─'.repeat(60)) + '\n');
}

main().catch(console.error);
