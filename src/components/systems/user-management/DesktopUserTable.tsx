import React from 'react';

import {
  Table,
  Group,
  Avatar,
  Text,
  Badge,
  ActionIcon
} from '@mantine/core';
import { UserRole } from '@prisma/client';
import {
  IconUser,
  IconShield,
  IconEdit,
  IconTrash,
  IconHistory
} from '@tabler/icons-react';

import { formatDate } from '@/utils/formatters/date-formatter';

import type { User } from '../responsive-user-list/types';

interface DesktopUserTableProps {
  users: User[];
  onEditRole: (user: User) => void;
  onDelete: (user: User) => void;
  onViewActivity: (user: User) => void;
  currentUserId?: string | undefined;
}

const getRoleBadgeColor = (role: UserRole): string => {
  return role === UserRole.ADMIN ? 'red' : 'blue';
};

/**
 * Desktop user table component
 */
export function DesktopUserTable({
  users,
  onEditRole,
  onDelete,
  onViewActivity,
  currentUserId

}: DesktopUserTableProps): React.ReactElement {
  return (
    <Table highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>User</Table.Th>
          <Table.Th>Email</Table.Th>
          <Table.Th>Role</Table.Th>
          <Table.Th>Last Login</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {users.map((user) =>
        <Table.Tr key={user["id"]}>
            <Table.Td>
              <Group gap="sm">
                <Avatar
                src={user.avatarUrl}
                alt={user.username}
                radius="xl"
                size="sm">

                  <IconUser size={16} />
                </Avatar>
                <Text size="sm" fw={500}>{user.username}</Text>
              </Group>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{user.email}</Text>
            </Table.Td>
            <Table.Td>
              <Badge
              color={getRoleBadgeColor(user.role)}
              leftSection={user.role === UserRole.ADMIN && <IconShield size={12} />}>

                {user.role}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Text size="sm">
                {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
              </Text>
            </Table.Td>
            <Table.Td>
              <Group gap="xs">
                <ActionIcon
                  variant="light"
                  color="gray"
                  onClick={() => onViewActivity(user)}
                  aria-label="View activity">

                  <IconHistory size={16} />
                </ActionIcon>
                {currentUserId !== user["id"] &&
                <>
                    <ActionIcon
                  variant="light"
                  color="blue"
                  onClick={() => onEditRole(user)}
                  aria-label="Edit role">

                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                  variant="light"
                  color="red"
                  onClick={() => onDelete(user)}
                  aria-label="Delete user">

                      <IconTrash size={16} />
                    </ActionIcon>
                  </>
                }
              </Group>
            </Table.Td>
          </Table.Tr>
        )}
      </Table.Tbody>
    </Table>);

}
