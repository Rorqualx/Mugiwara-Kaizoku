import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { createLogger } from '@/utils/logger';

describe('logger.error with a context object as the second argument', () => {
  let output: string[];
  let spy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    output = [];
    spy = jest.spyOn(console, 'error').mockImplementation((line: unknown) => { output.push(String(line)); });
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('keeps the fields and puts the error text in the message', () => {
    createLogger('test').error('Release search failed', { title: 'Tengoku Daimakyou', seriesId: 42, error: 'MangaUpdates API 503: busy' });

    expect(output).toHaveLength(1);
    expect(output[0]).toContain('Release search failed: MangaUpdates API 503: busy');
    expect(output[0]).toContain('"title":"Tengoku Daimakyou"');
    expect(output[0]).toContain('"seriesId":42');
    expect(output[0]).not.toContain('[object Object]');
  });

  it('keeps the fields when there is no error text', () => {
    createLogger('test').error('Import failed', { mangaId: 7 });

    expect(output[0]).toContain('Import failed {');
    expect(output[0]).toContain('"mangaId":7');
    expect(output[0]).not.toContain('[object Object]');
  });

  it('still reports Error instances and plain strings as before', () => {
    const log = createLogger('test');
    log.error('Boom', new Error('disk full'), { path: '/x' });
    log.error('Boom', 'plain text');

    expect(output[0]).toContain('Boom: disk full');
    expect(output[0]).toContain('"path":"/x"');
    expect(output[1]).toContain('Boom: plain text');
  });
});
