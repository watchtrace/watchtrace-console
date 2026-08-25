import { Alert, Button, Center, Loader, Stack, Text, Title } from '@mantine/core';
import { IconAlertCircle, IconInbox } from '@tabler/icons-react';
import { errorMessage } from './errors';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <Center mih={220} role="status" aria-live="polite">
      <Stack align="center" gap="sm">
        <Loader color="teal" />
        <Text c="dimmed" size="sm">
          {label}
        </Text>
      </Stack>
    </Center>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <Alert color="red" icon={<IconAlertCircle />} title="We couldn’t load this page" role="alert">
      <Text size="sm">{errorMessage(error)}</Text>
      {retry && (
        <Button color="red" variant="light" size="xs" mt="md" onClick={retry}>
          Try again
        </Button>
      )}
    </Alert>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Center className="empty-state">
      <Stack align="center" maw={460} ta="center">
        <IconInbox size={34} stroke={1.4} aria-hidden />
        <Title order={3}>{title}</Title>
        <Text c="dimmed">{description}</Text>
        {action}
      </Stack>
    </Center>
  );
}
