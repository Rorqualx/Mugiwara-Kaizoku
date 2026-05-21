/**
 * StatusContent component for system status dashboard
 * 
 * Displays comprehensive system information including:
 * - Resource usage statistics
 * - Integration status
 * - Database health
 * - Server information
 * - Active tasks
 */
import React from 'react';

import { Text, Card, Group, SimpleGrid, RingProgress, Badge, Title } from '@mantine/core';

/**
 * Status content component with system metrics and health information
 * 
 * @returns System status dashboard content
 */
export function StatusContent(): React.ReactElement {
  return (
    <>
      <Text mb="xl" color="dimmed">
        Monitor system health and resource utilization. This page provides an overview
        of all system components and their current status.
      </Text>
      
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="xl">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Title order={4}>CPU Usage</Title>
            <Badge color="green">Healthy</Badge>
          </Group>
          <Group justify="center">
            <RingProgress
              size={120}
              thickness={12}
              roundCaps
              sections={[{ value: 23, color: 'teal' }]}
              label={
                <Text ta="center" fw={700} size="xl">23%</Text>
              }
            />
          </Group>
        </Card>
        
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Title order={4}>Memory Usage</Title>
            <Badge color="green">Healthy</Badge>
          </Group>
          <Group justify="center">
            <RingProgress
              size={120}
              thickness={12}
              roundCaps
              sections={[{ value: 42, color: 'blue' }]}
              label={
                <Text ta="center" fw={700} size="xl">42%</Text>
              }
            />
          </Group>
        </Card>
        
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Title order={4}>Disk Usage</Title>
            <Badge color="yellow">Warning</Badge>
          </Group>
          <Group justify="center">
            <RingProgress
              size={120}
              thickness={12}
              roundCaps
              sections={[{ value: 78, color: 'orange' }]}
              label={
                <Text ta="center" fw={700} size="xl">78%</Text>
              }
            />
          </Group>
        </Card>
        
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Title order={4}>Network</Title>
            <Badge color="green">Healthy</Badge>
          </Group>
          <Group justify="center">
            <RingProgress
              size={120}
              thickness={12}
              roundCaps
              sections={[{ value: 12, color: 'cyan' }]}
              label={
                <Text ta="center" fw={700} size="xl">12%</Text>
              }
            />
          </Group>
        </Card>
      </SimpleGrid>
      
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={3} mb="md">Database Status</Title>
          <SimpleGrid cols={2}>
            <Group>
              <Text fw={700}>Status:</Text>
              <Badge color="green">Connected</Badge>
            </Group>
            <Group>
              <Text fw={700}>Migrations:</Text>
              <Badge color="green">Up to date</Badge>
            </Group>
            <Group>
              <Text fw={700}>Version:</Text>
              <Text>PostgreSQL 15.4</Text>
            </Group>
            <Group>
              <Text fw={700}>Tables:</Text>
              <Text>27</Text>
            </Group>
            <Group>
              <Text fw={700}>Size:</Text>
              <Text>128 MB</Text>
            </Group>
            <Group>
              <Text fw={700}>Connections:</Text>
              <Text>5 active</Text>
            </Group>
          </SimpleGrid>
        </Card>
        
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={3} mb="md">Integration Status</Title>
          <SimpleGrid cols={2}>
            <Group>
              <Text fw={700}>Wikipedia:</Text>
              <Badge color="green">Connected</Badge>
            </Group>
            <Group>
              <Text fw={700}>AniList:</Text>
              <Badge color="green">Connected</Badge>
            </Group>
            <Group>
              <Text fw={700}>Fandom:</Text>
              <Badge color="green">Connected</Badge>
            </Group>
            <Group>
              <Text fw={700}>ComicVine:</Text>
              <Badge color="gray">Disabled</Badge>
            </Group>
            <Group>
              <Text fw={700}>Transmission:</Text>
              <Badge color="red">Disconnected</Badge>
            </Group>
            <Group>
              <Text fw={700}>NZBGet:</Text>
              <Badge color="gray">Disabled</Badge>
            </Group>
          </SimpleGrid>
        </Card>
        
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={3} mb="md">Server Information</Title>
          <SimpleGrid cols={2}>
            <Group>
              <Text fw={700}>Version:</Text>
              <Text>1.6.1</Text>
            </Group>
            <Group>
              <Text fw={700}>Platform:</Text>
              <Text>Node.js 20.10.0</Text>
            </Group>
            <Group>
              <Text fw={700}>Uptime:</Text>
              <Text>3 days, 5 hours</Text>
            </Group>
            <Group>
              <Text fw={700}>Environment:</Text>
              <Badge color="blue">Development</Badge>
            </Group>
            <Group>
              <Text fw={700}>Docker:</Text>
              <Badge color="green">Enabled</Badge>
            </Group>
            <Group>
              <Text fw={700}>Updates:</Text>
              <Badge color="green">Up to date</Badge>
            </Group>
          </SimpleGrid>
        </Card>
        
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={3} mb="md">Task Status</Title>
          <SimpleGrid cols={2}>
            <Group>
              <Text fw={700}>Active:</Text>
              <Text>2</Text>
            </Group>
            <Group>
              <Text fw={700}>Queued:</Text>
              <Text>5</Text>
            </Group>
            <Group>
              <Text fw={700}>Failed:</Text>
              <Badge color="red">3</Badge>
            </Group>
            <Group>
              <Text fw={700}>Completed:</Text>
              <Text>142</Text>
            </Group>
            <Group>
              <Text fw={700}>Scheduled:</Text>
              <Text>8</Text>
            </Group>
            <Group>
              <Text fw={700}>Out of Sync:</Text>
              <Badge color="orange">12</Badge>
            </Group>
          </SimpleGrid>
        </Card>
      </SimpleGrid>
    </>
  );
}

export default StatusContent;