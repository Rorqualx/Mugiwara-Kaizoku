import React from 'react';

import {
  Paper,
  Title,
  Text,
  Code,
  Stack,
  Box,
  Divider,
  Group,
  Button,
} from '@mantine/core';
import { IconExternalLink, IconBook } from '@tabler/icons-react';

export function DocumentationTab(): React.ReactElement {
  const apiUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/trpc` : 'https://your-domain.com/api/trpc';

  return (
    <Paper shadow="xs" p="xl" withBorder>
      <Title order={3} mb="lg">API Documentation</Title>

      <Stack gap="xl">
        <Box>
          <Title order={4} mb="sm">Authentication</Title>
          <Text mb="sm">
            All API requests must include an API key in the Authorization header:
          </Text>
          <Code block>
            {`Authorization: Bearer YOUR_API_KEY`}
          </Code>
        </Box>

        <Divider />

        <Box>
          <Title order={4} mb="sm">API Access</Title>
          <Code block>
            {apiUrl}
          </Code>
        </Box>

        <Divider />

        <Box>
          <Title order={4} mb="sm">Available Endpoints</Title>
          <Stack gap="md">
            <Box>
              <Text fw={500}>Manga</Text>
              <Code block>
                {`// Access via tRPC client
const manga = await trpc.manga.query.useQuery();
const details = await trpc.manga.get.useQuery({ id });
const created = await trpc.manga.add.useMutation(data);
const updated = await trpc.manga.update.useMutation({ id, data });
const deleted = await trpc.manga.remove.useMutation({ id });`}
              </Code>
            </Box>

            <Box>
              <Text fw={500}>Libraries</Text>
              <Code block>
                {`// Library operations
const libraries = await trpc.library.query.useQuery();
const library = await trpc.library.get.useQuery({ id });
const created = await trpc.library.create.useMutation(data);
const updated = await trpc.library.update.useMutation({ id, data });
const deleted = await trpc.library.delete.useMutation({ id });`}
              </Code>
            </Box>

            <Box>
              <Text fw={500}>Downloads</Text>
              <Code block>
                {`// Download operations
const downloads = await trpc.download.query.useQuery();
const started = await trpc.download.start.useMutation(data);
const cancelled = await trpc.download.cancel.useMutation({ id });`}
              </Code>
            </Box>
          </Stack>
        </Box>

        <Divider />

        <Box>
          <Title order={4} mb="sm">Rate Limiting</Title>
          <Text>
            API requests are limited to 1000 requests per hour per API key.
            Rate limit information is included in response headers:
          </Text>
          <Code block>
            {`X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200`}
          </Code>
        </Box>

        <Divider />

        <Box>
          <Title order={4} mb="sm">Error Responses</Title>
          <Text mb="sm">
            All error responses follow a consistent format:
          </Text>
          <Code block>
            {`{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found",
    "details": {}
  }
}`}
          </Code>
        </Box>

        <Divider />

        <Box>
          <Group>
            <Button
              variant="light"
              leftSection={<IconExternalLink size={16} />}
              component="a"
              href="/api/trpc-panel"
              target="_blank"
            >
              View OpenAPI Specification
            </Button>
            <Button
              variant="light"
              leftSection={<IconBook size={16} />}
              component="a"
              href="https://github.com/yourusername/mugiwara-kaizoku/wiki/API"
              target="_blank"
            >
              Full Documentation
            </Button>
          </Group>
        </Box>
      </Stack>
    </Paper>
  );
}