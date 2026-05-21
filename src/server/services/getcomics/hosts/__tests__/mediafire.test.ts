/**
 * Tests for the MediaFire URL extractor.
 *
 * Live network calls + FlareSolverr cookie handling are intentionally NOT
 * tested here — those need real GetComics fixtures and would be flaky.
 * What we do cover: the three regex patterns the extractor tries, in order.
 *
 * If MediaFire ships a major site redesign these patterns will stop
 * matching real pages; the test fixtures here will keep passing because
 * they're frozen snapshots of the patterns as written.
 */

import { describe, it, expect } from '@jest/globals';

import { extractMediafireUrl } from '../mediafire';

describe('extractMediafireUrl', () => {
  it('extracts URL from the primary download-button pattern', () => {
    const html = `
      <html>
        <body>
          <a id="downloadButton"
             aria-label="Download file"
             href="https://download2046.mediafire.com/abc123/file.cbz">
            Download
          </a>
        </body>
      </html>
    `;
    expect(extractMediafireUrl(html)).toBe('https://download2046.mediafire.com/abc123/file.cbz');
  });

  it('extracts URL from script-embedded downloadUrl variable', () => {
    const html = `
      <script>
        window.downloadUrl = "https://example-cdn.mediafire.com/abc/file.cbz";
        init();
      </script>
    `;
    expect(extractMediafireUrl(html)).toBe('https://example-cdn.mediafire.com/abc/file.cbz');
  });

  it('extracts URL from the input/downloadButton fallback pattern', () => {
    // The third regex looks for `id="downloadButton"` followed by `href="..."`.
    // The first regex won't match here because the URL doesn't contain
    // `download<digits>.mediafire.com` and there's no script-embedded
    // downloadUrl variable.
    const html = `
      <input id="downloadButton" type="button" href="https://other-host.example.com/x.cbz" />
    `;
    expect(extractMediafireUrl(html)).toBe('https://other-host.example.com/x.cbz');
  });

  it('returns null when no pattern matches', () => {
    const html = '<html><body>No download link here</body></html>';
    expect(extractMediafireUrl(html)).toBeNull();
  });

  it('returns null on empty input', () => {
    expect(extractMediafireUrl('')).toBeNull();
  });
});
