/**
 * Living Covers Settings Page
 *
 * Admin controls for the Living Covers feature: the global enable switch,
 * on-demand ONNX model download, and a library-wide "process covers" trigger
 * with live progress. Generation is CPU-bound and runs in the background.
 */

import React from 'react';

import { Badge, Button, Card, Checkbox, Container, Group, Loader, Progress, SegmentedControl, Stack, Switch, Text, Title } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { IconAlertCircle, IconCheck, IconDownload, IconPhoto } from '@tabler/icons-react';

import SettingsLayout from '@/components/layouts/SettingsLayout';
import { trpc } from '@/utils/trpc-client/index';

const PROCESS_REASONS: Record<string, string> = {
  'already-running': 'A processing run is already in progress.',
  'models-missing': 'Download the models first.',
};

function LivingCoversSettings(): React.ReactElement {
  const [force, setForce] = React.useState(false);
  const { data: status, refetch } = trpc.coverLayers.status.useQuery(undefined, {
    refetchInterval: (query) => {
      const d = query.state.data;
      return d?.progress.running === true || d?.download.active === true ? 1500 : false;
    },
    refetchOnWindowFocus: false,
  });

  const setEnabled = trpc.coverLayers.setEnabled.useMutation({ onSuccess: () => void refetch() });
  const setSegmenter = trpc.coverLayers.setSegmenter.useMutation({
    onSuccess: () => {
      showNotification({ title: 'Segmenter changed', message: 'Re-process the library to apply it.', color: 'blue' });
      void refetch();
    },
  });
  const setSmartEffects = trpc.coverLayers.setSmartEffects.useMutation({
    onSuccess: () => {
      showNotification({ title: 'Smart effects updated', message: 'Re-process the library to apply it.', color: 'blue' });
      void refetch();
    },
  });
  const downloadModels = trpc.coverLayers.downloadModels.useMutation({
    onSuccess: (res) => {
      showNotification(
        res.started
          ? { title: 'Downloading models', message: 'ONNX models are downloading in the background.', color: 'blue', icon: <IconDownload /> }
          : { title: 'Already downloading', message: 'A model download is already in progress.', color: 'yellow' },
      );
      void refetch();
    },
  });
  const processLibrary = trpc.coverLayers.processLibrary.useMutation({
    onSuccess: (res) => {
      if (res.started) {
        showNotification({ title: 'Processing started', message: 'Generating living covers across the library.', color: 'green', icon: <IconCheck /> });
      } else {
        showNotification({ title: 'Could not start', message: PROCESS_REASONS[res.reason ?? ''] ?? 'Unable to start processing.', color: 'red', icon: <IconAlertCircle /> });
      }
      void refetch();
    },
  });

  if (status === undefined) {
    return (
      <SettingsLayout title="Living Covers">
        <Container size="md" px={0}>
          <Group justify="center" py="xl"><Loader /></Group>
        </Container>
      </SettingsLayout>
    );
  }

  const { progress } = status;
  const dl = status.download;
  const running = progress.running;
  const modelsReady = status.modelsPresent;
  const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <SettingsLayout title="Living Covers">
      <Container size="md" px={0}>
        <Stack gap="lg">
          <Card withBorder padding="lg" radius="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={4}>Living Covers</Title>
                <Text size="sm" c="dimmed" maw={520}>
                  Split each cover into a static character over a drifting, inpainted background (2.5D parallax). When on,
                  newly imported covers are processed automatically and covers animate in the library + on detail pages.
                </Text>
              </div>
              <Switch
                size="lg"
                checked={status.enabled}
                onChange={(e) => setEnabled.mutate({ enabled: e.currentTarget.checked })}
                disabled={setEnabled.isPending}
              />
            </Group>
          </Card>

          <Card withBorder padding="lg" radius="md">
            <Stack gap="sm">
              <div>
                <Title order={5}>Separation quality</Title>
                <Text size="sm" c="dimmed" maw={520}>
                  How background layers are separated. <b>Standard</b> uses fast depth bands; <b>SAM</b> uses MobileSAM
                  object masks for cleaner, object-aware layers (slower). Changing this needs a re-process.
                </Text>
              </div>
              <SegmentedControl
                value={status.segmenter}
                onChange={(v) => setSegmenter.mutate({ segmenter: v === 'sam' ? 'sam' : 'standard' })}
                disabled={setSegmenter.isPending || running}
                data={[
                  { label: 'Standard (fast)', value: 'standard' },
                  { label: 'SAM — better separation', value: 'sam' },
                ]}
              />
              <Switch
                mt="xs"
                label="Smart effects (experimental) — tag the cover and tune drift to the mood (action covers livelier, calm covers gentler)"
                checked={status.smartEffects}
                onChange={(e) => setSmartEffects.mutate({ enabled: e.currentTarget.checked })}
                disabled={setSmartEffects.isPending || running}
              />
            </Stack>
          </Card>

          <Card withBorder padding="lg" radius="md">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <div>
                  <Group gap="xs">
                    <Title order={5}>ONNX models</Title>
                    <Badge color={modelsReady ? 'green' : 'gray'} variant="light">
                      {modelsReady ? 'Installed' : 'Not installed'}
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed" maw={520}>
                    ~456 MB (segmentation, inpainting, depth, text detection). Downloaded once to the persistent config volume.
                  </Text>
                </div>
                <Button
                  leftSection={<IconDownload size={16} />}
                  variant="light"
                  onClick={() => downloadModels.mutate()}
                  loading={dl.active || downloadModels.isPending}
                  disabled={modelsReady && !dl.active}
                >
                  {modelsReady ? 'Installed' : 'Download models'}
                </Button>
              </Group>

              {dl.active && (
                <Stack gap={4}>
                  <Group justify="space-between">
                    <Text size="sm">
                      Downloading {dl.fileName === '' ? 'models' : dl.fileName}
                      {dl.fileCount > 0 ? ` (${dl.fileIndex}/${dl.fileCount})` : ''}
                    </Text>
                    <Text size="sm" fw={600}>{dl.overallPct}%</Text>
                  </Group>
                  <Progress value={dl.overallPct} animated />
                </Stack>
              )}
            </Stack>
          </Card>

          <Card withBorder padding="lg" radius="md">
            <Stack gap="md">
              <div>
                <Title order={5}>Process library covers</Title>
                <Text size="sm" c="dimmed" maw={520}>
                  Generate (or regenerate) living-cover layers for every manga. Idempotent — already-processed covers are
                  skipped unless you force a rebuild.
                </Text>
              </div>

              <Group gap="lg">
                <Text size="sm"><b>{status.layered}</b> layered</Text>
                <Text size="sm" c="dimmed"><b>{status.flat}</b> flat</Text>
                <Text size="sm" c="dimmed"><b>{status.pending}</b> pending</Text>
                <Text size="sm" c={status.failed > 0 ? 'red' : 'dimmed'}><b>{status.failed}</b> failed</Text>
                <Text size="sm" c="dimmed">of <b>{status.total}</b> manga</Text>
              </Group>

              {running && (
                <Stack gap={4}>
                  <Group gap="xs">
                    <Loader size="xs" />
                    <Text size="sm">Processing {progress.processed}/{progress.total}…</Text>
                  </Group>
                  <Progress value={pct} animated />
                </Stack>
              )}

              <Group justify="space-between">
                <Checkbox
                  label="Force rebuild (re-layerize covers that are already done)"
                  checked={force}
                  onChange={(e) => setForce(e.currentTarget.checked)}
                  disabled={running}
                />
                <Button
                  leftSection={<IconPhoto size={16} />}
                  onClick={() => processLibrary.mutate({ force })}
                  loading={processLibrary.isPending}
                  disabled={!modelsReady || running}
                >
                  Process Library Covers
                </Button>
              </Group>
            </Stack>
          </Card>
        </Stack>
      </Container>
    </SettingsLayout>
  );
}

export default LivingCoversSettings;
