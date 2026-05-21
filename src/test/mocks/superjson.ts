/**
 * Mock for superjson library in tests
 *
 * Provides basic serialization/deserialization functionality
 * for testing without full superjson complexity.
 */

interface SuperJsonSerialized<T = unknown> {
  json: T;
  meta?: unknown;
}

export default {
  serialize: <T = unknown>(object: T): SuperJsonSerialized<T> => ({
    json: JSON.parse(JSON.stringify(object)) as T,
    meta: undefined,
  }),
  deserialize: <T = unknown>({ json }: SuperJsonSerialized<T>): T => json,
  stringify: (object: unknown): string => JSON.stringify(object),
  parse: <T = unknown>(string: string): T => JSON.parse(string) as T,
};