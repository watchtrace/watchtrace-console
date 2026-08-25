import type { components } from './generated';

type Schemas = components['schemas'];

export type AllowedAction = Schemas['AllowedActions'][number];
export type AssignableRole = Schemas['AssignableRole'];
export type AuthResponse = Schemas['AuthResponse'];
export type Check = Schemas['Check'];
export type CheckPage = Schemas['CheckPage'];
export type Dashboard = Schemas['Dashboard'];
export type DefaultOwnership = Schemas['DefaultOwnership'];
export type Environment = Schemas['Environment'];
export type EnvironmentMutation = Schemas['EnvironmentMutation'];
export type Incident = Schemas['Incident'];
export type IncidentPage = Schemas['IncidentPage'];
export type IncidentSummary = Schemas['IncidentSummary'];
export type Invitation = Schemas['Invitation'];
export type Member = Schemas['Member'];
export type MemberMutation = Schemas['MemberMutation'];
export type Membership = Schemas['Membership'];
export type Monitor = Schemas['Monitor'];
export type MonitorDetail = Schemas['MonitorDetail'];
export type MonitorMutation = Schemas['MonitorMutation'];
export type Organization = Schemas['Organization'];
export type OrganizationMutation = Schemas['OrganizationMutation'];
export type Project = Schemas['Project'];
export type ProjectMutation = Schemas['ProjectMutation'];
export type Report = Schemas['Report'];
export type Role = Schemas['Role'];
export type User = Schemas['User'];

export interface ErrorEnvelope {
  error: { code: string; message: string; request_id: string };
}

export interface TimeRange {
  from: string;
  to: string;
}

export interface RefreshHint {
  id: number;
  type: string;
  resourceType?: string;
  resourceId?: string;
}
