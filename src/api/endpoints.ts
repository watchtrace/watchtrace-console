import { apiClient } from './client';
import type {
  AuthResponse,
  CheckPage,
  Dashboard,
  DefaultOwnership,
  Environment,
  EnvironmentMutation,
  IncidentPage,
  IncidentSummary,
  Invitation,
  Member,
  MemberMutation,
  Membership,
  Monitor,
  MonitorDetail,
  MonitorMutation,
  Organization,
  OrganizationMutation,
  Project,
  ProjectMutation,
  Report,
  TimeRange,
  User,
} from './types';

function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export const authApi = {
  signup: (email: string, password: string) =>
    apiClient.request<AuthResponse>('/auth/signup', {
      method: 'POST',
      authenticated: false,
      body: { email, password },
    }),
  login: (email: string, password: string) =>
    apiClient.request<AuthResponse>('/auth/login', {
      method: 'POST',
      authenticated: false,
      body: { email, password },
    }),
  currentUser: () => apiClient.request<{ user: User }>('/auth/me'),
  logout: (allSessions = false) =>
    apiClient.request<void>('/auth/logout', {
      method: 'POST',
      body: { all_sessions: allSessions },
    }),
  verifyEmail: (token: string) =>
    apiClient.request<{ user: User }>('/auth/verify-email', {
      method: 'POST',
      authenticated: false,
      body: { token },
    }),
  forgotPassword: (email: string) =>
    apiClient.request<void>('/auth/forgot-password', {
      method: 'POST',
      authenticated: false,
      body: { email },
    }),
  resetPassword: (token: string, newPassword: string) =>
    apiClient.request<void>('/auth/reset-password', {
      method: 'POST',
      authenticated: false,
      body: { token, new_password: newPassword },
    }),
  acceptInvitation: (token: string) =>
    apiClient.request<Membership>('/auth/accept-invitation', { method: 'POST', body: { token } }),
};

export const tenantApi = {
  organizations: () => apiClient.request<{ organizations: Organization[] }>('/organizations'),
  createHierarchy: (organization: OrganizationMutation, project: ProjectMutation) =>
    apiClient.request<DefaultOwnership>('/organizations', {
      method: 'POST',
      body: { organization, project },
    }),
  updateOrganization: (id: string, body: OrganizationMutation) =>
    apiClient.request<Organization>(`/organizations/${id}`, { method: 'PUT', body }),
  projects: (orgId: string) =>
    apiClient.request<{ projects: Project[] }>(`/organizations/${orgId}/projects`),
  createProject: (orgId: string, body: ProjectMutation) =>
    apiClient.request<Project>(`/organizations/${orgId}/projects`, { method: 'POST', body }),
  environments: (projectId: string) =>
    apiClient.request<{ environments: Environment[] }>(`/projects/${projectId}/environments`),
  createEnvironment: (projectId: string, body: EnvironmentMutation) =>
    apiClient.request<Environment>(`/projects/${projectId}/environments`, { method: 'POST', body }),
  members: (orgId: string) =>
    apiClient.request<{ members: Member[] }>(`/organizations/${orgId}/members`),
  invite: (orgId: string, email: string, role: string) =>
    apiClient.request<Invitation>(`/organizations/${orgId}/invitations`, {
      method: 'POST',
      body: { email, role },
    }),
  updateMember: (orgId: string, userId: string, body: MemberMutation) =>
    apiClient.request<Member>(`/organizations/${orgId}/members/${userId}`, {
      method: 'PATCH',
      body,
    }),
  removeMember: (orgId: string, userId: string) =>
    apiClient.request<void>(`/organizations/${orgId}/members/${userId}`, { method: 'DELETE' }),
};

export const monitorApi = {
  list: (environmentId: string) =>
    apiClient.request<{ monitors: Monitor[] }>(`/environments/${environmentId}/monitors`),
  create: (environmentId: string, body: MonitorMutation) =>
    apiClient.request<Monitor>(`/environments/${environmentId}/monitors`, {
      method: 'POST',
      body,
    }),
  detail: (environmentId: string, monitorId: string) =>
    apiClient.request<MonitorDetail>(`/environments/${environmentId}/monitors/${monitorId}`),
  update: (environmentId: string, monitorId: string, body: MonitorMutation) =>
    apiClient.request<Monitor>(`/environments/${environmentId}/monitors/${monitorId}`, {
      method: 'PUT',
      body,
    }),
  remove: (environmentId: string, monitorId: string) =>
    apiClient.request<void>(`/environments/${environmentId}/monitors/${monitorId}`, {
      method: 'DELETE',
    }),
  pause: (environmentId: string, monitorId: string) =>
    apiClient.request<Monitor>(`/environments/${environmentId}/monitors/${monitorId}/pause`, {
      method: 'POST',
    }),
  resume: (environmentId: string, monitorId: string) =>
    apiClient.request<Monitor>(`/environments/${environmentId}/monitors/${monitorId}/resume`, {
      method: 'POST',
    }),
  test: (environmentId: string, monitorId: string) =>
    apiClient.request<{ job_id: string }>(
      `/environments/${environmentId}/monitors/${monitorId}/test`,
      { method: 'POST' },
    ),
  checks: (environmentId: string, monitorId: string, range: TimeRange, cursor?: string) =>
    apiClient.request<CheckPage>(
      `/environments/${environmentId}/monitors/${monitorId}/checks${query({ from: range.from, to: range.to, limit: 50, cursor })}`,
    ),
  report: (environmentId: string, monitorId: string, range: TimeRange) =>
    apiClient.request<Report>(
      `/environments/${environmentId}/monitors/${monitorId}/report${query({ from: range.from, to: range.to })}`,
    ),
};

export const monitoringApi = {
  dashboard: (environmentId: string, range: TimeRange) =>
    apiClient.request<Dashboard>(
      `/environments/${environmentId}/dashboard${query({ from: range.from, to: range.to })}`,
    ),
  incidents: (
    environmentId: string,
    range: TimeRange,
    status?: 'open' | 'resolved',
    cursor?: string,
  ) =>
    apiClient.request<IncidentPage>(
      `/environments/${environmentId}/incidents${query({ from: range.from, to: range.to, status, cursor, limit: 50 })}`,
    ),
  incident: (environmentId: string, incidentId: string) =>
    apiClient.request<IncidentSummary>(`/environments/${environmentId}/incidents/${incidentId}`),
  acknowledge: (environmentId: string, incidentId: string, reason: string) =>
    apiClient.request<IncidentSummary>(
      `/environments/${environmentId}/incidents/${incidentId}/acknowledge`,
      { method: 'POST', body: { reason } },
    ),
  resolve: (environmentId: string, incidentId: string, reason: string) =>
    apiClient.request<IncidentSummary>(
      `/environments/${environmentId}/incidents/${incidentId}/resolve`,
      { method: 'POST', body: { reason } },
    ),
};
