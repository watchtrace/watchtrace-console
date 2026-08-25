import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { API_CONTRACT_VERSION } from './config';

interface OpenApiDocument {
  openapi: string;
  info: { version: string };
  paths: Record<string, Record<string, { operationId?: string }>>;
  components: { schemas: Record<string, unknown> };
}

const contractPath = resolve(process.cwd(), 'openapi/customer-v1.openapi.yaml');
const rawContract = readFileSync(contractPath, 'utf8');
const contract = parse(rawContract) as OpenApiDocument;

const requiredOperations = [
  'signup',
  'login',
  'refresh',
  'logout',
  'currentUser',
  'verifyEmail',
  'forgotPassword',
  'resetPassword',
  'acceptInvitation',
  'listOrganizations',
  'createOrganizationHierarchy',
  'listMembers',
  'updateMember',
  'removeMember',
  'inviteMember',
  'listProjects',
  'createProject',
  'listEnvironments',
  'createEnvironment',
  'listMonitors',
  'createMonitor',
  'getMonitor',
  'updateMonitor',
  'deleteMonitor',
  'testMonitor',
  'pauseMonitor',
  'resumeMonitor',
  'listChecks',
  'monitorReport',
  'dashboard',
  'listIncidents',
  'getIncident',
  'acknowledgeIncident',
  'resolveIncident',
  'streamEvents',
];

describe('frozen customer API contract', () => {
  it('pins the exact reviewed Phase 1 contract artifact', () => {
    expect(contract.openapi).toBe('3.0.3');
    expect(contract.info.version).toBe(API_CONTRACT_VERSION);
    expect(createHash('sha256').update(rawContract).digest('hex')).toBe(
      '77189739e81f3107dcc3a61cbeae016683baef727c8e23e1d96b5d99abcb3b80',
    );
  });

  it('contains every operation used by the React application', () => {
    const operations = Object.values(contract.paths)
      .flatMap((path) => Object.values(path))
      .map((operation) => operation.operationId)
      .filter(Boolean);
    expect(new Set(operations)).toEqual(expect.objectContaining(new Set(requiredOperations)));
    for (const operation of requiredOperations) expect(operations).toContain(operation);
  });

  it('keeps source-of-truth status, role, and report schemas', () => {
    expect(contract.components.schemas).toHaveProperty('AllowedActions');
    expect(contract.components.schemas).toHaveProperty('MonitorDetail');
    expect(contract.components.schemas).toHaveProperty('Report');
    expect(contract.components.schemas).toHaveProperty('IncidentSummary');
    expect(rawContract).toContain('enum: [healthy,degraded,down,unknown]');
    expect(rawContract).toContain('enum: [owner, admin, member, viewer]');
    expect(rawContract).toContain('SSE messages are refresh hints');
  });
});
