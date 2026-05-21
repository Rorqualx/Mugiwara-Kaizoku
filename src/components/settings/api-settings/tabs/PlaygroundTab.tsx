import React from 'react';

import {
  Paper,
  Title,
  Text,
  Stack,
  TextInput,
  JsonInput,
  Group,
  Button,
  Divider,
  Box,
  Code,
} from '@mantine/core';

export function PlaygroundTab(): React.ReactElement {
  return (
    <Paper shadow="xs" p="xl" withBorder>
      <Title order={3} mb="lg">API Playground</Title>
      <Text c="dimmed" mb="xl">
        Test API endpoints directly from your browser
      </Text>

      <Stack gap="md">
        <TextInput
          label="API Key"
          placeholder="mk_..."
          description="Enter your API key to authenticate requests"
        />

        <TextInput
          label="Endpoint"
          placeholder="manga.query"
          description="Enter the API endpoint you want to test"
        />

        <JsonInput
          label="Request Body (JSON)"
          placeholder="{}"
          autosize
          minRows={4}
          formatOnBlur
        />

        <Group>
          <Button variant="filled" color="green">GET</Button>
          <Button variant="filled" color="blue">POST</Button>
          <Button variant="filled" color="orange">PUT</Button>
          <Button variant="filled" color="red">DELETE</Button>
        </Group>

        <Divider />

        <Box>
          <Title order={5} mb="sm">Response</Title>
          <Code block>
            {/* Response would be shown here */}
            {`// Make a request to see the response`}
          </Code>
        </Box>
      </Stack>
    </Paper>
  );
}