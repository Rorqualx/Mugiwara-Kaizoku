import { afterEach, describe, expect, it } from '@jest/globals';

import { processSingleton } from '@/server/utils/process-singleton';

describe('processSingleton', () => {
  const originalEnv = process.env['NODE_ENV'];

  afterEach(() => {
    Object.assign(process.env, { NODE_ENV: originalEnv });
  });

  it('returns one instance per name outside the test runner', () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    let created = 0;
    const create = (): { id: number } => ({ id: ++created });

    const first = processSingleton('process-singleton-test:a', create);
    const second = processSingleton('process-singleton-test:a', create);
    const other = processSingleton('process-singleton-test:b', create);

    expect(second).toBe(first);
    expect(other).not.toBe(first);
    expect(created).toBe(2);
  });

  it('creates a fresh instance on every call under the test runner', () => {
    Object.assign(process.env, { NODE_ENV: 'test' });
    const first = processSingleton('process-singleton-test:c', () => ({}));
    const second = processSingleton('process-singleton-test:c', () => ({}));
    expect(second).not.toBe(first);
  });
});
