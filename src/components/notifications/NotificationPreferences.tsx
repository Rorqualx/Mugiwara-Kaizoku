import React, { useState } from 'react';

import { Card, Stack, Title, Text, Switch, Group, Button, Divider, TextInput, Badge, Alert } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { IconBell, IconClock, IconMail, IconBrandDiscord, IconBrandTelegram, IconCheck, IconX, IconInfoCircle } from '@tabler/icons-react';

interface NotificationChannel {
    type: 'web' | 'email' | 'discord' | 'telegram';
    enabled: boolean;
    config?: Record<string, unknown>;
}
interface NotificationPreferencesData {
    channels: NotificationChannel[];
    newReleases: boolean;
    upcomingReleases: boolean;
    releaseDelays: boolean;
    patternChanges: boolean;
    systemNotifications: boolean;
    quietHours: {
        enabled: boolean;
        start: string;
        end: string;
    };
}
export function NotificationPreferences(): React.ReactElement {
    const [preferences, setPreferences] = useState<NotificationPreferencesData>({
        channels: [
            { type: 'web', enabled: true },
            { type: 'email', enabled: false },
            { type: 'discord', enabled: false },
            { type: 'telegram', enabled: false }
        ],
        newReleases: true,
        upcomingReleases: true,
        releaseDelays: true,
        patternChanges: true,
        systemNotifications: true,
        quietHours: {
            enabled: false,
            start: '22:00',
            end: '08:00'
        }
    });
    const [isSaving, setIsSaving] = useState(false);
    const handleChannelToggle = (channelType: string): void => {
        setPreferences((prev) => ({
            ...prev,
            channels: prev.channels.map((channel) => channel.type === channelType ?
                { ...channel, enabled: !channel.enabled } :
                channel)
        }));
    };
    const handleNotificationTypeToggle = (type: keyof NotificationPreferencesData): void => {
        if (typeof preferences[type] === 'boolean') {
            setPreferences((prev) => ({
                ...prev,
                [type]: !prev[type]
            }));
        }
    };
    const handleQuietHoursToggle = (): void => {
        setPreferences((prev) => ({
            ...prev,
            quietHours: {
                ...prev.quietHours,
                enabled: !prev.quietHours.enabled
            }
        }));
    };
    const handleQuietHoursTimeChange = (field: 'start' | 'end', value: string): void => {
        setPreferences((prev) => ({
            ...prev,
            quietHours: {
                ...prev.quietHours,
                [field]: value
            }
        }));
    };
    const handleSave = (): void => {
        setIsSaving(true);
        try {
            // TODO: Save preferences via tRPC
            // await trpc.notifications.updatePreferences.useMutation(preferences);
            showNotification({
                title: 'Preferences Saved',
                message: 'Your notification preferences have been updated',
                color: 'green',
                icon: <IconCheck />
            });
        }
        catch (_error: unknown) {
            showNotification({
                title: 'Error',
                message: 'Failed to save notification preferences',
                color: 'red',
                icon: <IconX />
            });
        }
        finally {
            setIsSaving(false);
        }
    };
    const getChannelIcon = (type: string): JSX.Element => {
        switch (type) {
            case 'web':
                return <IconBell size={20}/>;
            case 'email':
                return <IconMail size={20}/>;
            case 'discord':
                return <IconBrandDiscord size={20}/>;
            case 'telegram':
                return <IconBrandTelegram size={20}/>;
            default:
                return <IconBell size={20}/>;
        }
    };
    const getChannelBadge = (channel: NotificationChannel): JSX.Element | null => {
        if (!channel.enabled)
            return null;
        switch (channel.type) {
            case 'email':
                return channel.config?.["verified"] ?
                    <Badge color="green" size="sm">Verified</Badge> :
                    <Badge color="yellow" size="sm">Setup Required</Badge>;
            case 'discord':
            case 'telegram':
                return channel.config?.["connected"] ?
                    <Badge color="green" size="sm">Connected</Badge> :
                    <Badge color="yellow" size="sm">Setup Required</Badge>;
            default:
                return null;
        }
    };
    return (<Stack gap="md">
      <Title order={4}>Notification Preferences</Title>
      
      {/* Notification Channels */}
      <Card>
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={5}>Notification Channels</Title>
          </Group>
          
          {preferences.channels.map((channel) => <Group key={channel.type} justify="space-between">
              <Group>
                {getChannelIcon(channel.type)}
                <div>
                  <Text fw={500} tt="capitalize">{channel.type} Notifications</Text>
                  <Text size="sm" c="dimmed">
                    {channel.type === 'web' && 'In-app notifications'}
                    {channel.type === 'email' && 'Email alerts to your registered address'}
                    {channel.type === 'discord' && 'Notifications via Discord webhook'}
                    {channel.type === 'telegram' && 'Notifications via Telegram bot'}
                  </Text>
                </div>
              </Group>
              
              <Group>
                {getChannelBadge(channel)}
                <Switch checked={channel.enabled} onChange={() => handleChannelToggle(channel.type)} disabled={channel.type !== 'web'} // Only web notifications are implemented
        />
              </Group>
            </Group>)}
          
          <Alert icon={<IconInfoCircle />} color="blue" variant="light">
            Email, Discord, and Telegram notifications are coming soon!
          </Alert>
        </Stack>
      </Card>
      
      {/* Notification Types */}
      <Card>
        <Stack gap="md">
          <Title order={5}>Notification Types</Title>
          
          <Group justify="space-between">
            <div>
              <Text fw={500}>New Releases</Text>
              <Text size="sm" c="dimmed">
                Get notified when new chapters are released
              </Text>
            </div>
            <Switch checked={preferences.newReleases} onChange={() => handleNotificationTypeToggle('newReleases')}/>

          </Group>
          
          <Group justify="space-between">
            <div>
              <Text fw={500}>Upcoming Releases</Text>
              <Text size="sm" c="dimmed">
                Get reminded about chapters releasing tomorrow
              </Text>
            </div>
            <Switch checked={preferences.upcomingReleases} onChange={() => handleNotificationTypeToggle('upcomingReleases')}/>

          </Group>
          
          <Group justify="space-between">
            <div>
              <Text fw={500}>Release Delays</Text>
              <Text size="sm" c="dimmed">
                Get notified when expected releases are delayed
              </Text>
            </div>
            <Switch checked={preferences.releaseDelays} onChange={() => handleNotificationTypeToggle('releaseDelays')}/>

          </Group>
          
          <Group justify="space-between">
            <div>
              <Text fw={500}>Pattern Changes</Text>
              <Text size="sm" c="dimmed">
                Get notified when release patterns change
              </Text>
            </div>
            <Switch checked={preferences.patternChanges} onChange={() => handleNotificationTypeToggle('patternChanges')}/>

          </Group>
          
          <Divider />
          
          <Group justify="space-between">
            <div>
              <Text fw={500}>System Notifications</Text>
              <Text size="sm" c="dimmed">
                Important system updates and maintenance alerts
              </Text>
            </div>
            <Switch checked={preferences.systemNotifications} onChange={() => handleNotificationTypeToggle('systemNotifications')}/>

          </Group>
        </Stack>
      </Card>
      
      {/* Quiet Hours */}
      <Card>
        <Stack gap="md">
          <Group justify="space-between">
            <div>
              <Title order={5}>Quiet Hours</Title>
              <Text size="sm" c="dimmed">
                Pause non-urgent notifications during specified hours
              </Text>
            </div>
            <Switch checked={preferences.quietHours.enabled} onChange={handleQuietHoursToggle}/>

          </Group>
          
          {preferences.quietHours.enabled &&
            <Group>
              <TextInput label="Start Time" type="time" value={preferences.quietHours.start} onChange={(e) => handleQuietHoursTimeChange('start', e.target.value)} leftSection={<IconClock size={16}/>}/>

              <TextInput label="End Time" type="time" value={preferences.quietHours.end} onChange={(e) => handleQuietHoursTimeChange('end', e.target.value)} leftSection={<IconClock size={16}/>}/>

            </Group>}
        </Stack>
      </Card>
      
      {/* Save Button */}
      <Group justify="flex-end">
        <Button onClick={handleSave} loading={isSaving} leftSection={<IconCheck size={16}/>}>

          Save Preferences
        </Button>
      </Group>
    </Stack>);
}
