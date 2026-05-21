/**
 * Quick Prowlarr Search Test - Focus on Fire Force only
 *
 * Fast test to compare search strategies side-by-side
 */

import { ProwlarrMangaSearch } from '../src/server/services/prowlarr/mangaSearch';
import { logger } from '../src/utils/logger';
import { isSuccess } from '../src/utils/async-result';

const QUERY = 'Fire Force';

async function compareSearchStrategies() {
  console.log('\n' + '='.repeat(100));
  console.log('QUICK SEARCH COMPARISON: Fire Force');
  console.log('='.repeat(100) + '\n');

  const prowlarrSearch = new ProwlarrMangaSearch();

  // Strategy 1: Current Implementation (Category 7000)
  console.log('📊 Strategy 1: Current (Category 7000 - Books)');
  const strategy1 = await prowlarrSearch.searchManga(QUERY, {
    categories: [7000],
    limit: 100,
    maxage: 365,
    minsize: 10485760
  });

  if (isSuccess(strategy1)) {
    const results1 = strategy1.data;
    console.log(`  ✓ Results: ${results1.length}`);
    console.log(`  ✓ Protocols: ${results1.filter(r => r.protocol === 'torrent').length} torrents, ${results1.filter(r => r.protocol === 'usenet').length} usenet`);
    const avgSeeders = results1.filter(r => r.seeders).reduce((sum, r) => sum + (r.seeders || 0), 0) / results1.filter(r => r.seeders).length;
    console.log(`  ✓ Avg Seeders: ${avgSeeders.toFixed(1)}`);
    console.log(`  ✓ Top 3 Results:`);
    results1.slice(0, 3).forEach((r, i) => {
      console.log(`     ${i + 1}. [${r.protocol?.toUpperCase() || 'UNKNOWN'}] ${r.title.substring(0, 80)}`);
      console.log(`        Size: ${(r.size / (1024 * 1024)).toFixed(1)}MB, Seeders: ${r.seeders || 'N/A'}, Indexer: ${r.indexerName}`);
    });
  }

  console.log('\n📊 Strategy 2: Specific Category (7030 - Comics/Manga)');
  const strategy2 = await prowlarrSearch.searchManga(QUERY, {
    categories: [7030],
    limit: 100,
    maxage: 365,
    minsize: 10485760
  });

  if (isSuccess(strategy2)) {
    const results2 = strategy2.data;
    console.log(`  ✓ Results: ${results2.length}`);
    console.log(`  ✓ Protocols: ${results2.filter(r => r.protocol === 'torrent').length} torrents, ${results2.filter(r => r.protocol === 'usenet').length} usenet`);
    const avgSeeders = results2.filter(r => r.seeders).reduce((sum, r) => sum + (r.seeders || 0), 0) / results2.filter(r => r.seeders).length;
    console.log(`  ✓ Avg Seeders: ${avgSeeders.toFixed(1)}`);
    console.log(`  ✓ Top 3 Results:`);
    results2.slice(0, 3).forEach((r, i) => {
      console.log(`     ${i + 1}. [${r.protocol?.toUpperCase() || 'UNKNOWN'}] ${r.title.substring(0, 80)}`);
      console.log(`        Size: ${(r.size / (1024 * 1024)).toFixed(1)}MB, Seeders: ${r.seeders || 'N/A'}, Indexer: ${r.indexerName}`);
    });
  }

  console.log('\n📊 Strategy 3: Multiple Categories (7030 + 7020)');
  const strategy3 = await prowlarrSearch.searchManga(QUERY, {
    categories: [7030, 7020],
    limit: 100,
    maxage: 365,
    minsize: 10485760
  });

  if (isSuccess(strategy3)) {
    const results3 = strategy3.data;
    console.log(`  ✓ Results: ${results3.length}`);
    console.log(`  ✓ Protocols: ${results3.filter(r => r.protocol === 'torrent').length} torrents, ${results3.filter(r => r.protocol === 'usenet').length} usenet`);
    const avgSeeders = results3.filter(r => r.seeders).reduce((sum, r) => sum + (r.seeders || 0), 0) / results3.filter(r => r.seeders).length;
    console.log(`  ✓ Avg Seeders: ${avgSeeders.toFixed(1)}`);
    console.log(`  ✓ Top 3 Results:`);
    results3.slice(0, 3).forEach((r, i) => {
      console.log(`     ${i + 1}. [${r.protocol?.toUpperCase() || 'UNKNOWN'}] ${r.title.substring(0, 80)}`);
      console.log(`        Size: ${(r.size / (1024 * 1024)).toFixed(1)}MB, Seeders: ${r.seeders || 'N/A'}, Indexer: ${r.indexerName}`);
    });
  }

  console.log('\n📊 Strategy 4: No Age Filter (All Time)');
  const strategy4 = await prowlarrSearch.searchManga(QUERY, {
    categories: [7000],
    limit: 100,
    // No maxage
    minsize: 10485760
  });

  if (isSuccess(strategy4)) {
    const results4 = strategy4.data;
    console.log(`  ✓ Results: ${results4.length}`);
    console.log(`  ✓ Protocols: ${results4.filter(r => r.protocol === 'torrent').length} torrents, ${results4.filter(r => r.protocol === 'usenet').length} usenet`);
    const avgSeeders = results4.filter(r => r.seeders).reduce((sum, r) => sum + (r.seeders || 0), 0) / results4.filter(r => r.seeders).length;
    console.log(`  ✓ Avg Seeders: ${avgSeeders.toFixed(1)}`);
    console.log(`  ✓ Top 3 Results:`);
    results4.slice(0, 3).forEach((r, i) => {
      console.log(`     ${i + 1}. [${r.protocol?.toUpperCase() || 'UNKNOWN'}] ${r.title.substring(0, 80)}`);
      console.log(`        Size: ${(r.size / (1024 * 1024)).toFixed(1)}MB, Seeders: ${r.seeders || 'N/A'}, Indexer: ${r.indexerName}`);
    });
  }

  console.log('\n📊 Strategy 5: High Quality (50MB minimum)');
  const strategy5 = await prowlarrSearch.searchManga(QUERY, {
    categories: [7000],
    limit: 100,
    maxage: 365,
    minsize: 52428800  // 50MB
  });

  if (isSuccess(strategy5)) {
    const results5 = strategy5.data;
    console.log(`  ✓ Results: ${results5.length}`);
    console.log(`  ✓ Protocols: ${results5.filter(r => r.protocol === 'torrent').length} torrents, ${results5.filter(r => r.protocol === 'usenet').length} usenet`);
    const avgSeeders = results5.filter(r => r.seeders).reduce((sum, r) => sum + (r.seeders || 0), 0) / results5.filter(r => r.seeders).length;
    console.log(`  ✓ Avg Seeders: ${avgSeeders.toFixed(1)}`);
    console.log(`  ✓ Top 3 Results:`);
    results5.slice(0, 3).forEach((r, i) => {
      console.log(`     ${i + 1}. [${r.protocol?.toUpperCase() || 'UNKNOWN'}] ${r.title.substring(0, 80)}`);
      console.log(`        Size: ${(r.size / (1024 * 1024)).toFixed(1)}MB, Seeders: ${r.seeders || 'N/A'}, Indexer: ${r.indexerName}`);
    });
  }

  console.log('\n' + '='.repeat(100));
  console.log('SUMMARY');
  console.log('='.repeat(100));

  if (isSuccess(strategy1) && isSuccess(strategy2) && isSuccess(strategy3) && isSuccess(strategy4) && isSuccess(strategy5)) {
    console.log('\nResult Counts:');
    console.log(`  Strategy 1 (Cat 7000):          ${strategy1.data.length} results`);
    console.log(`  Strategy 2 (Cat 7030):          ${strategy2.data.length} results`);
    console.log(`  Strategy 3 (Cat 7030+7020):     ${strategy3.data.length} results`);
    console.log(`  Strategy 4 (No Age Filter):     ${strategy4.data.length} results`);
    console.log(`  Strategy 5 (50MB Min):          ${strategy5.data.length} results`);

    // Determine winner
    const counts = [
      { name: 'Strategy 1 (Cat 7000)', count: strategy1.data.length },
      { name: 'Strategy 2 (Cat 7030)', count: strategy2.data.length },
      { name: 'Strategy 3 (Cat 7030+7020)', count: strategy3.data.length },
      { name: 'Strategy 4 (No Age Filter)', count: strategy4.data.length },
      { name: 'Strategy 5 (50MB Min)', count: strategy5.data.length }
    ];

    const mostResults = counts.reduce((max, curr) => curr.count > max.count ? curr : max);
    console.log(`\n🏆 Most Results: ${mostResults.name} with ${mostResults.count} results`);

    // Check for complete packs
    const completeCounts = [
      { name: 'Strategy 1', count: strategy1.data.filter(r => /complete|full|all/i.test(r.title)).length },
      { name: 'Strategy 2', count: strategy2.data.filter(r => /complete|full|all/i.test(r.title)).length },
      { name: 'Strategy 3', count: strategy3.data.filter(r => /complete|full|all/i.test(r.title)).length },
      { name: 'Strategy 4', count: strategy4.data.filter(r => /complete|full|all/i.test(r.title)).length },
      { name: 'Strategy 5', count: strategy5.data.filter(r => /complete|full|all/i.test(r.title)).length }
    ];

    const mostComplete = completeCounts.reduce((max, curr) => curr.count > max.count ? curr : max);
    console.log(`🎯 Most Complete Packs: ${mostComplete.name} with ${mostComplete.count} complete packs`);
  }

  console.log('\n✅ Test complete!\n');
  process.exit(0);
}

compareSearchStrategies().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
