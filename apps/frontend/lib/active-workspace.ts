'use client';

export interface ActiveWorkspaceState {
  tenantId: string;
  userEmail: string;
  sessionId: string;
  comparisonId: string | null;
  historyId: string | null;
  leftRevisionId: string | null;
  rightRevisionId: string | null;
  sessionName: string | null;
  comparisonLabel: string | null;
  updatedAtUtc: string;
}

interface ShellIdentity {
  tenantId: string;
  userEmail: string;
}

const STORAGE_PREFIX = 'bomcomparevx.activeWorkspace.v1';

function readShellIdentity(): ShellIdentity | null {
  if (typeof document === 'undefined') return null;
  const shell = document.querySelector('.missionShellRoot');
  const tenantId = shell?.getAttribute('data-tenant-id')?.trim() || '';
  const userEmail = shell?.getAttribute('data-user-email')?.trim().toLowerCase() || '';
  if (!tenantId || !userEmail) return null;
  return { tenantId, userEmail };
}

function storageKey(identity: ShellIdentity): string {
  return `${STORAGE_PREFIX}:${identity.tenantId}:${identity.userEmail}`;
}

export function readActiveWorkspace(): ActiveWorkspaceState | null {
  if (typeof window === 'undefined') return null;
  const identity = readShellIdentity();
  if (!identity) return null;
  const raw = window.localStorage.getItem(storageKey(identity));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ActiveWorkspaceState;
    if (parsed.tenantId !== identity.tenantId || parsed.userEmail !== identity.userEmail) {
      return null;
    }
    if (!parsed.sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeActiveWorkspace(
  input: Omit<ActiveWorkspaceState, 'tenantId' | 'userEmail' | 'updatedAtUtc'>
): void {
  if (typeof window === 'undefined') return;
  const identity = readShellIdentity();
  if (!identity) return;
  const next: ActiveWorkspaceState = {
    ...input,
    tenantId: identity.tenantId,
    userEmail: identity.userEmail,
    updatedAtUtc: new Date().toISOString()
  };
  window.localStorage.setItem(storageKey(identity), JSON.stringify(next));
}

export function clearActiveWorkspace(): void {
  if (typeof window === 'undefined') return;
  const identity = readShellIdentity();
  if (!identity) return;
  window.localStorage.removeItem(storageKey(identity));
}

export function buildResultsUrlFromWorkspace(workspace: {
  comparisonId: string | null;
  sessionId: string | null;
  leftRevisionId: string | null;
  rightRevisionId: string | null;
}): string | null {
  const params = new URLSearchParams();
  if (workspace.comparisonId) {
    params.set('comparisonId', workspace.comparisonId);
  } else if (workspace.leftRevisionId && workspace.rightRevisionId) {
    params.set('leftRevisionId', workspace.leftRevisionId);
    params.set('rightRevisionId', workspace.rightRevisionId);
  } else {
    return null;
  }

  if (workspace.sessionId) {
    params.set('sessionId', workspace.sessionId);
  }

  return `/results?${params.toString()}`;
}
