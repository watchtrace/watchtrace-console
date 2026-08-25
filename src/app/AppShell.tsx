import {
  AppShell as MantineAppShell,
  Avatar,
  Badge,
  Burger,
  Button,
  Group,
  Menu,
  NavLink,
  Select,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import {
  IconActivityHeartbeat,
  IconBellRinging,
  IconChevronDown,
  IconGauge,
  IconLogout,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react';
import { createContext, useContext } from 'react';
import {
  NavLink as RouterNavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { tenantApi } from '../api/endpoints';
import type { Environment, Organization, Project } from '../api/types';
import { useAuth } from '../auth/AuthProvider';
import { useRealtime, type LiveStatus } from '../realtime/useRealtime';
import { ErrorState, LoadingState } from '../shared/PageStates';

export interface TenantContextValue {
  organization: Organization;
  project: Project;
  environment: Environment;
  canManageMonitors: boolean;
  canManageIncidents: boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function useTenant() {
  const value = useContext(TenantContext);
  if (!value) throw new Error('useTenant must be used under TenantAppShell');
  return value;
}

export function TenantAppShell() {
  const { orgId, projectId, environmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const [opened, { toggle, close }] = useDisclosure(false);
  const organizations = useQuery({ queryKey: ['organizations'], queryFn: tenantApi.organizations });
  const projects = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => tenantApi.projects(orgId!),
    enabled: Boolean(orgId),
  });
  const environments = useQuery({
    queryKey: ['environments', projectId],
    queryFn: () => tenantApi.environments(projectId!),
    enabled: Boolean(projectId),
  });
  const organization = organizations.data?.organizations.find((item) => item.id === orgId);
  const project = projects.data?.projects.find((item) => item.id === projectId);
  const environment = environments.data?.environments.find((item) => item.id === environmentId);
  const liveStatus = useRealtime(environmentId);

  if (organizations.isPending || projects.isPending || environments.isPending) {
    return <LoadingState label="Loading workspace…" />;
  }
  const error = organizations.error ?? projects.error ?? environments.error;
  if (error) return <ErrorState error={error} />;
  if (!organization || !project || !environment) {
    return (
      <main className="access-state">
        <Stack maw={560}>
          <TitleWithText />
          <Button onClick={() => void navigate('/app', { replace: true })}>
            Choose another workspace
          </Button>
        </Stack>
      </main>
    );
  }

  const base = `/app/${organization.id}/${project.id}/${environment.id}`;
  const context: TenantContextValue = {
    organization,
    project,
    environment,
    canManageMonitors: environment.allowed_actions.includes('monitors:manage'),
    canManageIncidents: environment.allowed_actions.includes('incidents:manage'),
  };

  const chooseOrganization = async (nextOrgId: string | null) => {
    if (!nextOrgId) return;
    const nextProjects = await tenantApi.projects(nextOrgId);
    const nextProject = nextProjects.projects[0];
    if (!nextProject) {
      void navigate('/app');
      return;
    }
    const nextEnvironments = await tenantApi.environments(nextProject.id);
    const nextEnvironment = nextEnvironments.environments[0];
    void navigate(
      nextEnvironment
        ? `/app/${nextOrgId}/${nextProject.id}/${nextEnvironment.id}/overview`
        : '/app',
    );
  };

  return (
    <TenantContext.Provider value={context}>
      <MantineAppShell
        header={{ height: 68 }}
        navbar={{ width: 252, breakpoint: 'md', collapsed: { mobile: !opened } }}
        padding={{ base: 'md', sm: 'xl' }}
      >
        <MantineAppShell.Header className="app-header">
          <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
            <Group wrap="nowrap">
              <Burger
                opened={opened}
                onClick={toggle}
                hiddenFrom="md"
                size="sm"
                aria-label="Toggle navigation"
              />
              <Group gap="sm" className="brand-mark">
                <ThemeIcon
                  color="teal"
                  variant="gradient"
                  gradient={{ from: 'teal', to: 'cyan' }}
                  radius="md"
                >
                  <IconActivityHeartbeat size={20} aria-hidden />
                </ThemeIcon>
                <Text fw={750}>WatchTrace</Text>
              </Group>
            </Group>
            <Group gap="sm" wrap="nowrap">
              <LiveBadge status={liveStatus} />
              <Menu position="bottom-end" width={230}>
                <Menu.Target>
                  <Button
                    variant="subtle"
                    color="gray"
                    px="xs"
                    rightSection={<IconChevronDown size={14} />}
                  >
                    <Avatar size={28} color="teal" name={auth.user?.email} />
                    <Text visibleFrom="sm" ml="xs" size="sm" maw={160} truncate>
                      {auth.user?.email}
                    </Text>
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>{organization.role} access</Menu.Label>
                  <Menu.Item
                    leftSection={<IconLogout size={16} />}
                    onClick={() => void auth.logout()}
                  >
                    Sign out
                  </Menu.Item>
                  <Menu.Item
                    color="red"
                    leftSection={<IconLogout size={16} />}
                    onClick={() => void auth.logout(true)}
                  >
                    Sign out everywhere
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </MantineAppShell.Header>
        <MantineAppShell.Navbar p="md" className="app-navbar">
          <MantineAppShell.Section>
            <Select
              label="Organization"
              value={organization.id}
              data={(organizations.data?.organizations ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              onChange={(value) => void chooseOrganization(value)}
              allowDeselect={false}
            />
            <Select
              label="Project"
              mt="sm"
              value={project.id}
              data={(projects.data?.projects ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              onChange={(value) => {
                if (!value) return;
                void tenantApi.environments(value).then((result) => {
                  const first = result.environments[0];
                  void navigate(
                    first ? `/app/${organization.id}/${value}/${first.id}/overview` : '/app',
                  );
                });
              }}
              allowDeselect={false}
            />
            <Select
              label="Environment"
              mt="sm"
              value={environment.id}
              data={(environments.data?.environments ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              onChange={(value) => {
                if (value) void navigate(`/app/${organization.id}/${project.id}/${value}/overview`);
              }}
              allowDeselect={false}
            />
          </MantineAppShell.Section>
          <MantineAppShell.Section grow mt="xl">
            <Stack gap={4}>
              {[
                { to: `${base}/overview`, label: 'Overview', icon: IconGauge },
                { to: `${base}/monitors`, label: 'Monitors', icon: IconActivityHeartbeat },
                { to: `${base}/incidents`, label: 'Incidents', icon: IconBellRinging },
                { to: `${base}/team`, label: 'Team & alerts', icon: IconUsers },
                { to: `${base}/settings`, label: 'Workspace settings', icon: IconSettings },
              ].map((item) => (
                <NavLink
                  key={item.to}
                  component={RouterNavLink}
                  to={item.to}
                  label={item.label}
                  leftSection={<item.icon size={18} stroke={1.7} />}
                  active={location.pathname.startsWith(item.to)}
                  onClick={close}
                  className="shell-nav-link"
                />
              ))}
            </Stack>
          </MantineAppShell.Section>
          <MantineAppShell.Section>
            <Text size="xs" c="dimmed">
              Contract v1.0.0 · {organization.role}
            </Text>
          </MantineAppShell.Section>
        </MantineAppShell.Navbar>
        <MantineAppShell.Main className="app-main">
          <Outlet />
        </MantineAppShell.Main>
      </MantineAppShell>
    </TenantContext.Provider>
  );
}

function LiveBadge({ status }: { status: LiveStatus }) {
  const label = status === 'live' ? 'Live' : status === 'polling' ? 'Polling' : 'Connecting';
  const color = status === 'live' ? 'teal' : status === 'polling' ? 'yellow' : 'gray';
  return (
    <Badge color={color} variant="light" className={status === 'live' ? 'live-badge' : undefined}>
      {label}
    </Badge>
  );
}

function TitleWithText() {
  return (
    <>
      <Text className="eyebrow">ACCESS CHANGED</Text>
      <Text fz="xl" fw={700}>
        This workspace is no longer available
      </Text>
      <Text c="dimmed">
        It may have been removed, or your membership may have changed. Nothing is cached as an
        authority in this browser.
      </Text>
    </>
  );
}
