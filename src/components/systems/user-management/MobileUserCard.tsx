import React from 'react';

import {
  Card,
  Group,
  Avatar,
  Box,
  Text,
  Badge,
  Menu,
  ActionIcon
} from '@mantine/core';
import { UserRole } from '@prisma/client';
import {
  IconUser,
  IconMail,
  IconClock,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconShield,
  IconHistory
} from '@tabler/icons-react';

import { formatDate } from '@/utils/formatters/date-formatter';

import type { User } from '../responsive-user-list/types';

interface MobileUserCardProps {
  user: User;
  onEdit: () => void;
  onDelete: () => void;
  onViewActivity: () => void;
  isCurrentUser: boolean;
}

const getRoleBadgeColor = (role: UserRole): string => {
  return role === UserRole.ADMIN ? 'red' : 'blue';
};

/**
 * Mobile user card component
 */
export function MobileUserCard({
  user,
  onEdit,
  onDelete,
  onViewActivity,
  isCurrentUser
}: MobileUserCardProps): React.ReactElement {
  return (
    <Card shadow="sm" p="md" radius="md" withBorder>
      <Group justify="space-between" wrap="nowrap">
        <Group wrap="nowrap">
          <Avatar
            src={user.avatarUrl}
            alt={user.username}
            radius="xl"
            size="md">

            <IconUser size={24} />
          </Avatar>
          <Box style={{ flex: 1 }}>
            <Group gap="xs" align="center">
              <Text fw={500} size="sm">{user.username}</Text>
              <Badge
                size="xs"
                color={getRoleBadgeColor(user.role)}
                leftSection={user.role === UserRole.ADMIN && <IconShield size={10} />}>

                {user.role}
              </Badge>
            </Group>
            <Group gap={4}>
              <IconMail size={14} />
              <Text size="xs" c="dimmed">{user.email}</Text>
            </Group>
            <Group gap={4}>
              <IconClock size={14} />
              <Text size="xs" c="dimmed">
                Last login: {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
              </Text>
            </Group>
          </Box>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            size="lg"
            color="gray"
            onClick={() => { void onViewActivity(); }}
            aria-label="View activity">
            <IconHistory size={20} />
          </ActionIcon>
          {!isCurrentUser &&
          <Menu position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="subtle" size="lg">
                  <IconDotsVertical size={20} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                leftSection={<IconEdit size={16} />}
                onClick={() => { void onEdit(); }}>

                  Change Role
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                leftSection={<IconTrash size={16} />}
                color="red"
                onClick={() => { void onDelete(); }}>

                  Delete User
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          }
        </Group>
      </Group>
    </Card>);

}
