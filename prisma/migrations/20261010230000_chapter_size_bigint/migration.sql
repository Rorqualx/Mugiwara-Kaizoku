-- Chapter.size holds a byte count. Whole-volume rows sum the sizes of the
-- chapters they cover, and a long series' volume archive exceeds the int4
-- maximum of 2,147,483,647 bytes (One Piece: 2,558,355,943), which made the
-- per-volume row step fail for the whole title on every enrichment.
ALTER TABLE "Chapter" ALTER COLUMN "size" TYPE BIGINT;
