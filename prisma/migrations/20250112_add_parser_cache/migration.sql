-- CreateTable for Parser Cache
CREATE TABLE "ParserCache" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "compressed" BOOLEAN NOT NULL DEFAULT false,
    "size" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastAccessedAt" TIMESTAMP(3),

    CONSTRAINT "ParserCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for unique namespace + key combination
CREATE UNIQUE INDEX "ParserCache_namespace_key_key" ON "ParserCache"("namespace", "key");

-- CreateIndex for expiration cleanup
CREATE INDEX "ParserCache_expiresAt_idx" ON "ParserCache"("expiresAt");

-- CreateIndex for namespace queries
CREATE INDEX "ParserCache_namespace_idx" ON "ParserCache"("namespace");

-- CreateIndex for last accessed (for LRU eviction if needed)
CREATE INDEX "ParserCache_lastAccessedAt_idx" ON "ParserCache"("lastAccessedAt");

-- CreateIndex for size (for capacity management)
CREATE INDEX "ParserCache_size_idx" ON "ParserCache"("size");

-- Add comment to table
COMMENT ON TABLE "ParserCache" IS 'Cache storage for parsed metadata to improve parser performance';

-- Add comments to columns
COMMENT ON COLUMN "ParserCache"."namespace" IS 'Cache namespace for isolation (e.g., fandom, wikipedia, manga)';
COMMENT ON COLUMN "ParserCache"."key" IS 'SHA256 hash of the cache key';
COMMENT ON COLUMN "ParserCache"."data" IS 'Cached data, may be compressed if compressed flag is true';
COMMENT ON COLUMN "ParserCache"."compressed" IS 'Whether the data is gzip compressed';
COMMENT ON COLUMN "ParserCache"."size" IS 'Size of the cached data in bytes';
COMMENT ON COLUMN "ParserCache"."metadata" IS 'Optional metadata about the cached entry';
COMMENT ON COLUMN "ParserCache"."hits" IS 'Number of cache hits for this entry';
COMMENT ON COLUMN "ParserCache"."expiresAt" IS 'Expiration timestamp for TTL';
COMMENT ON COLUMN "ParserCache"."lastAccessedAt" IS 'Last time this cache entry was accessed';