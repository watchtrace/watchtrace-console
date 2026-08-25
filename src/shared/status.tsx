import { Badge, Group, ThemeIcon, Text } from '@mantine/core';
import { IconAlertTriangle, IconCircleCheck, IconCircleX, IconHelp } from '@tabler/icons-react';

export type MonitorState = 'healthy' | 'degraded' | 'down' | 'unknown';

const status = {
  healthy: { color: 'teal', icon: IconCircleCheck, label: 'Healthy' },
  degraded: { color: 'yellow', icon: IconAlertTriangle, label: 'Degraded' },
  down: { color: 'red', icon: IconCircleX, label: 'Down' },
  unknown: { color: 'gray', icon: IconHelp, label: 'Unknown' },
} as const;

export function StatusBadge({ value }: { value: MonitorState }) {
  const item = status[value];
  return (
    <Badge color={item.color} variant="light" leftSection={<item.icon size={12} aria-hidden />}>
      {item.label}
    </Badge>
  );
}

export function StatusKey() {
  return (
    <Group gap="lg" role="list" aria-label="Monitor status meanings">
      {(Object.entries(status) as [MonitorState, (typeof status)[MonitorState]][]).map(
        ([key, item]) => (
          <Group gap={7} key={key} role="listitem">
            <ThemeIcon color={item.color} variant="light" size="sm" radius="xl">
              <item.icon size={13} aria-hidden />
            </ThemeIcon>
            <Text size="xs" c="dimmed">
              {item.label}
            </Text>
          </Group>
        ),
      )}
    </Group>
  );
}
