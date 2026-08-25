import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NativeSelect,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconMailPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { tenantApi } from '../api/endpoints';
import type { AssignableRole, Member } from '../api/types';
import { useTenant } from '../app/AppShell';
import { useAuth } from '../auth/AuthProvider';
import { errorMessage } from '../shared/errors';
import { formatDate } from '../shared/format';
import { EmptyState, ErrorState, LoadingState } from '../shared/PageStates';
import { PageHeader } from '../shared/PageHeader';

export function TeamPage() {
  const tenant = useTenant();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const members = useQuery({
    queryKey: ['members', tenant.organization.id],
    queryFn: () => tenantApi.members(tenant.organization.id),
  });
  const canInvite = tenant.organization.allowed_actions.includes('members:invite');
  const canManage = tenant.organization.allowed_actions.includes('members:manage');
  const update = useMutation({
    mutationFn: ({
      userId,
      role,
      notificationsEnabled,
    }: {
      userId: string;
      role?: AssignableRole;
      notificationsEnabled?: boolean;
    }) =>
      tenantApi.updateMember(tenant.organization.id, userId, {
        ...(role ? { role } : {}),
        ...(notificationsEnabled !== undefined
          ? { incident_notifications_enabled: notificationsEnabled }
          : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members', tenant.organization.id] });
      notifications.show({ color: 'teal', message: 'Member preferences updated.' });
    },
    onError: (caught) => notifications.show({ color: 'red', message: errorMessage(caught) }),
  });
  if (members.isPending) return <LoadingState label="Loading organization members…" />;
  if (members.isError)
    return <ErrorState error={members.error} retry={() => void members.refetch()} />;
  return (
    <div>
      <PageHeader
        eyebrow={`${tenant.organization.name.toUpperCase()} · ${tenant.organization.role.toUpperCase()}`}
        title="Team & alerts"
        description="Roles are read from the backend on every operation. UI controls explain access but never replace server authorization."
      />
      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
        <Card withBorder radius="lg" p={0} style={{ gridColumn: 'span 2' }} className="table-card">
          <Group p="lg" justify="space-between">
            <Title order={3}>Members</Title>
            <Badge variant="light">{members.data.members.length} members</Badge>
          </Group>
          {members.data.members.length ? (
            <Table.ScrollContainer minWidth={660}>
              <Table verticalSpacing="md" horizontalSpacing="lg">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Member</Table.Th>
                    <Table.Th>Role</Table.Th>
                    <Table.Th>Incident email</Table.Th>
                    <Table.Th>Joined</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {members.data.members.map((member) => (
                    <MemberRow
                      key={member.user_id}
                      member={member}
                      currentUser={member.user_id === auth.user?.id}
                      canManage={canManage}
                      update={(role, notificationsEnabled) =>
                        update.mutate({ userId: member.user_id, role, notificationsEnabled })
                      }
                    />
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          ) : (
            <EmptyState
              title="No members"
              description="Membership may have changed. Reload or return to another organization."
            />
          )}
        </Card>
        <Stack>
          {canInvite ? (
            <InviteCard />
          ) : (
            <Alert color="gray" title="Read-only team access">
              Your {tenant.organization.role} role can view members but cannot send invitations or
              change other roles.
            </Alert>
          )}
          <Card withBorder radius="lg" p="lg">
            <Title order={4}>Notification meaning</Title>
            <Text size="sm" c="dimmed" mt="sm">
              Only verified current members who enable incident email are snapshotted as recipients.
              “Accepted” means accepted by the mail provider, not delivered to the inbox.
            </Text>
          </Card>
        </Stack>
      </SimpleGrid>
    </div>
  );
}

function MemberRow({
  member,
  currentUser,
  canManage,
  update,
}: {
  member: Member;
  currentUser: boolean;
  canManage: boolean;
  update: (role?: AssignableRole, notificationsEnabled?: boolean) => void;
}) {
  const tenant = useTenant();
  const queryClient = useQueryClient();
  const [opened, modal] = useDisclosure(false);
  const remove = useMutation({
    mutationFn: () => tenantApi.removeMember(tenant.organization.id, member.user_id),
    onSuccess: () => {
      modal.close();
      void queryClient.invalidateQueries({ queryKey: ['members', tenant.organization.id] });
      notifications.show({ color: 'teal', message: 'Member removed.' });
    },
    onError: (caught) => notifications.show({ color: 'red', message: errorMessage(caught) }),
  });
  return (
    <>
      <Table.Tr>
        <Table.Td>
          <Text fw={600}>{member.email}</Text>
          {currentUser && (
            <Text size="xs" c="dimmed">
              You
            </Text>
          )}
        </Table.Td>
        <Table.Td>
          {canManage && member.role !== 'owner' && !currentUser ? (
            <NativeSelect
              aria-label={`Role for ${member.email}`}
              value={member.role}
              data={['admin', 'member', 'viewer']}
              onChange={(event) => update(event.currentTarget.value as AssignableRole)}
            />
          ) : (
            <Badge color="gray" variant="light">
              {member.role}
            </Badge>
          )}
        </Table.Td>
        <Table.Td>
          <Switch
            aria-label={`Incident notifications for ${member.email}`}
            checked={member.incident_notifications_enabled}
            disabled={!currentUser}
            onChange={(event) => update(undefined, event.currentTarget.checked)}
          />
        </Table.Td>
        <Table.Td>{formatDate(member.created_at)}</Table.Td>
        <Table.Td>
          {canManage && !currentUser && member.role !== 'owner' && (
            <ActionIcon
              color="red"
              variant="subtle"
              aria-label={`Remove ${member.email}`}
              onClick={modal.open}
            >
              <IconTrash size={16} />
            </ActionIcon>
          )}
        </Table.Td>
      </Table.Tr>
      <Modal opened={opened} onClose={modal.close} title="Remove member?" centered>
        <Text size="sm">
          {member.email} will immediately lose access to this organization. Their historical actions
          remain recorded.
        </Text>
        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={modal.close}>
            Cancel
          </Button>
          <Button color="red" loading={remove.isPending} onClick={() => remove.mutate()}>
            Remove member
          </Button>
        </Group>
      </Modal>
    </>
  );
}

function InviteCard() {
  const tenant = useTenant();
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    initialValues: { email: '', role: 'member' },
    validate: { email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : 'Enter a valid email') },
  });
  return (
    <Card withBorder radius="lg" p="lg">
      <Group>
        <IconMailPlus size={20} />
        <Title order={4}>Invite a teammate</Title>
      </Group>
      <form
        onSubmit={form.onSubmit(async (values) => {
          setError(null);
          try {
            const result = await tenantApi.invite(
              tenant.organization.id,
              values.email.trim(),
              values.role,
            );
            setSent(result.email);
            form.reset();
          } catch (caught) {
            setError(errorMessage(caught));
          }
        })}
      >
        <Stack mt="md">
          {sent && <Alert color="teal">Invitation sent to {sent}. It expires in seven days.</Alert>}
          {error && <Alert color="red">{error}</Alert>}
          <TextInput label="Email" type="email" required {...form.getInputProps('email')} />
          <NativeSelect
            label="Role"
            data={[
              { value: 'admin', label: 'Admin' },
              { value: 'member', label: 'Member' },
              { value: 'viewer', label: 'Viewer' },
            ]}
            {...form.getInputProps('role')}
          />
          <Button type="submit" loading={form.submitting}>
            Send invitation
          </Button>
        </Stack>
      </form>
    </Card>
  );
}
