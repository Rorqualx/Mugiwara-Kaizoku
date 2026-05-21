/**
 * System Dashboard
 * 
 * Main entry point for system administration and monitoring.
 * Provides access to various system functions and status information.
 * 
 * Features:
 * - System status monitoring
 * - Configuration management
 * - Plugin management
 * - Logging and event monitoring
 * - User management
 * 
 * @module pages/system
 */

import React from 'react';

import { Container, Title, Text, Card, Grid, Group, Button } from '@mantine/core';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconRefresh } from '@tabler/icons-react';
import { IconFile } from '@tabler/icons-react';
import { IconSettings } from '@tabler/icons-react';
import { IconDownload } from '@tabler/icons-react';
import { IconDatabase } from '@tabler/icons-react';
import { IconClock } from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import { notify } from '@/utils/notify';
/**
 * System dashboard interface
 * 
 * @returns System dashboard component
 */
export default function SystemDashboard(): React.ReactElement {
  const _router = useRouter();

  const handleSectionClick = (path: string): void => {
    notify({ severity: 'INFO', title: 'System Navigation', message: `Navigation to ${path} is not implemented in this version` });
  };
  
  const sections = [
    { 
      icon: <IconSettings size={24} />, 
      title: 'Status', 
      description: 'System status and resource monitoring',
      path: '/system/status'
    },
    { 
      icon: <IconDownload size={24} />, 
      title: 'Backup', 
      description: 'Database and configuration backup',
      path: '/system/backup'
    },
    { 
      icon: <IconRefresh size={24} />, 
      title: 'Updates', 
      description: 'Software updates and version management',
      path: '/system/updates'
    },
    { 
      icon: <IconDatabase size={24} />, 
      title: 'Plugins', 
      description: 'Plugin management and configuration',
      path: '/system/plugins'
    },
    { 
      icon: <IconSettings size={24} />, 
      title: 'Appearance', 
      description: 'UI customization and themes',
      path: '/system/appearance'
    },
    { 
      icon: <IconClock size={24} />, 
      title: 'Events', 
      description: 'System event logs and notifications',
      path: '/system/events'
    },
    { 
      icon: <IconFile size={24} />, 
      title: 'Log Files', 
      description: 'View and manage application logs',
      path: '/system/logs'
    },
    { 
      icon: <IconSettings size={24} />, 
      title: 'Users', 
      description: 'User account management',
      path: '/system/users'
    }
  ];

  return (
    <ResponsiveMainLayout>
      <Container size="lg" py="md">
        <Title order={2} mb="lg">System Dashboard</Title>
        <Text mb="xl" color="dimmed">
          Manage system settings, monitor performance, and configure application behavior.
        </Text>
        
        <Grid gutter="md">
          {sections.map((section) => (
            <Grid.Col key={section.path} span={{ base: 12, sm: 6, md: 4 }}>
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="apart" mb="xs">
                  <Group>
                    {section.icon}
                    <Title order={4}>{section["title"]}</Title>
                  </Group>
                </Group>
                
                <Text size="sm" color="dimmed" mb="md">
                  {section["description"]}
                </Text>
                
                <Button 
                  variant="light" 
                  color="blue" 
                  fullWidth 
                  mt="md" 
                  radius="md"
                  onClick={() => handleSectionClick(section.path)}
                >
                  Access {section["title"]}
                </Button>
              </Card>
            </Grid.Col>
          ))}
        </Grid>
      </Container>
    </ResponsiveMainLayout>
  );
}