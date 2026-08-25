import { Alert, Button, Card, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { tenantApi } from '../api/endpoints';
import { errorMessage } from '../shared/errors';
import { LoadingState } from '../shared/PageStates';

export function AppIndex() {
  const organizations = useQuery({ queryKey: ['organizations'], queryFn: tenantApi.organizations });
  const org = organizations.data?.organizations[0];
  const projects = useQuery({
    queryKey: ['projects', org?.id],
    queryFn: () => tenantApi.projects(org!.id),
    enabled: Boolean(org),
  });
  const project = projects.data?.projects[0];
  const environments = useQuery({
    queryKey: ['environments', project?.id],
    queryFn: () => tenantApi.environments(project!.id),
    enabled: Boolean(project),
  });
  const environment = environments.data?.environments[0];

  if (
    organizations.isPending ||
    (org && projects.isPending) ||
    (project && environments.isPending)
  ) {
    return <LoadingState label="Opening your workspace…" />;
  }
  if (organizations.isError) {
    return (
      <Stack maw={600} mx="auto" mt="10vh">
        <Alert color="red" title="Your organizations could not be loaded">
          {errorMessage(organizations.error)}
        </Alert>
      </Stack>
    );
  }
  if (!org) return <OnboardingPage />;
  if (!project || !environment)
    return <TenantIncompleteState orgId={org.id} hasProject={Boolean(project)} />;
  return <Navigate to={`/app/${org.id}/${project.id}/${environment.id}/overview`} replace />;
}

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    initialValues: { organizationName: '', slug: '', projectName: '', description: '' },
    validate: {
      organizationName: (value) => (value.trim() ? null : 'Organization name is required'),
      projectName: (value) => (value.trim() ? null : 'Project name is required'),
    },
  });
  return (
    <main className="onboarding-page">
      <Stack maw={760} mx="auto" gap="xl">
        <div>
          <Text className="eyebrow">YOUR FIRST WORKSPACE</Text>
          <Title order={1}>What are we keeping watch over?</Title>
          <Text c="dimmed" mt="sm" maw={580}>
            We’ll create one organization, one project, and a Production environment together.
          </Text>
        </div>
        <Card withBorder radius="lg" p="xl">
          {error && (
            <Alert color="red" mb="lg">
              {error}
            </Alert>
          )}
          <form
            onSubmit={form.onSubmit(async (values) => {
              setError(null);
              try {
                const result = await tenantApi.createHierarchy(
                  {
                    name: values.organizationName.trim(),
                    ...(values.slug ? { slug: values.slug.trim() } : {}),
                  },
                  {
                    name: values.projectName.trim(),
                    ...(values.description ? { description: values.description.trim() } : {}),
                  },
                );
                await queryClient.invalidateQueries({ queryKey: ['organizations'] });
                void navigate(
                  `/app/${result.organization.id}/${result.project.id}/${result.environment.id}/overview`,
                  { replace: true },
                );
              } catch (caught) {
                setError(errorMessage(caught));
              }
            })}
          >
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label="Organization name"
                placeholder="Acme Labs"
                required
                {...form.getInputProps('organizationName')}
              />
              <TextInput
                label="Organization slug"
                placeholder="acme-labs"
                description="Optional; we can generate one"
                {...form.getInputProps('slug')}
              />
              <TextInput
                label="Project name"
                placeholder="Core API"
                required
                {...form.getInputProps('projectName')}
              />
              <TextInput
                label="Project description"
                placeholder="Customer-facing production API"
                {...form.getInputProps('description')}
              />
            </SimpleGrid>
            <Button type="submit" mt="xl" size="md" loading={form.submitting}>
              Create workspace
            </Button>
          </form>
        </Card>
      </Stack>
    </main>
  );
}

function TenantIncompleteState({ orgId, hasProject }: { orgId: string; hasProject: boolean }) {
  return (
    <Stack maw={620} mx="auto" mt="10vh">
      <Title order={2}>Finish setting up this workspace</Title>
      <Text c="dimmed">
        {hasProject
          ? 'This project has no environment yet.'
          : 'This organization has no project yet.'}{' '}
        An administrator can add the missing level in workspace settings.
      </Text>
      <Button component="a" href={`/app/${orgId}/settings`} variant="light">
        Open workspace settings
      </Button>
    </Stack>
  );
}
