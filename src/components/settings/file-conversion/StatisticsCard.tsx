import React from 'react';

import { Card, Progress, SimpleGrid, Text, Title } from '@mantine/core';

interface StatsData {
  factory?: { totalConverters?: number; supportedConversions?: number };
  service?: { completed: number; failed: number };
}

export function StatisticsCard({ statsData }: { statsData: StatsData }): React.ReactElement {
  const completed = statsData.service?.completed ?? 0;
  const failed = statsData.service?.failed ?? 0;
  const showRate = completed > 0 || failed > 0;

  return (
    <Card shadow="sm" p="lg" radius="md">
      <Title order={4} mb="md">Conversion Statistics</Title>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
        <div>
          <Text size="xs" c="dimmed" mb={4}>Total Converters</Text>
          <Text size="xl" fw={700}>{statsData.factory?.totalConverters ?? 0}</Text>
        </div>
        <div>
          <Text size="xs" c="dimmed" mb={4}>Supported Conversions</Text>
          <Text size="xl" fw={700}>{statsData.factory?.supportedConversions ?? 0}</Text>
        </div>
        <div>
          <Text size="xs" c="dimmed" mb={4}>Jobs Completed</Text>
          <Text size="xl" fw={700} c="green">{completed}</Text>
        </div>
        <div>
          <Text size="xs" c="dimmed" mb={4}>Jobs Failed</Text>
          <Text size="xl" fw={700} c="red">{failed}</Text>
        </div>
      </SimpleGrid>
      {showRate && (
        <div style={{ marginTop: '1rem' }}>
          <Text size="xs" c="dimmed" mb={4}>Success Rate</Text>
          <Progress
            value={(completed / (completed + failed)) * 100}
            color="green"
            size="lg"
            radius="xl"
          />
        </div>
      )}
    </Card>
  );
}
