-- cache_unified: drop two indexes that cost writes and serve no query.
--
-- idx_cache_unified_gin  GIN over the whole cache_value document. No query
--                        searches inside cache_value (rows are always located
--                        by key); production shows 0 scans and 5.4 MB, and it
--                        is re-indexed on every write of a cached document.
-- idx_cache_unified_hash Hash on cache_key, which is already the primary key.
--                        Equality lookups use the primary key's btree instead.
--
-- IF EXISTS keeps this safe on databases where they were never created.

DROP INDEX IF EXISTS "idx_cache_unified_gin";
DROP INDEX IF EXISTS "idx_cache_unified_hash";
