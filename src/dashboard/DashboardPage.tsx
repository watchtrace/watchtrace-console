import {
  Alert,
  Anchor,
  Card,
  Group,
  Progress,
  RingProgress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleX,
  IconClockHour4,
  IconHelp,
  IconShieldCheck,
} from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { monitoringApi } from '../api/endpoints';
import { useTenant } from '../app/AppShell';
import { formatLatency, formatPercent, formatDate, timeRange } from '../shared/format';
import { ErrorState, LoadingState } from '../shared/PageStates';
import { PageHeader } from '../shared/PageHeader';
import { StatusKey } from '../shared/status';

export function DashboardPage() {
  const { environment } = useTenant();
  const dashboard = useQuery({
    queryKey: ['dashboard', environment.id, '24h'],
    queryFn: () => monitoringApi.dashboard(environment.id, timeRange('24h')),
    refetchInterval: 15_000,
  });

  if (dashboard.isPending)
    return <LoadingState label="Calculating observed uptime and coverage…" />;
  if (dashboard.isError)
    return <ErrorState error={dashboard.error} retry={() => void dashboard.refetch()} />;
  const data = dashboard.data;
  const total = Object.values(data.states).reduce((sum, value) => sum + value, 0);
  const base = `/app/${environment.organization_id}/${environment.project_id}/${environment.id}`;

  return (
    <div>
      <PageHeader
        eyebrow={`${environment.name.toUpperCase()} · LAST 24 HOURS`}
        title="Monitoring overview"
        description="Observed results and expected coverage are shown separately. Unknown time is never counted as healthy."
        actions={
          <Text size="xs" c="dimmed">
            Updated {formatDate(data.generated_at)}
          </Text>
        }
      />
      {data.reliability.coverage != null && data.reliability.coverage < 1 && (
        <Alert color="yellow" icon={<IconAlertTriangle />} mb="xl" title="Coverage is incomplete">
          {data.reliability.unknown} expected check{data.reliability.unknown === 1 ? '' : 's'} had
          no accepted result. Observed uptime only describes the {data.reliability.observed} checks
          we actually saw.
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing="lg">
        <StateCard
          label="Healthy"
          value={data.states.healthy}
          total={total}
          color="teal"
          icon={IconCircleCheck}
        />
        <StateCard
          label="Degraded"
          value={data.states.degraded}
          total={total}
          color="yellow"
          icon={IconAlertTriangle}
        />
        <StateCard
          label="Down"
          value={data.states.down}
          total={total}
          color="red"
          icon={IconCircleX}
        />
        <StateCard
          label="Unknown"
          value={data.states.unknown}
          total={total}
          color="gray"
          icon={IconHelp}
        />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, lg: 2 }} mt="lg" spacing="lg">
        <Card withBorder radius="lg" p="xl" className="metric-panel">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text className="eyebrow">OBSERVED UPTIME</Text>
              <Title order={2}>{formatPercent(data.reliability.observed_uptime)}</Title>
              <Text size="sm" c="dimmed">
                {data.reliability.successful} successful of {data.reliability.observed} observed
                checks
              </Text>
            </Stack>
            <RingProgress
              size={108}
              thickness={9}
              roundCaps
              sections={[{ value: (data.reliability.observed_uptime ?? 0) * 100, color: 'teal' }]}
              label={
                <ThemeIcon color="teal" variant="light" radius="xl" mx="auto">
                  <IconShieldCheck size={18} />
                </ThemeIcon>
              }
            />
          </Group>
          {data.reliability.observed_uptime == null && (
            <Text size="sm" c="dimmed" mt="md">
              No observed checks exist in this period, so uptime has no denominator.
            </Text>
          )}
        </Card>
        <Card withBorder radius="lg" p="xl" className="metric-panel">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text className="eyebrow">MONITORING COVERAGE</Text>
              <Title order={2}>{formatPercent(data.reliability.coverage)}</Title>
              <Text size="sm" c="dimmed">
                {data.reliability.observed} observed · {data.reliability.unknown} unknown ·{' '}
                {data.reliability.expected} expected
              </Text>
            </Stack>
            <ThemeIcon color="blue" variant="light" size={52} radius="xl">
              <IconClockHour4 size={24} />
            </ThemeIcon>
          </Group>
          <Progress
            mt="xl"
            size="lg"
            radius="xl"
            value={(data.reliability.coverage ?? 0) * 100}
            color={data.reliability.coverage === 1 ? 'teal' : 'yellow'}
            aria-label={`Coverage ${formatPercent(data.reliability.coverage)}`}
          />
          <Text size="xs" c="dimmed" mt="sm">
            Average latency: {formatLatency(data.reliability.average_latency_ms)}
          </Text>
        </Card>
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, lg: 2 }} mt="lg" spacing="lg">
        <Card withBorder radius="lg" p="xl">
          <Group justify="space-between">
            <div>
              <Text className="eyebrow">ACTIVE ATTENTION</Text>
              <Title order={3} mt={4}>
                {data.open_incidents} open incident{data.open_incidents === 1 ? '' : 's'}
              </Title>
            </div>
            <Anchor component={Link} to={`${base}/incidents`}>
              View incidents
            </Anchor>
          </Group>
          <Text c="dimmed" mt="md" size="sm">
            An acknowledged incident remains open until recovery or manual resolution.
          </Text>
        </Card>
        <Card withBorder radius="lg" p="xl">
          <Text className="eyebrow">STATUS LANGUAGE</Text>
          <Text size="sm" c="dimmed" mt="sm" mb="lg">
            Unknown means WatchTrace lacks an accepted scheduled result. It does not mean the target
            is up.
          </Text>
          <StatusKey />
        </Card>
      </SimpleGrid>
    </div>
  );
}

function StateCard({
  label,
  value,
  total,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  icon: typeof IconCircleCheck;
}) {
  return (
    <Card withBorder radius="lg" p="lg" className="state-card">
      <Group justify="space-between">
        <div>
          <Text c="dimmed" size="sm">
            {label}
          </Text>
          <Text fz={34} fw={700} lh={1.2}>
            {value}
          </Text>
          <Text c="dimmed" size="xs">
            {total ? Math.round((value / total) * 100) : 0}% of monitors
          </Text>
        </div>
        <ThemeIcon color={color} variant="light" radius="xl" size={46}>
          <Icon size={22} />
        </ThemeIcon>
      </Group>
    </Card>
  );
}
