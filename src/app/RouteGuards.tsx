import { Center, Loader, Stack, Text } from '@mantine/core';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'restoring') {
    return (
      <Center mih="100vh">
        <Stack align="center" gap="sm">
          <Loader color="teal" />
          <Text c="dimmed" size="sm">
            Restoring your secure session…
          </Text>
        </Stack>
      </Center>
    );
  }
  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function AnonymousRoute() {
  const auth = useAuth();
  if (auth.status === 'restoring') return null;
  if (auth.status === 'authenticated') return <Navigate to="/app" replace />;
  return <Outlet />;
}
