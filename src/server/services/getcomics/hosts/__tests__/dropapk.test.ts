/**
 * Tests for the DropAPK URL extractor. Live network + FlareSolverr
 * cookie handling are intentionally not tested here.
 */
import { describe, it, expect } from '@jest/globals';

import { extractDropapkUrl } from '../dropapk';

describe('extractDropapkUrl', () => {
  it('extracts URL from the direct-link pattern', () => {
    const html = `
      <a href="https://dropapk.to/d/abc123def">Direct download</a>
    `;
    expect(extractDropapkUrl(html)).toBe('https://dropapk.to/d/abc123def');
  });

  it('extracts URL from the download-button class pattern', () => {
    const html = `
      <a class="btn-download" href="https://example.com/dl/file.cbz">Click</a>
    `;
    expect(extractDropapkUrl(html)).toBe('https://example.com/dl/file.cbz');
  });

  it('extracts URL from the onclick handler pattern', () => {
    const html = `
      <button onclick="location.href='https://example.com/dl/file.cbz'">Go</button>
    `;
    expect(extractDropapkUrl(html)).toBe('https://example.com/dl/file.cbz');
  });

  it('returns null when no pattern matches', () => {
    expect(extractDropapkUrl('<html><body>nothing here</body></html>')).toBeNull();
  });

  it('returns null on empty input', () => {
    expect(extractDropapkUrl('')).toBeNull();
  });
});
