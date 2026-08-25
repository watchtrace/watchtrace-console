import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  ThemeIcon,
  Timeline,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  IconBell,
  IconBellCheck,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconExclamationCircle,
  IconMessageCheck,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { monitoringApi } from '../api/endpoints';
import type { Incident, IncidentSummary } from '../api/types';
import { useTenant } from '../app/AppShell';
import { errorMessage } from '../shared/errors';
import { formatDate, timeRange } from '../shared/format';
import { EmptyState, ErrorState, LoadingState } from '../shared/PageStates';
import { PageHeader } from '../shared/PageHeader';

export function IncidentListPage() {
  const tenant = useTenant();
  const [status, setStatus] = useState<'all' | 'open' | 'resolved'>('all');
  const range = useMemo(() => timeRange('30d'), []);
  const incidents = useQuery({
    queryKey: ['incidents', tenant.environment.id, status],
    queryFn: () =>
      monitoringApi.incidents(tenant.environment.id, range, status === 'all' ? undefined : status),
  });
  const base = `/app/${tenant.organization.id}/${tenant.project.id}/${tenant.environment.id}`;
  return (
    <div>
      <PageHeader
        eyebrow={`${tenant.environment.name.toUpperCase()} · LAST 30 DAYS`}
        title="Incidents"
        description="Three consecutive failures open an incident. Two consecutive successes recover it. Unknown checks pause evaluation."
        actions={
          <SegmentedControl
            value={status}
            onChange={(value) => setStatus(value)}
            data={[
              { value: 'all', label: 'All' },
              { value: 'open', label: 'Open' },
              { value: 'resolved', label: 'Resolved' },
            ]}
            aria-label="Incident status filter"
          />
        }
      />
      {incidents.isPending ? (
        <LoadingState label="Loading incidents…" />
      ) : incidents.isError ? (
        <ErrorState error={incidents.error} retry={() => void incidents.refetch()} />
      ) : !incidents.data.items.length ? (
        <EmptyState
          title={status === 'all' ? 'No incidents yet' : `No ${status} incidents`}
          description="Incidents appear only after the configured consecutive-failure threshold is observed."
        />
      ) : (
        <Card withBorder radius="lg" p={0} className="table-card">
          <Table.ScrollContainer minWidth={720}>
            <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Started</Table.Th>
                  <Table.Th>Monitor</Table.Th>
                  <Table.Th>Acknowledged</Table.Th>
                  <Table.Th>Resolution</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {incidents.data.items.map((incident) => (
                  <IncidentRow key={incident.id} incident={incident} base={base} />
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
    </div>
  );
}

function IncidentRow({ incident, base }: { incident: Incident; base: string }) {
  return (
    <Table.Tr>
      <Table.Td>
        <Badge color={incident.status === 'open' ? 'red' : 'teal'} variant="light">
          {incident.status}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Anchor component={Link} to={`${base}/incidents/${incident.id}`} fw={600}>
          {formatDate(incident.started_at)}
        </Anchor>
        <Text size="xs" c="dimmed">
          Opened {formatDate(incident.opened_at)}
        </Text>
      </Table.Td>
      <Table.Td>
        <Anchor component={Link} to={`${base}/monitors/${incident.monitor_id}`}>
          View monitor
        </Anchor>
      </Table.Td>
      <Table.Td>
        {incident.acknowledged_at ? formatDate(incident.acknowledged_at) : 'Not yet'}
      </Table.Td>
      <Table.Td>
        {incident.resolution_kind ? incident.resolution_kind.replaceAll('_', ' ') : '—'}
      </Table.Td>
    </Table.Tr>
  );
}

export function IncidentDetailPage() {
  const { incidentId } = useParams();
  const tenant = useTenant();
  const queryClient = useQueryClient();
  const incident = useQuery({
    queryKey: ['incident', tenant.environment.id, incidentId],
    queryFn: () => monitoringApi.incident(tenant.environment.id, incidentId!),
  });
  const [action, setAction] = useState<'acknowledge' | 'resolve'>('acknowledge');
  const [reason, setReason] = useState('');
  const [opened, modal] = useDisclosure(false);
  const mutation = useMutation({
    mutationFn: () => monitoringApi[action](tenant.environment.id, incidentId!, reason.trim()),
    onSuccess: () => {
      modal.close();
      setReason('');
      void queryClient.invalidateQueries({
        queryKey: ['incident', tenant.environment.id, incidentId],
      });
      void queryClient.invalidateQueries({ queryKey: ['incidents', tenant.environment.id] });
      notifications.show({
        color: 'teal',
        message:
          action === 'acknowledge'
            ? 'Incident acknowledged. It remains open.'
            : 'Incident manually resolved.',
      });
    },
    onError: (caught) => notifications.show({ color: 'red', message: errorMessage(caught) }),
  });
  if (incident.isPending) return <LoadingState label="Loading incident timeline…" />;
  if (incident.isError)
    return <ErrorState error={incident.error} retry={() => void incident.refetch()} />;
  const data = incident.data;
  const item = data.incident;
  return (
    <div>
      <PageHeader
        eyebrow={`INCIDENT · ${item.status.toUpperCase()}`}
        title={`Incident from ${formatDate(item.started_at)}`}
        description={`Monitor ${item.monitor_id}`}
        actions={
          tenant.canManageIncidents && item.status === 'open' ? (
            <Group>
              {!item.acknowledged_at && (
                <Button
                  variant="light"
                  leftSection={<IconMessageCheck size={16} />}
                  onClick={() => {
                    setAction('acknowledge');
                    modal.open();
                  }}
                >
                  Acknowledge
                </Button>
              )}
              <Button
                color="teal"
                leftSection={<IconCircleCheck size={16} />}
                onClick={() => {
                  setAction('resolve');
                  modal.open();
                }}
              >
                Resolve manually
              </Button>
            </Group>
          ) : undefined
        }
      />
      {item.status === 'open' && item.acknowledged_at && (
        <Alert color="blue" mb="lg" icon={<IconBellCheck />} title="Acknowledged, still open">
          Acknowledgement records ownership; it does not resolve the incident or stop monitoring.
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
        <Card withBorder radius="lg" p="xl" style={{ gridColumn: 'span 2' }}>
          <Title order={3}>Timeline</Title>
          <Timeline mt="xl" active={data.events.length} bulletSize={30} lineWidth={2}>
            {data.events.map((event) => (
              <Timeline.Item
                key={event.id}
                bullet={<TimelineIcon type={event.type} />}
                title={humanize(event.type)}
              >
                <Text c="dimmed" size="sm">
                  {event.reason || timelineDescription(event.type)}
                </Text>
                <Text size="xs" mt={4}>
                  {formatDate(event.occurred_at)}
                </Text>
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
        <Stack>
          <Card withBorder radius="lg" p="lg">
            <Text className="eyebrow">INCIDENT STATE</Text>
            <Stack gap="sm" mt="md">
              <Fact label="Status" value={item.status} />
              <Fact label="Opened" value={formatDate(item.opened_at)} />
              <Fact label="Acknowledged" value={formatDate(item.acknowledged_at)} />
              <Fact label="Resolved" value={formatDate(item.resolved_at)} />
              <Fact label="Resolution" value={item.resolution_kind?.replaceAll('_', ' ') ?? '—'} />
            </Stack>
          </Card>
          <DeliveryCard summary={data} />
        </Stack>
      </SimpleGrid>
      <Modal
        opened={opened}
        onClose={modal.close}
        title={action === 'acknowledge' ? 'Acknowledge incident' : 'Resolve incident manually'}
        centered
      >
        <Text size="sm" c="dimmed">
          {action === 'acknowledge'
            ? 'This records that you are handling the incident. It remains open.'
            : 'Manual resolution does not pause the monitor; a later failure can open another incident.'}
        </Text>
        <Textarea
          mt="md"
          label="Reason"
          description="Optional, up to 500 characters"
          maxLength={500}
          minRows={3}
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
        />
        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={modal.close}>
            Cancel
          </Button>
          <Button
            color={action === 'resolve' ? 'teal' : 'blue'}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {action === 'acknowledge' ? 'Acknowledge' : 'Resolve incident'}
          </Button>
        </Group>
      </Modal>
    </div>
  );
}

function DeliveryCard({ summary }: { summary: IncidentSummary }) {
  return (
    <Card withBorder radius="lg" p="lg">
      <Group>
        <ThemeIcon color="violet" variant="light" radius="xl">
          <IconBell size={16} />
        </ThemeIcon>
        <Title order={4}>Notifications</Title>
      </Group>
      <Divider my="md" />
      {summary.deliveries.length ? (
        <Stack gap="sm">
          {summary.deliveries.map((delivery) => (
            <Group key={delivery.id} justify="space-between">
              <div>
                <Text size="sm" fw={600}>
                  {humanize(delivery.transition)}
                </Text>
                <Text size="xs" c="dimmed">
                  {delivery.attempts} attempt{delivery.attempts === 1 ? '' : 's'}
                </Text>
              </div>
              <Badge
                color={
                  delivery.state === 'accepted'
                    ? 'teal'
                    : delivery.state === 'failed'
                      ? 'red'
                      : 'yellow'
                }
                variant="light"
              >
                {delivery.state === 'accepted' ? 'Provider accepted' : delivery.state}
              </Badge>
            </Group>
          ))}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          No eligible verified recipients had incident notifications enabled for these transitions.
        </Text>
      )}
      <Text size="xs" c="dimmed" mt="md">
        “Provider accepted” does not guarantee inbox delivery.
      </Text>
    </Card>
  );
}

function TimelineIcon({ type }: { type: string }) {
  if (type.includes('resolved') || type.includes('recovered')) return <IconCheck size={15} />;
  if (type.includes('acknowledged')) return <IconMessageCheck size={15} />;
  if (type.includes('open')) return <IconExclamationCircle size={15} />;
  return <IconClock size={15} />;
}
function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}
function timelineDescription(type: string) {
  if (type.includes('open')) return 'The consecutive-failure threshold was reached.';
  if (type.includes('recover')) return 'The consecutive-success threshold was reached.';
  return 'Incident state changed.';
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" align="flex-start">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600} ta="right" maw="60%">
        {value}
      </Text>
    </Group>
  );
}
