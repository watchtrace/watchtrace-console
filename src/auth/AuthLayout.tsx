import { Anchor, Box, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { IconActivityHeartbeat } from '@tabler/icons-react';
import { Link, Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <main className="auth-layout">
      <section className="auth-story" aria-label="WatchTrace overview">
        <Group gap="sm" className="brand-mark">
          <Box className="brand-icon">
            <IconActivityHeartbeat size={24} stroke={1.8} aria-hidden />
          </Box>
          <Text fw={700} fz="lg">
            WatchTrace
          </Text>
        </Group>
        <Stack gap="xl" maw={570}>
          <Text className="eyebrow">UPTIME, WITHOUT THE FALSE CONFIDENCE</Text>
          <Title order={1} className="auth-headline">
            Know what’s working.
            <br />
            See what you missed.
          </Title>
          <Text c="dimmed" fz="lg" lh={1.7}>
            WatchTrace pairs observed uptime with monitoring coverage, so missing checks never
            masquerade as a perfect score.
          </Text>
          <div className="signal-preview" aria-hidden>
            {[42, 42, 58, 42, 42, 72, 42, 42, 42, 56, 42, 42].map((height, index) => (
              <span key={index} style={{ height }} />
            ))}
          </div>
        </Stack>
        <Text c="dimmed" size="sm">
          Expected detection time is typically 2–3 minutes at one-minute polling.
        </Text>
      </section>
      <section className="auth-panel">
        <Paper className="auth-card" radius="lg" p="xl">
          <Outlet />
        </Paper>
        <Text ta="center" size="xs" c="dimmed" mt="lg">
          By continuing, you confirm you are authorized to monitor your configured targets.
          <br />
          <Anchor component={Link} to="/login" size="xs">
            Return to sign in
          </Anchor>
        </Text>
      </section>
    </main>
  );
}
