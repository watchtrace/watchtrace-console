import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AnonymousRoute, ProtectedRoute } from './RouteGuards';
import { TenantAppShell } from './AppShell';
import { AuthLayout } from '../auth/AuthLayout';
import {
  AcceptInvitationPage,
  ForgotPasswordPage,
  LoginPage,
  ResetPasswordPage,
  SignupPage,
  VerifyEmailPage,
} from '../auth/AuthPages';
import { AppIndex } from '../tenants/TenantRouter';
import { LoadingState } from '../shared/PageStates';

const DashboardPage = lazy(() =>
  import('../dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const MonitorListPage = lazy(() =>
  import('../monitors/MonitorPages').then((module) => ({ default: module.MonitorListPage })),
);
const MonitorFormPage = lazy(() =>
  import('../monitors/MonitorPages').then((module) => ({ default: module.MonitorFormPage })),
);
const MonitorDetailPage = lazy(() =>
  import('../monitors/MonitorPages').then((module) => ({ default: module.MonitorDetailPage })),
);
const IncidentListPage = lazy(() =>
  import('../incidents/IncidentPages').then((module) => ({ default: module.IncidentListPage })),
);
const IncidentDetailPage = lazy(() =>
  import('../incidents/IncidentPages').then((module) => ({ default: module.IncidentDetailPage })),
);
const TeamPage = lazy(() =>
  import('../team/TeamPage').then((module) => ({ default: module.TeamPage })),
);
const WorkspaceSettingsPage = lazy(() =>
  import('../tenants/WorkspaceSettingsPage').then((module) => ({
    default: module.WorkspaceSettingsPage,
  })),
);

export function App() {
  return (
    <Suspense fallback={<LoadingState label="Loading page…" />}>
      <Routes>
        <Route element={<AnonymousRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
          <Route path="/app" element={<AppIndex />} />
          <Route path="/app/:orgId/:projectId/:environmentId" element={<TenantAppShell />}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<DashboardPage />} />
            <Route path="monitors" element={<MonitorListPage />} />
            <Route path="monitors/new" element={<MonitorFormPage mode="create" />} />
            <Route path="monitors/:monitorId" element={<MonitorDetailPage />} />
            <Route path="monitors/:monitorId/edit" element={<MonitorFormPage mode="edit" />} />
            <Route path="incidents" element={<IncidentListPage />} />
            <Route path="incidents/:incidentId" element={<IncidentDetailPage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="settings" element={<WorkspaceSettingsPage />} />
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

function NotFoundPage() {
  return (
    <Center mih="100vh">
      <Stack align="center" ta="center">
        <Text className="eyebrow">404</Text>
        <Title order={1}>That page isn’t on the map</Title>
        <Text c="dimmed">It may have moved, or your access may have changed.</Text>
        <Button component="a" href="/app">
          Return to WatchTrace
        </Button>
      </Stack>
    </Center>
  );
}
