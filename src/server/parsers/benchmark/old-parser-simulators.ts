/**
 * Old Parser Simulators
 *
 * Simulates performance characteristics of the old fragmented parser system.
 * These methods intentionally include delays and inefficiencies to represent
 * the baseline performance for benchmark comparisons.
 *
 * Extracted from: PerformanceBenchmark.ts (lines 315-386)
 */

/**
 * Simulate old parser performance with intentional inefficiencies
 *
 * @param html - HTML string to parse
 * @returns Promise that resolves when parsing is complete
 */
export async function simulateOldParser(html: string): Promise<void> {
  // Simulate old parser with intentional inefficiencies
  const $ = await import('cheerio').then((c) => c.load(html));
  // Multiple passes (inefficient)
  $('.portable-infobox').each(() => {});
  $('table').each(() => {});
  $('img').each(() => {});
  // String operations (inefficient)
  const text = $.html();
  text.replace(/\s+/g, ' ');
  text.split('\n');
  // Simulate delay
  await new Promise((resolve) => {
    setTimeout(resolve, Math.random() * 2);
  });
}

/**
 * Simulate old table parser performance
 *
 * @param html - HTML string containing tables
 * @returns Promise that resolves when parsing is complete
 */
export async function simulateOldTableParser(html: string): Promise<void> {
  const $ = await import('cheerio').then((c) => c.load(html));
  // Inefficient table parsing
  const tables: Array<{ headers: string[]; rows: Array<string[]> }> = [];
  $('table').each((_, table) => {
    const rows: Array<string[]> = [];
    $(table)
      .find('tr')
      .each((_, row) => {
        const cells: string[] = [];
        $(row)
          .find('td, th')
          .each((_, cell) => {
            cells.push($(cell).text());
          });
        rows.push(cells);
      });
    tables.push({ headers: [], rows });
  });
  await new Promise((resolve) => {
    setTimeout(resolve, 1);
  });
}

/**
 * Simulate old image parser performance
 *
 * @param html - HTML string containing images
 * @returns Promise that resolves when parsing is complete
 */
export async function simulateOldImageParser(html: string): Promise<void> {
  const $ = await import('cheerio').then((c) => c.load(html));
  // Inefficient image extraction
  const images: string[] = [];
  $('img').each((_, img) => {
    const src = $(img).attr('src');
    const dataSrc = $(img).attr('data-src');
    const _alt = $(img).attr('alt');
    if (src) images.push(src);
    if (dataSrc) images.push(dataSrc);
  });
  // Process each image (inefficient)
  for (const img of images) {
    img.replace(/\?.*$/, '');
  }
  await new Promise((resolve) => {
    setTimeout(resolve, 1);
  });
}

/**
 * Simulate old full parser performance (combines all operations)
 *
 * @param html - HTML string to parse
 * @returns Promise that resolves when all parsing is complete
 */
export async function simulateOldFullParser(html: string): Promise<void> {
  await simulateOldParser(html);
  await simulateOldTableParser(html);
  await simulateOldImageParser(html);
  // Additional processing
  await new Promise((resolve) => {
    setTimeout(resolve, 2);
  });
}
