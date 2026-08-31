import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Menu,
  Modal,
  NativeSelect,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  IconDots,
  IconEdit,
  IconExternalLink,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconTestPipe,
  IconTrash,
} from '@tabler/icons-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { monitorApi } from '../api/endpoints';
import type { Monitor, MonitorMutation } from '../api/types';
import { useTenant } from '../app/AppShell';
import { errorMessage } from '../shared/errors';
import {
  durationFromMicroseconds,
  formatDate,
  formatLatency,
  formatPercent,
  timeRange,
} from '../shared/format';
import { EmptyState, ErrorState, LoadingState } from '../shared/PageStates';
import { PageHeader } from '../shared/PageHeader';
import { StatusBadge } from '../shared/status';
import { LatencyChart } from './LatencyChart';

export function MonitorListPage() {
  const { environment, canManageMonitors } = useTenant();
  const monitors = useQuery({
    queryKey: ['monitors', environment.id],
    queryFn: () => monitorApi.list(environment.id),
  });
  const base = `/app/${environment.organization_id}/${environment.project_id}/${environment.id}`;
  if (monitors.isPending) return <LoadingState label="Loading monitors…" />;
  if (monitors.isError)
    return <ErrorState error={monitors.error} retry={() => void monitors.refetch()} />;
  return (
    <div>
      <PageHeader
        eyebrow={`${environment.name.toUpperCase()} · ${monitors.data.monitors.length}/100 MONITORS`}
        title="Monitors"
        description="Scheduled GET and HEAD checks from your assigned worker pool. One-minute polling is not instant detection."
        actions={
          canManageMonitors && (
            <Button
              component={Link}
              to={`${base}/monitors/new`}
              leftSection={<IconPlus size={16} />}
            >
              New monitor
            </Button>
          )
        }
      />
      {!monitors.data.monitors.length ? (
        <EmptyState
          title="No monitors yet"
          description={
            canManageMonitors
              ? 'Add a public HTTP or HTTPS endpoint to begin collecting scheduled results.'
              : 'A member with monitor management access can create the first monitor.'
          }
          action={
            canManageMonitors && (
              <Button component={Link} to={`${base}/monitors/new`}>
                Create your first monitor
              </Button>
            )
          }
        />
      ) : (
        <Card withBorder radius="lg" p={0} className="table-card">
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Monitor</Table.Th>
                  <Table.Th>Schedule</Table.Th>
                  <Table.Th>Method</Table.Th>
                  <Table.Th>Version</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th aria-label="Actions" />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {monitors.data.monitors.map((monitor) => (
                  <Table.Tr key={monitor.id}>
                    <Table.Td>
                      <Anchor component={Link} to={`${base}/monitors/${monitor.id}`} fw={650}>
                        {monitor.name}
                      </Anchor>
                      <Text size="xs" c="dimmed" maw={360} truncate>
                        {monitor.url}
                      </Text>
                    </Table.Td>
                    <Table.Td>{intervalLabel(monitor.interval_seconds)}</Table.Td>
                    <Table.Td>
                      <Badge color="gray" variant="light">
                        {monitor.method}
                      </Badge>
                    </Table.Td>
                    <Table.Td>v{monitor.version}</Table.Td>
                    <Table.Td>
                      <Badge color={monitor.paused ? 'gray' : 'teal'} variant="dot">
                        {monitor.paused ? 'Paused' : 'Active'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{canManageMonitors && <MonitorMenu monitor={monitor} />}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
    </div>
  );
}

function MonitorMenu({ monitor }: { monitor: Monitor }) {
  const tenant = useTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [deleteOpened, deleteHandlers] = useDisclosure(false);
  const base = `/app/${tenant.organization.id}/${tenant.project.id}/${tenant.environment.id}`;
  const mutate = useMutation({
    mutationFn: async (action: 'pause' | 'resume' | 'test' | 'delete') => {
      if (action === 'delete') return monitorApi.remove(tenant.environment.id, monitor.id);
      if (action === 'test') return monitorApi.test(tenant.environment.id, monitor.id);
      return monitorApi[action](tenant.environment.id, monitor.id);
    },
    onSuccess: (_, action) => {
      void queryClient.invalidateQueries({ queryKey: ['monitors', tenant.environment.id] });
      notifications.show({
        color: 'teal',
        message:
          action === 'test'
            ? 'Manual check queued. It does not affect uptime.'
            : `Monitor ${action}d.`,
      });
      if (action === 'delete') void navigate(`${base}/monitors`);
    },
    onError: (error) =>
      notifications.show({ color: 'red', title: 'Action failed', message: errorMessage(error) }),
  });
  return (
    <>
      <Menu position="bottom-end">
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${monitor.name}`}>
            <IconDots size={18} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            component={Link}
            to={`${base}/monitors/${monitor.id}/edit`}
            leftSection={<IconEdit size={15} />}
          >
            Edit
          </Menu.Item>
          <Menu.Item leftSection={<IconTestPipe size={15} />} onClick={() => mutate.mutate('test')}>
            Run manual test
          </Menu.Item>
          <Menu.Item
            leftSection={
              monitor.paused ? <IconPlayerPlay size={15} /> : <IconPlayerPause size={15} />
            }
            onClick={() => mutate.mutate(monitor.paused ? 'resume' : 'pause')}
          >
            {monitor.paused ? 'Resume' : 'Pause'}
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            color="red"
            leftSection={<IconTrash size={15} />}
            onClick={deleteHandlers.open}
          >
            Delete
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Modal opened={deleteOpened} onClose={deleteHandlers.close} title="Delete monitor?" centered>
        <Text size="sm">
          This soft-deletes <strong>{monitor.name}</strong> and stops future scheduling. Already
          published jobs may still run within their bounded expiry.
        </Text>
        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={deleteHandlers.close}>
            Cancel
          </Button>
          <Button color="red" loading={mutate.isPending} onClick={() => mutate.mutate('delete')}>
            Delete monitor
          </Button>
        </Group>
      </Modal>
    </>
  );
}

export function MonitorFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { monitorId } = useParams();
  const tenant = useTenant();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const existing = useQuery({
    queryKey: ['monitor', tenant.environment.id, monitorId],
    queryFn: () => monitorApi.detail(tenant.environment.id, monitorId!),
    enabled: mode === 'edit' && Boolean(monitorId),
  });
  if (mode === 'edit' && existing.isPending)
    return <LoadingState label="Loading monitor configuration…" />;
  if (existing.isError) return <ErrorState error={existing.error} />;
  return (
    <MonitorForm
      key={existing.data?.version ?? 'new'}
      existing={existing.data}
      onSaved={(id) => {
        void queryClient.invalidateQueries({ queryKey: ['monitors', tenant.environment.id] });
        queryClient.removeQueries({ queryKey: ['monitor', tenant.environment.id, id] });
        void navigate(
          `/app/${tenant.organization.id}/${tenant.project.id}/${tenant.environment.id}/monitors/${id}`,
        );
      }}
    />
  );
}

function MonitorForm({ existing, onSaved }: { existing?: Monitor; onSaved: (id: string) => void }) {
  const { environment, canManageMonitors } = useTenant();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    initialValues: {
      name: existing?.name ?? '',
      url: existing?.url ?? '',
      method: existing?.method ?? 'GET',
      interval: String(existing?.interval_seconds ?? 300),
      timeout: existing?.timeout_seconds ?? 5,
      statusMin: existing?.expected_status_min ?? 200,
      statusMax: existing?.expected_status_max ?? 299,
      workerPool: existing?.worker_pool_id ?? 'hosted',
      headers: '',
    },
    validate: {
      name: (value) => (value.trim() ? null : 'Name is required'),
      url: (value) =>
        /^https?:\/\//i.test(value.trim()) ? null : 'Enter an absolute HTTP or HTTPS URL',
      statusMax: (value, values) =>
        value < values.statusMin ? 'Maximum must be at least the minimum' : null,
    },
  });
  if (!canManageMonitors)
    return (
      <Alert color="yellow">
        Your {environment.role} role can view monitors but cannot change them.
      </Alert>
    );
  return (
    <div>
      <PageHeader
        eyebrow={existing ? `VERSION ${existing.version}` : 'NEW MONITOR'}
        title={existing ? `Edit ${existing.name}` : 'Create a monitor'}
        description="WatchTrace validates the destination, every redirect, and the actual connection address on the server."
      />
      <Card withBorder radius="lg" p="xl" maw={900}>
        {error && (
          <Alert color="red" mb="lg">
            {error}
          </Alert>
        )}
        {existing?.header_names.length ? (
          <Alert color="yellow" mb="lg" title="Re-enter secret headers">
            This monitor currently has: {existing.header_names.join(', ')}. Updating replaces the
            complete header set; enter every header to keep it.
          </Alert>
        ) : null}
        <form
          onSubmit={form.onSubmit(async (values) => {
            setError(null);
            let headers: Record<string, string>;
            try {
              headers = parseHeaders(values.headers);
            } catch (caught) {
              setError(String(caught));
              return;
            }
            const body: MonitorMutation = {
              name: values.name.trim(),
              url: values.url.trim(),
              method: values.method,
              interval_seconds: Number(values.interval) as 60 | 120 | 300 | 600 | 1800,
              timeout_seconds: values.timeout,
              expected_status_min: values.statusMin,
              expected_status_max: values.statusMax,
              worker_pool_id: values.workerPool.trim(),
              headers,
            };
            try {
              const result = existing
                ? await monitorApi.update(environment.id, existing.id, body)
                : await monitorApi.create(environment.id, body);
              notifications.show({
                color: 'teal',
                message: existing
                  ? 'Monitor updated.'
                  : 'Monitor created. The first scheduled result may take one interval.',
              });
              onSaved(result.id);
            } catch (caught) {
              setError(errorMessage(caught));
            }
          })}
        >
          <Stack gap="lg">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Monitor name"
                placeholder="Public API health"
                required
                {...form.getInputProps('name')}
              />
              <NativeSelect
                label="Method"
                data={['GET', 'HEAD']}
                {...form.getInputProps('method')}
              />
            </SimpleGrid>
            <TextInput
              label="Target URL"
              description="HTTP/HTTPS on port 80 or 443. Hosted pools reject private and special addresses."
              placeholder="https://api.example.com/health"
              required
              {...form.getInputProps('url')}
            />
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
              <NativeSelect
                label="Interval"
                data={[
                  { value: '60', label: '1 minute' },
                  { value: '120', label: '2 minutes' },
                  { value: '300', label: '5 minutes' },
                  { value: '600', label: '10 minutes' },
                  { value: '1800', label: '30 minutes' },
                ]}
                {...form.getInputProps('interval')}
              />
              <NumberInput
                label="Timeout (seconds)"
                min={1}
                max={10}
                {...form.getInputProps('timeout')}
              />
              <NumberInput
                label="Status from"
                min={100}
                max={599}
                {...form.getInputProps('statusMin')}
              />
              <NumberInput
                label="Status to"
                min={100}
                max={599}
                {...form.getInputProps('statusMax')}
              />
            </SimpleGrid>
            <TextInput
              label="Worker pool"
              description="Use hosted unless an operator assigned an approved customer pool."
              {...form.getInputProps('workerPool')}
            />
            <Textarea
              label="Request headers"
              description="Optional, one Name: value pair per line. Values are encrypted by the backend and never returned."
              minRows={4}
              placeholder={'Authorization: Bearer …\nX-Health-Check: watchtrace'}
              {...form.getInputProps('headers')}
            />
            <Group>
              <Button type="submit" loading={form.submitting}>
                {existing ? 'Save changes' : 'Create monitor'}
              </Button>
              <Button variant="default" onClick={() => history.back()}>
                Cancel
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </div>
  );
}

export function MonitorDetailPage() {
  const { monitorId } = useParams();
  const tenant = useTenant();
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<'24h' | '7d' | '30d'>('24h');
  const monitor = useQuery({
    queryKey: ['monitor', tenant.environment.id, monitorId],
    queryFn: () => monitorApi.detail(tenant.environment.id, monitorId!),
  });
  const report = useQuery({
    queryKey: ['report', tenant.environment.id, monitorId, preset],
    // Build the rolling window for every request. Capturing it when the page
    // mounts permanently excludes checks completed after that timestamp.
    queryFn: () => monitorApi.report(tenant.environment.id, monitorId!, timeRange(preset)),
  });
  const checks = useQuery({
    queryKey: ['checks', tenant.environment.id, monitorId, preset],
    queryFn: () => monitorApi.checks(tenant.environment.id, monitorId!, timeRange(preset)),
  });
  const action = useMutation({
    mutationFn: async (kind: 'pause' | 'resume' | 'test') => {
      if (kind === 'test') {
        await monitorApi.test(tenant.environment.id, monitorId!);
      } else {
        await monitorApi[kind](tenant.environment.id, monitorId!);
      }
    },
    onSuccess: (_, kind) => {
      void queryClient.invalidateQueries({
        queryKey: ['monitor', tenant.environment.id, monitorId],
      });
      notifications.show({
        color: 'teal',
        message:
          kind === 'test' ? 'Manual check queued; it will not affect uptime.' : `Monitor ${kind}d.`,
      });
    },
    onError: (caught) => notifications.show({ color: 'red', message: errorMessage(caught) }),
  });
  if (monitor.isPending) return <LoadingState label="Loading monitor detail…" />;
  if (monitor.isError)
    return <ErrorState error={monitor.error} retry={() => void monitor.refetch()} />;
  const data = monitor.data;
  const base = `/app/${tenant.organization.id}/${tenant.project.id}/${tenant.environment.id}`;
  return (
    <div>
      <PageHeader
        eyebrow={`${data.method} · ${data.paused ? 'PAUSED' : intervalLabel(data.interval_seconds).toUpperCase()}`}
        title={data.name}
        description={data.url}
        actions={
          <Group>
            <Tooltip label="Open target in a new tab">
              <ActionIcon
                component="a"
                href={data.url}
                target="_blank"
                rel="noreferrer"
                variant="default"
                aria-label="Open target"
              >
                <IconExternalLink size={17} />
              </ActionIcon>
            </Tooltip>
            {tenant.canManageMonitors && (
              <>
                <Button
                  variant="default"
                  component={Link}
                  to={`${base}/monitors/${data.id}/edit`}
                  leftSection={<IconEdit size={16} />}
                >
                  Edit
                </Button>
                <Menu>
                  <Menu.Target>
                    <Button
                      variant="light"
                      loading={action.isPending}
                      rightSection={<IconDots size={15} />}
                    >
                      Actions
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconTestPipe size={15} />}
                      onClick={() => action.mutate('test')}
                    >
                      Run manual test
                    </Menu.Item>
                    <Menu.Item
                      leftSection={
                        data.paused ? <IconPlayerPlay size={15} /> : <IconPlayerPause size={15} />
                      }
                      onClick={() => action.mutate(data.paused ? 'resume' : 'pause')}
                    >
                      {data.paused ? 'Resume' : 'Pause'}
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </>
            )}
          </Group>
        }
      />
      <Group mb="lg" justify="space-between">
        <StatusBadge value={data.state} />
        <SegmentedControl
          value={preset}
          onChange={(value) => setPreset(value)}
          data={[
            { value: '24h', label: '24 hours' },
            { value: '7d', label: '7 days' },
            { value: '30d', label: '30 days' },
          ]}
          aria-label="Report time range"
        />
      </Group>
      {data.state === 'unknown' && (
        <Alert color="gray" mb="lg" title="Monitoring state is unknown">
          No accepted scheduled result establishes current health. Unknown is not healthy.
        </Alert>
      )}
      {report.isPending ? (
        <LoadingState label="Loading report…" />
      ) : report.isError ? (
        <ErrorState error={report.error} />
      ) : (
        <ReportCards report={report.data} />
      )}
      <SimpleGrid cols={{ base: 1, lg: 3 }} mt="lg" spacing="lg">
        <Card withBorder radius="lg" p="lg" style={{ gridColumn: 'span 2' }}>
          <Group justify="space-between">
            <Title order={3}>Recent latency</Title>
            <Text size="xs" c="dimmed">
              Scheduled and manual checks
            </Text>
          </Group>
          <LatencyChart checks={checks.data?.items ?? []} />
        </Card>
        <Card withBorder radius="lg" p="lg">
          <Text className="eyebrow">CONFIGURATION</Text>
          <Stack gap="sm" mt="md">
            <Fact label="Interval" value={intervalLabel(data.interval_seconds)} />
            <Fact label="Timeout" value={`${data.timeout_seconds}s`} />
            <Fact
              label="Expected"
              value={`${data.expected_status_min}–${data.expected_status_max}`}
            />
            <Fact label="Worker pool" value={data.worker_pool_id} />
            <Fact
              label="Secret headers"
              value={data.header_names.length ? data.header_names.join(', ') : 'None'}
            />
            <Fact label="Version" value={String(data.version)} />
          </Stack>
        </Card>
      </SimpleGrid>
      <Card withBorder radius="lg" p={0} mt="lg" className="table-card">
        <Group p="lg" justify="space-between">
          <Title order={3}>Check history</Title>
          <ActionIcon
            variant="subtle"
            onClick={() => void checks.refetch()}
            aria-label="Refresh checks"
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Group>
        <Divider />
        {checks.isPending ? (
          <LoadingState />
        ) : checks.isError ? (
          <Stack p="lg">
            <ErrorState error={checks.error} />
          </Stack>
        ) : checks.data.items.length ? (
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="sm" horizontalSpacing="lg">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Scheduled</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Result</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Latency</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {checks.data.items.map((check) => (
                  <Table.Tr key={check.job_id}>
                    <Table.Td>{formatDate(check.scheduled_at)}</Table.Td>
                    <Table.Td>
                      <Badge color="gray" variant="light">
                        {check.job_type}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={check.succeeded ? 'teal' : 'red'} variant="dot">
                        {check.succeeded ? 'Success' : (check.error_category ?? 'Failure')}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{check.status_code ?? '—'}</Table.Td>
                    <Table.Td>{durationFromMicroseconds(check.total_duration_us)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        ) : (
          <EmptyState
            title="No checks in this range"
            description="Scheduled results will appear here. Missing expected checks are reflected as unknown coverage."
          />
        )}
      </Card>
    </div>
  );
}

function ReportCards({
  report,
}: {
  report: {
    observed_uptime?: number | null;
    coverage?: number | null;
    average_latency_ms?: number | null;
    expected: number;
    observed: number;
    unknown: number;
    fresh: boolean;
  };
}) {
  return (
    <SimpleGrid cols={{ base: 2, md: 4 }} spacing="lg">
      <Metric
        label="Observed uptime"
        value={formatPercent(report.observed_uptime)}
        detail={`${report.observed} observed`}
      />
      <Metric
        label="Coverage"
        value={formatPercent(report.coverage)}
        detail={`${report.unknown} unknown`}
        warning={report.coverage !== 1}
      />
      <Metric
        label="Average latency"
        value={formatLatency(report.average_latency_ms)}
        detail="Observed checks"
      />
      <Metric
        label="Rollup"
        value={report.fresh ? 'Current' : 'Processing'}
        detail={`${report.expected} expected`}
        warning={!report.fresh}
      />
    </SimpleGrid>
  );
}

function Metric({
  label,
  value,
  detail,
  warning,
}: {
  label: string;
  value: string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <Card withBorder radius="lg" p="lg">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fz="xl" fw={700} c={warning ? 'yellow.7' : undefined}>
        {value}
      </Text>
      <Text size="xs" c="dimmed">
        {detail}
      </Text>
    </Card>
  );
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
function parseHeaders(value: string) {
  const result: Record<string, string> = {};
  for (const line of value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)) {
    const separator = line.indexOf(':');
    if (separator < 1) throw new Error(`Header “${line}” must use Name: value format.`);
    result[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  if (Object.keys(result).length > 32) throw new Error('At most 32 headers are allowed.');
  return result;
}

function intervalLabel(seconds: number) {
  return seconds < 120 ? 'Every minute' : `Every ${seconds / 60} minutes`;
}
