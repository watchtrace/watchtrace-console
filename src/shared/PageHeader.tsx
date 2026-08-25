import { Group, Stack, Text, Title } from '@mantine/core';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-end" gap="lg" mb="xl">
      <Stack gap={4}>
        {eyebrow && <Text className="eyebrow">{eyebrow}</Text>}
        <Title order={1} className="page-title">
          {title}
        </Title>
        {description && (
          <Text c="dimmed" maw={720}>
            {description}
          </Text>
        )}
      </Stack>
      {actions && <Group>{actions}</Group>}
    </Group>
  );
}
