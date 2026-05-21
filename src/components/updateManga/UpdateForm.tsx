"use client";
/**
 * Update Manga Form Component
 *
 * A form component for editing manga details including title and AniList ID.
 * Provides functionality for updating manga metadata and removing manga
 * from the library. Uses Mantine components for the UI and Zod for form validation.
 *
 * @module components/updateManga/UpdateForm
 */
import type { JSX } from "react";
import React, { useCallback, useEffect } from "react";

import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Grid,
  Group,
  Image,
  LoadingOverlay,
  Text,
  Title,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { useModals } from "@mantine/modals";
import { IconAlertCircle, IconTrash } from "@tabler/icons-react";

import { useAniListIdExtractor } from "@/components/manga/manga-detail-modals/hooks/useMetadataExtractors";
import { toNumberId } from "@/utils/id-converters";
import { trpc } from "@/utils/trpc-client";

import { useRemoveModal } from "../removeManga";

import {
  getCoverUrl,
  updateFormSchema,
  useUpdateFormMutations,
} from "./update-form";

import type { FormValues, UpdateFormProps } from "./update-form";

/**
 * Form component for updating manga information
 *
 * @param props - Component props
 * @returns Rendered form component
 */
export function UpdateForm({ manga, onUpdate, onClose }: UpdateFormProps): JSX.Element {
  // Fetch full manga data to ensure we have all metadata fields (URLs, providerMetadata)
  // This fixes the issue where library grid doesn't include all metadata fields
  const mangaNumericId = toNumberId(manga.id);
  const { data: fullManga } = trpc.manga.get.useQuery(
    { id: mangaNumericId },
    { enabled: mangaNumericId > 0 }
  );

  // Use full manga data if available, otherwise fall back to prop data
  const mangaData = fullManga ?? manga;

  // Extract AniList ID using the same logic as the manga page (from URLs or providerMetadata)
  const extractedAnilistId = useAniListIdExtractor(mangaData);

  // Create form with validation
  const form = useForm<FormValues>({
    initialValues: {
      id: manga.id,
      title: manga.title,
      anilistId: manga.Metadata?.sourceId ?? '',
    },
    validate: zodResolver(updateFormSchema),
  });

  // Update anilistId when full data loads and extraction succeeds
  useEffect(() => {
    const newAnilistId = extractedAnilistId ?? mangaData.Metadata?.sourceId ?? '';
    if (newAnilistId && form.values.anilistId === '') {
      form.setFieldValue('anilistId', newAnilistId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only update when extracted ID changes
  }, [extractedAnilistId, mangaData.Metadata?.sourceId]);

  // Use extracted mutations hook - now manages loading/error internally
  const {
    handleSubmit,
    handleRemoveManga,
    isUpdating,
    isRemoving,
    loading,
    error,
    clearError,
  } = useUpdateFormMutations({
    mangaTitle: manga.title,
    onUpdate,
    onClose,
    resetForm: form.reset,
  });

  // Get derived data
  const coverUrl = getCoverUrl(manga, manga.id);

  // Get modals instance and create remove modal handler
  const modals = useModals();
  const openRemoveModal = useRemoveModal(
    manga.title,
    (shouldRemoveFiles: boolean) => {
      void handleRemoveManga(manga.id, shouldRemoveFiles);
    },
    modals
  );

  // Form submit handler
  const onFormSubmit = useCallback(
    (values: FormValues): void => {
      void handleSubmit(values);
    },
    [handleSubmit]
  );

  return (
    <Box
      component="form"
      onSubmit={form.onSubmit(onFormSubmit)}
      display="flex"
      style={{
        flexDirection: "column",
        minHeight: 300,
        padding: "var(--mantine-spacing-xs)",
      }}
    >
      <LoadingOverlay visible={loading} />

      {/* Error display */}
      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error"
          color="red"
          withCloseButton
          onClose={clearError}
          mb="md"
        >
          {error}
        </Alert>
      )}

      <Grid>
        <Grid.Col span={4}>
          <Box style={{ width: "150px" }}>
            <Image
              src={coverUrl}
              alt={`Cover for ${manga.title}`}
              fit="contain"
              fallbackSrc="/cover-not-found.jpg"
            />
          </Box>
        </Grid.Col>
        <Grid.Col span={8}>
          <Divider
            mb="xs"
            labelPosition="center"
            label={<Title order={3}>{manga.title}</Title>}
          />

          <Divider variant="dashed" my="xs" label="Status" />
          <Badge color="cyan" variant="filled" size="sm">
            {manga.Metadata?.status ?? "No status..."}
          </Badge>

          <Divider variant="dashed" my="xs" label="Summary" />
          <Text size="sm">{manga.Metadata?.summary ?? "No summary..."}</Text>

          <Divider variant="dashed" my="xs" label="Genres" />
          <Group gap="md">
            {manga.Metadata?.genres.map((genre: string) => (
              <Badge key={genre} color="indigo" variant="light" size="xs">
                {genre}
              </Badge>
            ))}
          </Group>

          <Divider variant="dashed" my="xs" label="Tags" />
          <Group gap="md">
            {manga.Metadata?.tags.map((tag: string) => (
              <Badge key={tag} color="violet" variant="light" size="xs">
                {tag}
              </Badge>
            ))}
          </Group>
        </Grid.Col>
      </Grid>

      <Group mt={30} justify="space-between">
        <Group>
          <Button variant="default" onClick={() => onClose?.()} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={isUpdating} disabled={isRemoving}>
            Update
          </Button>
        </Group>

        <Button
          variant="filled"
          color="red"
          leftSection={<IconTrash size={16} />}
          onClick={() => {
            void openRemoveModal();
          }}
          loading={isRemoving}
          disabled={isUpdating}
          type="button"
        >
          Delete
        </Button>
      </Group>
    </Box>
  );
}
