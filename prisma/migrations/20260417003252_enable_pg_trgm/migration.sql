-- Enable pg_trgm for trigram-based similarity and ILIKE/contains search
-- acceleration. Required by the GIN indexes added in the follow-up migration
-- 20260417003253_add_trgm_and_array_search_indexes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
