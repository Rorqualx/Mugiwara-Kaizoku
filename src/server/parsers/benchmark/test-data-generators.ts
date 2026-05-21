/**
 * Test Data Generators
 *
 * Generates HTML test data for benchmark testing.
 * Creates various HTML structures (simple, tables, images) for performance testing.
 *
 * Extracted from: PerformanceBenchmark.ts (lines 290-297, 390-454)
 */

/**
 * Generate simple HTML with portable infobox
 *
 * @returns HTML string with basic infobox structure
 */
export function generateSimpleHTML(): string {
  return `
    <html>
      <body>
        <div class="portable-infobox">
          <h2>Test Manga</h2>
          <div class="pi-item">
            <div class="pi-data-label">Author</div>
            <div class="pi-data-value">Test Author</div>
          </div>
        </div>
        <p>Test description</p>
      </body>
    </html>
  `;
}

/**
 * Generate HTML with large table (100 rows)
 *
 * @returns HTML string with table structure
 */
export function generateTableHTML(): string {
  const rows = Array.from({ length: 100 }, (_, i) =>
    `<tr><td>Chapter ${i + 1}</td><td>Title ${i + 1}</td></tr>`
  ).join('');

  return `
    <html>
      <body>
        <table class="wikitable">
          <thead>
            <tr><th>Chapter</th><th>Title</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;
}

/**
 * Generate HTML with multiple images (50 images)
 *
 * @returns HTML string with image gallery
 */
export function generateImageHTML(): string {
  const images = Array.from({ length: 50 }, (_, i) =>
    `<img src="image${i}.jpg" alt="Image ${i}" data-src="image${i}_full.jpg">`
  ).join('');

  return `
    <html>
      <body>
        <div class="gallery">${images}</div>
      </body>
    </html>
  `;
}

/**
 * Generate comprehensive HTML with all elements
 *
 * @returns HTML string combining all test structures
 */
export function generateFullHTML(): string {
  return `
    <html>
      <body>
        ${generateSimpleHTML()}
        ${generateTableHTML()}
        ${generateImageHTML()}
      </body>
    </html>
  `;
}

/**
 * Load all test data into a map
 *
 * @returns Map of test data by category
 */
export function loadTestData(): Map<string, string> {
  const testData = new Map<string, string>();
  testData.set('simple', generateSimpleHTML());
  testData.set('tables', generateTableHTML());
  testData.set('images', generateImageHTML());
  testData.set('full', generateFullHTML());
  return testData;
}
