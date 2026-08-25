import {
  Alert,
  Button,
  Card,
  Group,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconBuilding, IconFolderPlus, IconLayersIntersect } from '@tabler/icons-react';
import { useState } from 'react';
import { tenantApi } from '../api/endpoints';
import { useTenant } from '../app/AppShell';
import { errorMessage } from '../shared/errors';
import { ErrorState, LoadingState } from '../shared/PageStates';
import { PageHeader } from '../shared/PageHeader';

export function WorkspaceSettingsPage() {
  const tenant = useTenant();
  const projects = useQuery({
    queryKey: ['projects', tenant.organization.id],
    queryFn: () => tenantApi.projects(tenant.organization.id),
  });
  const environments = useQuery({
    queryKey: ['environments', tenant.project.id],
    queryFn: () => tenantApi.environments(tenant.project.id),
  });
  const canManage = tenant.organization.allowed_actions.includes('tenant:manage');
  if (projects.isPending || environments.isPending)
    return <LoadingState label="Loading workspace settings…" />;
  if (projects.isError || environments.isError)
    return <ErrorState error={projects.error ?? environments.error} />;
  return (
    <div>
      <PageHeader
        eyebrow="TENANT HIERARCHY"
        title="Workspace settings"
        description="Organizations contain projects; projects contain environments. Monitoring data always stays inside its environment boundary."
      />
      {!canManage && (
        <Alert color="gray" mb="lg">
          Your {tenant.organization.role} role can view this hierarchy but cannot change it.
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
        <Card withBorder radius="lg" p="lg">
          <Group>
            <IconBuilding size={20} />
            <Title order={4}>{tenant.organization.name}</Title>
          </Group>
          <Text size="sm" c="dimmed" mt="sm">
            /{tenant.organization.slug}
          </Text>
          <Text size="sm" mt="md">
            Your role: <strong>{tenant.organization.role}</strong>
          </Text>
        </Card>
        <Card withBorder radius="lg" p="lg">
          <Group>
            <IconLayersIntersect size={20} />
            <Title order={4}>Projects</Title>
          </Group>
          <Stack gap="xs" mt="md">
            {projects.data.projects.map((project) => (
              <Group key={project.id} justify="space-between">
                <Text size="sm" fw={project.id === tenant.project.id ? 650 : 400}>
                  {project.name}
                </Text>
                {project.id === tenant.project.id && (
                  <Text size="xs" c="teal">
                    Current
                  </Text>
                )}
              </Group>
            ))}
          </Stack>
        </Card>
        <Card withBorder radius="lg" p="lg">
          <Group>
            <IconFolderPlus size={20} />
            <Title order={4}>Environments</Title>
          </Group>
          <Stack gap="xs" mt="md">
            {environments.data.environments.map((environment) => (
              <Group key={environment.id} justify="space-between">
                <Text size="sm" fw={environment.id === tenant.environment.id ? 650 : 400}>
                  {environment.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {environment.type}
                </Text>
              </Group>
            ))}
          </Stack>
        </Card>
      </SimpleGrid>
      {canManage && (
        <SimpleGrid cols={{ base: 1, md: 2 }} mt="lg" spacing="lg">
          <CreateProjectCard />
          <CreateEnvironmentCard />
        </SimpleGrid>
      )}
    </div>
  );
}

function CreateProjectCard() {
  const tenant = useTenant();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    initialValues: { name: '', description: '' },
    validate: { name: (value) => (value.trim() ? null : 'Name is required') },
  });
  return (
    <Card withBorder radius="lg" p="lg">
      <Title order={4}>Add project</Title>
      <Text size="sm" c="dimmed" mt={4}>
        Use projects for distinct products or systems.
      </Text>
      <form
        onSubmit={form.onSubmit(async (values) => {
          setError(null);
          try {
            await tenantApi.createProject(tenant.organization.id, {
              name: values.name.trim(),
              description: values.description.trim(),
            });
            form.reset();
            void queryClient.invalidateQueries({ queryKey: ['projects', tenant.organization.id] });
            notifications.show({ color: 'teal', message: 'Project created.' });
          } catch (caught) {
            setError(errorMessage(caught));
          }
        })}
      >
        <Stack mt="md">
          {error && <Alert color="red">{error}</Alert>}
          <TextInput label="Project name" required {...form.getInputProps('name')} />
          <TextInput label="Description" {...form.getInputProps('description')} />
          <Button type="submit" loading={form.submitting}>
            Create project
          </Button>
        </Stack>
      </form>
    </Card>
  );
}

function CreateEnvironmentCard() {
  const tenant = useTenant();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    initialValues: { name: '', type: 'staging' },
    validate: { name: (value) => (value.trim() ? null : 'Name is required') },
  });
  return (
    <Card withBorder radius="lg" p="lg">
      <Title order={4}>Add environment</Title>
      <Text size="sm" c="dimmed" mt={4}>
        Add an environment to the current project, {tenant.project.name}.
      </Text>
      <form
        onSubmit={form.onSubmit(async (values) => {
          setError(null);
          try {
            await tenantApi.createEnvironment(tenant.project.id, {
              name: values.name.trim(),
              type: values.type as 'production' | 'staging' | 'development',
            });
            form.reset();
            void queryClient.invalidateQueries({ queryKey: ['environments', tenant.project.id] });
            notifications.show({ color: 'teal', message: 'Environment created.' });
          } catch (caught) {
            setError(errorMessage(caught));
          }
        })}
      >
        <Stack mt="md">
          {error && <Alert color="red">{error}</Alert>}
          <TextInput label="Environment name" required {...form.getInputProps('name')} />
          <NativeSelect
            label="Type"
            data={['production', 'staging', 'development']}
            {...form.getInputProps('type')}
          />
          <Button type="submit" loading={form.submitting}>
            Create environment
          </Button>
        </Stack>
      </form>
    </Card>
  );
}
