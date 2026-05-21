/**
 * Status Summary Card Component for Job History Page
 */
import React from 'react';

import { Card, Group, Text, Badge, Box, Grid } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';

interface StatusSummaryProps {
  totalCount: number;
  pageCount: number;
  statusCounts: Record<string, number>;
}

export function StatusSummary({ totalCount, pageCount, statusCounts }: StatusSummaryProps): React.ReactElement {
  return (
    <Grid>
      <Grid.Col span={12}>
        <Card style={{ backgroundColor: '#424242', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Group justify="space-between">
            <div>
              <Text size="sm" c="dimmed" tt="uppercase" fw={700}>Complete Job History</Text>
              <Text size="xl" fw={700} style={{ color: '#ffffff' }}>
                {totalCount} Total ({pageCount} on page)
              </Text>
              <Group gap="md" mt={8}>
                {(statusCounts['pending'] ?? 0) > 0 && (
                  <Badge color="yellow" variant="light" size="sm">{statusCounts['pending']} Queued</Badge>
                )}
                {(statusCounts['active'] ?? 0) > 0 && (
                  <Badge color="blue" variant="light" size="sm">{statusCounts['active']} Active</Badge>
                )}
                {(statusCounts['retrying'] ?? 0) > 0 && (
                  <Badge color="orange" variant="light" size="sm">{statusCounts['retrying']} Retrying</Badge>
                )}
                {(statusCounts['completed'] ?? 0) > 0 && (
                  <Badge color="green" variant="light" size="sm">{statusCounts['completed']} Completed</Badge>
                )}
                {(statusCounts['failed'] ?? 0) > 0 && (
                  <Badge color="red" variant="light" size="sm">{statusCounts['failed']} Failed</Badge>
                )}
              </Group>
            </div>
            <Box style={{ position: 'relative' }}>
              <IconClock size={40} style={{ color: '#7aa2f7' }} />
            </Box>
          </Group>
        </Card>
      </Grid.Col>
    </Grid>
  );
}
