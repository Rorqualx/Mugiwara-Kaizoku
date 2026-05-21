/**
 * Debug page for checking library data access
 * 
 * This page lists all libraries and provides links to individual library pages.
 * Used for testing library data fetching and display.
 */

import React from "react";

import { Box, Title, Text, List, Group, Button } from "@mantine/core";
import Link from "next/link";

import { trpc } from '@/utils/trpc-client';

export default function LibraryDebugPage(): React.ReactElement {
  const { data: libraries, error, isLoading } = trpc.library.query.useQuery();

  if (isLoading) {
    return <Text>Loading libraries...</Text>;
  }

  if (error) {
    return (
      <Box>
        <Title order={3}>Error loading libraries</Title>
        <Text>{error?.message ?? 'Unknown error'}</Text>
      </Box>);

  }

  interface DebugLibrary {
    id: number;
    name: string;
    Manga?: Array<Record<string, unknown>>;
  }

  function isLibrary(item: unknown): item is DebugLibrary {
    if (!item || typeof item !== 'object') return false;
    const obj = item as Record<string, unknown>;
    return (
      'id' in obj && typeof obj['id'] === 'number' &&
      'name' in obj && typeof obj['name'] === 'string' &&
      (!('Manga' in obj) || obj['Manga'] === null || Array.isArray(obj['Manga']))
    );
  }

  if (!libraries || !Array.isArray(libraries) || libraries.length === 0) {
    return <Text>No libraries found. Please create a library first.</Text>;
  }

  const validLibraries: DebugLibrary[] = Array.isArray(libraries)
    ? (libraries as unknown[]).filter(isLibrary)
    : [];

  return (
    <Box p="md">
      <Title order={2} mb="lg">Library Debug Page</Title>
      
      <Text mb="md">This page helps diagnose library data fetching issues. Found {validLibraries.length} libraries:</Text>
      
      <List mb="xl">
        {validLibraries.map((library): React.ReactElement => {
          // Since we've filtered using isLibrary type guard, TypeScript should know these are Library objects
          // But we'll add extra type safety to be sure
          const id = library["id"];
          const name = library["name"];
          const mangaCount = library.Manga && Array.isArray(library.Manga) ? library.Manga.length : 0;

          return (
            <List.Item key={id}>
              <Group justify="space-between">
                <Text>
                  Library ID: {id}, 
                  Name: <strong>{name}</strong>, 
                  Manga Count: {mangaCount}
                </Text>
                <Link href={`/library/${id}`} passHref legacyBehavior>
                  <Button component="a" size="xs" variant="light">View Library</Button>
                </Link>
              </Group>
            </List.Item>);

        })}
      </List>

      <Box mt="xl">
        <Title order={4}>Library API Endpoints</Title>
        <Text size="sm">
          Endpoint used on library pages: <code>trpc.library.detail.useQuery({`{ id: number }`})</code><br />
          Expected output includes: id, name, path, createdAt, mangas[]
        </Text>
      </Box>
    </Box>);

}