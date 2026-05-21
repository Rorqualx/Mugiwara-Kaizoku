/**
 * Test HTML Content for Annotation E2E Tests
 *
 * These HTML content strings are used to create test annotation pages via API.
 * Each content variant tests a specific feature of the annotation system.
 */

/**
 * HTML content for testing dynamic context sizing with repetitive chapter titles.
 * "Chapter 1" appears multiple times, requiring context expansion to disambiguate.
 */
export const CHAPTERS_HTML = `<!DOCTYPE html>
<html>
<head><title>Chapter Test Page</title></head>
<body>
  <article>
    <h2>Chapter 1: The Beginning</h2>
    <p>This is the first chapter of our story.</p>

    <h2>Chapter 10: The Middle</h2>
    <p>We are now in the middle of the story.</p>

    <h2>Chapter 11: Almost There</h2>
    <p>Getting closer to the end.</p>

    <h2>Chapter 100: The End</h2>
    <p>This is where everything concludes.</p>

    <h2>Chapter 1 Revisited</h2>
    <p>A flashback to Chapter 1 events.</p>
  </article>
</body>
</html>`;

/**
 * HTML content for testing abbreviation handling in word boundaries.
 * Contains Vol., Dr., Ch., Mr., Mrs., and other common abbreviations.
 */
export const ABBREVIATIONS_HTML = `<!DOCTYPE html>
<html>
<head><title>Abbreviation Test Page</title></head>
<body>
  <article>
    <p>Read Vol. 1 first. Dr. Stone is by Dr. Inagaki.</p>
    <p>See Ch. 5 for details. Mr. Smith met Mrs. Jones at St. Mary's.</p>
    <p>Published by Inc. Ltd. Corp. in association with Prof. Brown.</p>
    <p>Gen. Washington and Col. Smith led the troops. Lt. Jones followed.</p>
    <p>No. 42 is the answer. Pt. 2 continues the story.</p>
  </article>
</body>
</html>`;

/**
 * HTML content for testing ellipsis handling in sentence boundaries.
 * Contains various ellipsis patterns that should not break sentences.
 */
export const ELLIPSIS_HTML = `<!DOCTYPE html>
<html>
<head><title>Ellipsis Test Page</title></head>
<body>
  <article>
    <p>Wait... What happened?</p>
    <p>I thought... maybe... we could try.</p>
    <p>He said "Well..." and then paused.</p>
    <p>The ending was... unexpected!</p>
    <p>So... what do you think? I wonder...</p>
  </article>
</body>
</html>`;

/**
 * HTML content for testing CJK (Chinese, Japanese, Korean) text boundaries.
 * Tests word segmentation in non-Latin scripts.
 */
export const CJK_HTML = `<!DOCTYPE html>
<html>
<head><title>CJK Test Page</title></head>
<body>
  <article>
    <h2>Japanese</h2>
    <p>One Piece (ワンピース) is a popular manga.</p>
    <p>ナルトも面白いですね。</p>

    <h2>Chinese</h2>
    <p>海贼王是一部很好的漫画。</p>
    <p>这是中文测试文本。</p>

    <h2>Korean</h2>
    <p>원피스 만화는 인기가 많습니다.</p>
    <p>한글 테스트입니다.</p>

    <h2>Mixed</h2>
    <p>Mix of English and 日本語 and 中文 text.</p>
  </article>
</body>
</html>`;

/**
 * HTML content for testing image URL matching with version parameters.
 * Images with same base URL but different query params should match.
 */
export const IMAGES_HTML = `<!DOCTYPE html>
<html>
<head><title>Image Test Page</title></head>
<body>
  <article>
    <h2>Cover Images</h2>
    <figure>
      <img src="https://example.com/covers/image.png?v=1" alt="Cover Version 1">
      <figcaption>First edition cover</figcaption>
    </figure>
    <figure>
      <img src="https://example.com/covers/image.png?v=2" alt="Cover Version 2">
      <figcaption>Second edition cover</figcaption>
    </figure>
    <figure>
      <img src="https://example.com/covers/image.png?v=3&size=large" alt="Cover Version 3">
      <figcaption>Third edition cover</figcaption>
    </figure>

    <h2>Other Images</h2>
    <img src="https://example.com/other/different.jpg" alt="Different Image">
    <img src="https://example.com/covers/another.png?v=1" alt="Another Cover">
  </article>
</body>
</html>`;

/**
 * HTML content for testing XPath stability with nested elements.
 * Contains deeply nested structures that test XPath resolution.
 */
export const NESTED_HTML = `<!DOCTYPE html>
<html>
<head><title>Nested HTML Test Page</title></head>
<body>
  <article>
    <div id="outer">
      <div id="middle">
        <div id="inner">
          <span class="highlight">Deeply nested text here</span>
        </div>
      </div>
    </div>

    <section class="content">
      <article class="post">
        <header>
          <h1>Post Title</h1>
        </header>
        <div class="body">
          <p>First paragraph with <strong>bold <em>and italic</em></strong> text.</p>
          <p>Second paragraph with <a href="#">a link <span>with nested span</span></a>.</p>
        </div>
      </article>
    </section>

    <div class="wrapper">
      <div class="container">
        <div class="row">
          <div class="col">
            <p>Column content here</p>
          </div>
        </div>
      </div>
    </div>
  </article>
</body>
</html>`;

/**
 * HTML content for testing table column/row selection.
 * Contains tables with clear structure for column and row selection tools.
 */
export const TABLES_HTML = `<!DOCTYPE html>
<html>
<head><title>Table Test Page</title></head>
<body>
  <article>
    <h2>Simple Table</h2>
    <table id="simple-table">
      <thead>
        <tr>
          <th>Header A</th>
          <th>Header B</th>
          <th>Header C</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Cell A1</td>
          <td>Cell B1</td>
          <td>Cell C1</td>
        </tr>
        <tr>
          <td>Cell A2</td>
          <td>Cell B2</td>
          <td>Cell C2</td>
        </tr>
        <tr>
          <td>Cell A3</td>
          <td>Cell B3</td>
          <td>Cell C3</td>
        </tr>
      </tbody>
    </table>

    <h2>Manga Info Table</h2>
    <table id="manga-table">
      <tr>
        <th>Title</th>
        <td>One Piece</td>
      </tr>
      <tr>
        <th>Author</th>
        <td>Eiichiro Oda</td>
      </tr>
      <tr>
        <th>Volumes</th>
        <td>105+</td>
      </tr>
      <tr>
        <th>Status</th>
        <td>Ongoing</td>
      </tr>
    </table>
  </article>
</body>
</html>`;

/**
 * Combined HTML content with all test scenarios.
 * Useful for comprehensive testing in a single page.
 */
export const COMBINED_HTML = `<!DOCTYPE html>
<html>
<head><title>Combined Annotation Test Page</title></head>
<body>
  <article>
    <section id="chapters">
      <h2>Chapter Tests</h2>
      <h3>Chapter 1: Beginning</h3>
      <p>Chapter 1 content here.</p>
      <h3>Chapter 10: Middle</h3>
      <p>Chapter 10 content.</p>
    </section>

    <section id="abbreviations">
      <h2>Abbreviation Tests</h2>
      <p>Read Vol. 1 first. Dr. Stone by Dr. Inagaki.</p>
      <p>See Ch. 5 for details. Mr. Smith met Mrs. Jones.</p>
    </section>

    <section id="ellipsis">
      <h2>Ellipsis Tests</h2>
      <p>Wait... What happened?</p>
      <p>I thought... maybe... we could try.</p>
    </section>

    <section id="cjk">
      <h2>CJK Tests</h2>
      <p>One Piece (ワンピース) is a manga.</p>
      <p>海贼王は面白い。원피스 만화.</p>
    </section>

    <section id="images">
      <h2>Image Tests</h2>
      <img src="https://example.com/image.png?v=1" alt="Cover 1">
      <img src="https://example.com/image.png?v=2" alt="Cover 2">
    </section>

    <section id="nested">
      <h2>Nested HTML Tests</h2>
      <div><div><span>Nested text</span></div></div>
    </section>

    <section id="tables">
      <h2>Table Tests</h2>
      <table>
        <tr><td>A1</td><td>B1</td><td>C1</td></tr>
        <tr><td>A2</td><td>B2</td><td>C2</td></tr>
      </table>
    </section>
  </article>
</body>
</html>`;

/**
 * Map of test content by name for easy access.
 */
export const TEST_PAGE_HTML = {
  chapters: CHAPTERS_HTML,
  abbreviations: ABBREVIATIONS_HTML,
  ellipsis: ELLIPSIS_HTML,
  cjk: CJK_HTML,
  images: IMAGES_HTML,
  nestedHtml: NESTED_HTML,
  tables: TABLES_HTML,
  combined: COMBINED_HTML,
} as const;

export type TestPageType = keyof typeof TEST_PAGE_HTML;

// ============================================================================
// Visual Inspector Test Fixtures
// ============================================================================

/**
 * HTML fixture for visual inspector tests
 * Contains various selectable elements for testing different selector scenarios
 */
export const VISUAL_INSPECTOR_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Manga Site</title>
</head>
<body>
  <section id="search-results">
    <div class="search-result" data-manga-id="1">
      <a href="/manga/1" class="search-result-title">One Piece</a>
    </div>
    <div class="search-result" data-manga-id="2">
      <a href="/manga/2" class="search-result-title">Naruto</a>
    </div>
  </section>
  <section id="manga-details">
    <h1 class="manga-title" id="title">One Piece</h1>
    <span class="manga-author">Author: Eiichiro Oda</span>
  </section>
</body>
</html>
`;

/**
 * Mock tRPC response for fetchWebsiteContent
 */
export const MOCK_FETCH_RESPONSE = {
  html: VISUAL_INSPECTOR_HTML,
  url: 'https://test-manga-site.com'
};

/**
 * Mock tRPC response for validateSelector (CSS)
 */
export const MOCK_VALIDATE_CSS_RESPONSE = {
  isValid: true,
  matchCount: 2,
  samples: ['One Piece', 'Naruto'],
  selector: '.search-result-title',
  selectorType: 'css' as const
};
