/**
 * Phase 4 v2-B: Related Works Carousel
 *
 * Two horizontally scrolling carousels backed by the modern enrichment
 * tables (`MangaRelation`, `MangaRecommendation`):
 *
 *  - Related Series — structural ties (sequel / prequel / spin-off etc.)
 *  - Recommendations — taste-similarity from AL + MAL, AL/MAL source pills
 *    surfaced per card and a "Both" pill when the same target is recommended
 *    by both communities.
 *
 * Routing rule per card:
 *  - Bound to a local manga (`localManga` non-null) → `/manga/{id}` internal.
 *  - External-only → opens AL or MAL detail page in a new tab.
 */

"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActionIcon, Badge, Box, Group, Paper, Text, Title, Tooltip } from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconExternalLink, IconLink, IconStar, IconThumbUp } from "@tabler/icons-react";
import Link from "next/link";

import { getCoverUrl } from "@/utils/cover-url";
import { trpc } from "@/utils/trpc-client";

interface RelatedWorksCarouselProps {
  mangaId: number;
}

const RELATION_LABEL: Record<string, string> = {
  SEQUEL: "Sequel", PREQUEL: "Prequel", SIDE_STORY: "Side Story",
  SPIN_OFF: "Spin-Off", ALTERNATIVE: "Alternative", PARENT: "Parent",
  ADAPTATION: "Adaptation", CHARACTER: "Character", SUMMARY: "Summary",
  COMPILATION: "Compilation", CONTAINS: "Contains", SOURCE: "Source",
  OTHER: "Other",
};
const RELATION_COLOR: Record<string, string> = {
  SEQUEL: "blue", PREQUEL: "violet", SIDE_STORY: "cyan",
  SPIN_OFF: "teal", ALTERNATIVE: "orange", PARENT: "indigo",
  ADAPTATION: "pink", CHARACTER: "yellow", SUMMARY: "lime",
  COMPILATION: "grape", CONTAINS: "gray", SOURCE: "red",
  OTHER: "gray",
};

const SOURCE_LABEL: Record<string, string> = { anilist: "AniList", mal: "MAL" };
const SOURCE_COLOR: Record<string, string> = { anilist: "blue", mal: "indigo" };

function externalUrlFor(source: string, id: string): string {
  if (source === "anilist") return `https://anilist.co/manga/${id}`;
  if (source === "mal") return `https://myanimelist.net/manga/${id}`;
  return "#";
}

export function RelatedWorksCarousel({ mangaId }: RelatedWorksCarouselProps): React.ReactElement | null {
  const { data } = trpc.browse.getRelatedWorks.useQuery({ mangaId });

  if (!data) return null;
  const hasRelations = data.relations.length > 0;
  const hasRecs = data.recommendations.length > 0;
  if (!hasRelations && !hasRecs) return null;

  return (
    <Box mt="lg">
      {hasRelations && (
        <CarouselRow
          title="Related Series"
          icon={<IconLink size={20} />}
          items={data.relations.map(r => relationToCardItem(r))}
        />
      )}
      {hasRecs && (
        <CarouselRow
          title="You Might Also Like"
          icon={<IconStar size={20} />}
          items={data.recommendations.map(r => recommendationToCardItem(r))}
        />
      )}
    </Box>
  );
}

// ============================================================================
// Card model — both relations and recommendations collapse to this shape so
// the scroller renders a single component.
// ============================================================================

interface CardItem {
  key: string;
  title: string;
  coverUrl: string;
  href: string;
  external: boolean;
  badges: Array<{ label: string; color: string }>;
  footnote?: string;
}

interface LocalManga {
  id: number;
  title: string;
  Metadata: {
    cover: string | null;
    coverLarge: string | null;
  } | null;
}
type RelationRow = { externalSource: string; externalToId: string; targetTitle: string; targetMedium: string | null; relationType: string; localManga: LocalManga | null };
type RecommendationRow = { externalSources: string[]; externalToIds: Record<string, string>; targetTitle: string; targetMedium: string | null; targetFormat: string | null; targetCoverUrl: string | null; rating: number | null; localManga: LocalManga | null };

function relationToCardItem(r: RelationRow): CardItem {
  const badges: CardItem["badges"] = [
    { label: RELATION_LABEL[r.relationType] ?? r.relationType, color: RELATION_COLOR[r.relationType] ?? "gray" },
  ];
  if (r.localManga) badges.push({ label: "In Library", color: "green" });
  return {
    key: `rel:${r.externalSource}:${r.externalToId}:${r.relationType}`,
    title: r.localManga?.title ?? r.targetTitle,
    coverUrl: coverFor(r.localManga, null),
    href: r.localManga ? `/manga/${r.localManga.id}` : externalUrlFor(r.externalSource, r.externalToId),
    external: !r.localManga,
    badges,
  };
}

function recommendationToCardItem(r: RecommendationRow): CardItem {
  const badges: CardItem["badges"] = r.externalSources.length === 2
    ? [{ label: "AL + MAL", color: "grape" }]
    : r.externalSources.map(s => ({ label: SOURCE_LABEL[s] ?? s, color: SOURCE_COLOR[s] ?? "gray" }));
  if (r.localManga) badges.push({ label: "In Library", color: "green" });
  const firstSource = r.externalSources[0] ?? "anilist";
  const firstExternalId = r.externalToIds[firstSource] ?? "";
  const item: CardItem = {
    key: r.localManga
      ? `rec:local:${r.localManga.id}`
      : `rec:${firstSource}:${firstExternalId}`,
    title: r.localManga?.title ?? r.targetTitle,
    coverUrl: coverFor(r.localManga, r.targetCoverUrl),
    href: r.localManga ? `/manga/${r.localManga.id}` : externalUrlFor(firstSource, firstExternalId),
    external: !r.localManga,
    badges,
  };
  if (r.rating !== null && r.rating > 0) item.footnote = `${r.rating}`;
  return item;
}

function coverFor(local: LocalManga | null, fallback: string | null): string {
  if (local?.Metadata) return getCoverUrl(local.Metadata, local.id);
  if (fallback) return fallback;
  return "/cover-not-found.jpg";
}

// ============================================================================
// Scroll-snap carousel — mirrors the home/MangaRow pattern at a smaller card
// scale (this is a detail-page side feature, not the headline).
// ============================================================================

const CARD_WIDTH = 140;
const CARD_HEIGHT = 210;
const GAP = 12;

function CarouselRow({ title, icon, items }: { title: string; icon: React.ReactNode; items: CardItem[] }): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const updateArrows = useCallback((): void => {
    const el = containerRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 0);
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    return () => el.removeEventListener("scroll", updateArrows);
  }, [updateArrows]);

  const scrollBy = useCallback((dir: 1 | -1): void => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (CARD_WIDTH + GAP) * 3, behavior: "smooth" });
  }, []);

  const cards = useMemo(() => items.map(item => <RelatedWorkCard key={item.key} item={item} />), [items]);

  return (
    <Box mb="xl">
      <Group gap="xs" mb="sm" px={4}>
        {icon}
        <Title order={4}>{title}</Title>
        <Text size="xs" c="dimmed">({items.length})</Text>
      </Group>
      <Box pos="relative">
        {showLeft && (
          <ActionIcon
            size="lg" radius="xl" variant="filled" color="dark"
            onClick={() => scrollBy(-1)}
            aria-label="Scroll left"
            style={{ position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", zIndex: 5, backgroundColor: "rgba(0,0,0,0.65)" }}
          >
            <IconChevronLeft size={18} />
          </ActionIcon>
        )}
        {showRight && (
          <ActionIcon
            size="lg" radius="xl" variant="filled" color="dark"
            onClick={() => scrollBy(1)}
            aria-label="Scroll right"
            style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", zIndex: 5, backgroundColor: "rgba(0,0,0,0.65)" }}
          >
            <IconChevronRight size={18} />
          </ActionIcon>
        )}
        <Box
          ref={containerRef}
          className="hide-scrollbar"
          style={{
            display: "flex",
            overflowX: "auto",
            overflowY: "hidden",
            gap: `${GAP}px`,
            scrollSnapType: "x mandatory",
            scrollBehavior: "smooth",
            paddingBottom: 4,
          }}
        >
          {cards}
        </Box>
      </Box>
    </Box>
  );
}

function RelatedWorkCard({ item }: { item: CardItem }): React.ReactElement {
  const inner = (
    <Box style={{ width: CARD_WIDTH, minWidth: CARD_WIDTH, scrollSnapAlign: "start", cursor: "pointer" }}>
      <Paper
        radius="md"
        pos="relative"
        h={CARD_HEIGHT}
        style={{
          width: "100%",
          backgroundColor: "#2a2a2a",
          backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.15)), url(${item.coverUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          overflow: "hidden",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
        className="related-work-card"
      >
        <Box pos="absolute" top={6} left={6} right={6}>
          <Group gap={4} wrap="wrap">
            {item.badges.map((b, i) => (
              <Badge key={i} size="xs" variant="filled" color={b.color} style={{ backgroundColor: `var(--mantine-color-${b.color}-8)` }}>
                {b.label}
              </Badge>
            ))}
          </Group>
        </Box>
        {item.external && (
          <Box pos="absolute" bottom={6} right={6}>
            <Tooltip label="Opens externally" withArrow>
              <IconExternalLink size={14} color="white" />
            </Tooltip>
          </Box>
        )}
        {item.footnote !== undefined && (
          <Box pos="absolute" bottom={6} left={6}>
            <Badge size="xs" variant="filled" color="dark" leftSection={<IconThumbUp size={10} />} style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
              {item.footnote}
            </Badge>
          </Box>
        )}
      </Paper>
      <Text ta="center" fw={500} size="xs" mt={6} lineClamp={2} style={{ wordBreak: "break-word" }}>
        {item.title}
      </Text>
    </Box>
  );

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={item.href} style={{ textDecoration: "none", color: "inherit" }}>
      {inner}
    </Link>
  );
}
