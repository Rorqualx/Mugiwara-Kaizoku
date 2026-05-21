/**
 * Tests for the GoFile URL parser. The live API + cookie hand-off paths
 * are intentionally not covered here — they require real GoFile shares
 * and the token endpoint, which would be flaky.
 */
import { describe, it, expect } from '@jest/globals';

import { parseGoFileContentId } from '../gofile';

describe('parseGoFileContentId', () => {
  it('extracts ID from the canonical slash form', () => {
    expect(parseGoFileContentId('https://gofile.io/d/AbCdEf123')).toBe('AbCdEf123');
  });

  it('extracts ID from the legacy query form', () => {
    expect(parseGoFileContentId('https://gofile.io/?c=AbCdEf123')).toBe('AbCdEf123');
  });

  it('returns null for a non-GoFile URL', () => {
    expect(parseGoFileContentId('https://example.com/d/AbCdEf123')).toBeNull();
  });

  it('returns null for a GoFile URL with no id', () => {
    expect(parseGoFileContentId('https://gofile.io/d/')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseGoFileContentId('')).toBeNull();
  });
});
