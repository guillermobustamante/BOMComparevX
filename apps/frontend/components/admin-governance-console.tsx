'use client';

import { useEffect, useMemo, useState } from 'react';

interface AdminContextPayload {
  isAdmin?: boolean;
  canBootstrapAdmin?: boolean;
  code?: string;
  message?: string;
}

interface AdminUserEntry {
  email: string;
  isAdmin: boolean;
  policy: {
    comparisonsUsed: number;
    unrestrictedComparisonsRemaining: number;
    cooldownUntilUtc: string | null;
    isUnlimited: boolean;
  };
}

interface AuditArchiveRun {
  archiveId: string;
  archiveDateUtc: string;
  triggeredAtUtc: string;
  triggeredBy: string;
  storageTarget: 'local' | 'azure_blob_grs';
  artifactUri: string;
  recordCount: number;
  retentionYears: number;
}

interface LearnedAlias {
  normalizedSourceColumn: string;
  canonicalField: string;
  confirmations: number;
  isEnabled: boolean;
  confidenceBand: 'emerging' | 'trusted' | 'established';
}

interface RetentionResult {
  deletedExportArtifacts: number;
  deletedNotifications: number;
  deletedRevokedShares: number;
  sweptAtUtc: string;
}

export function AdminGovernanceConsole() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [canBootstrapAdmin, setCanBootstrapAdmin] = useState(false);
  const [users, setUsers] = useState<AdminUserEntry[]>([]);
  const [archiveRuns, setArchiveRuns] = useState<AuditArchiveRun[]>([]);
  const [aliases, setAliases] = useState<LearnedAlias[]>([]);
  const [query, setQuery] = useState('');
  const [aliasQuery, setAliasQuery] = useState('');
  const [retentionNowUtcIso, setRetentionNowUtcIso] = useState('');
  const [retentionResult, setRetentionResult] = useState<RetentionResult | null>(null);
  const [auditFormat, setAuditFormat] = useState<'csv' | 'ndjson'>('csv');
  const [auditLimit, setAuditLimit] = useState('250');
  const [auditActionType, setAuditActionType] = useState('');
  const [auditActorEmail, setAuditActorEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const activeAdminCount = useMemo(() => users.filter((user) => user.isAdmin).length, [users]);

  async function loadAdminContext(searchQuery = query, aliasSearch = aliasQuery) {
    setError(null);
    const meResponse = await fetch('/api/admin/me', { method: 'GET', cache: 'no-store' });
    const mePayload = (await meResponse.json()) as AdminContextPayload;
    if (!meResponse.ok) {
      setError(`${mePayload.code || 'ADMIN_CONTEXT_FAILED'}: ${mePayload.message || 'Could not load admin context.'}`);
      setIsAdmin(false);
      setCanBootstrapAdmin(false);
      setUsers([]);
      setArchiveRuns([]);
      setAliases([]);
      return;
    }

    const hasAdminRole = Boolean(mePayload.isAdmin);
    const bootstrapAllowed = Boolean(mePayload.canBootstrapAdmin);
    setIsAdmin(hasAdminRole);
    setCanBootstrapAdmin(bootstrapAllowed);
    if (!hasAdminRole) {
      setUsers([]);
      setArchiveRuns([]);
      setAliases([]);
      return;
    }

    const usersSuffix = searchQuery.trim() ? `?query=${encodeURIComponent(searchQuery.trim())}` : '';
    const aliasesSuffix = aliasSearch.trim() ? `?query=${encodeURIComponent(aliasSearch.trim())}` : '';

    const [usersResponse, archiveResponse, aliasesResponse] = await Promise.all([
      fetch(`/api/admin/users${usersSuffix}`, { method: 'GET', cache: 'no-store' }),
      fetch('/api/admin/audit/archive/runs?limit=20', { method: 'GET', cache: 'no-store' }),
      fetch(`/api/admin/mapping-governance/aliases${aliasesSuffix}`, { method: 'GET', cache: 'no-store' })
    ]);

    const usersPayload = (await usersResponse.json()) as
      | { users?: AdminUserEntry[]; code?: string; message?: string };
    if (!usersResponse.ok) {
      setError(`${usersPayload.code || 'ADMIN_USERS_FAILED'}: ${usersPayload.message || 'Could not load users.'}`);
      setUsers([]);
    } else {
      setUsers(usersPayload.users || []);
    }

    const archivePayload = (await archiveResponse.json()) as
      | { runs?: AuditArchiveRun[]; code?: string; message?: string };
    if (archiveResponse.ok) {
      setArchiveRuns(archivePayload.runs || []);
    }

    const aliasesPayload = (await aliasesResponse.json()) as
      | { aliases?: LearnedAlias[]; code?: string; message?: string };
    if (aliasesResponse.ok) {
      setAliases(aliasesPayload.aliases || []);
    }
  }

  useEffect(() => {
    void loadAdminContext();
  }, []);

  async function claimBootstrapAdmin() {
    setError(null);
    setFeedback(null);
    const response = await fetch('/api/admin/roles/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const payload = (await response.json()) as { code?: string; message?: string; userEmail?: string };
    if (!response.ok) {
      setError(`${payload.code || 'ADMIN_BOOTSTRAP_FAILED'}: ${payload.message || 'Could not claim admin.'}`);
      return;
    }
    setFeedback(`Admin access granted to ${payload.userEmail || 'current user'}.`);
    await loadAdminContext();
  }

  async function grantAdmin(userEmail: string) {
    setError(null);
    setFeedback(null);
    const response = await fetch('/api/admin/roles/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail })
    });
    const payload = (await response.json()) as { code?: string; message?: string };
    if (!response.ok) {
      setError(`${payload.code || 'ADMIN_ROLE_GRANT_FAILED'}: ${payload.message || 'Grant failed.'}`);
      return;
    }
    setFeedback(`Granted admin to ${userEmail}.`);
    await loadAdminContext();
  }

  async function revokeAdmin(userEmail: string) {
    setError(null);
    setFeedback(null);
    const response = await fetch('/api/admin/roles/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail })
    });
    const payload = (await response.json()) as { code?: string; message?: string };
    if (!response.ok) {
      setError(`${payload.code || 'ADMIN_ROLE_REVOKE_FAILED'}: ${payload.message || 'Revoke failed.'}`);
      return;
    }
    setFeedback(`Revoked admin from ${userEmail}.`);
    await loadAdminContext();
  }

  async function resetPolicy(userEmail: string) {
    setError(null);
    setFeedback(null);
    const response = await fetch('/api/admin/upload-policy/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail })
    });
    const payload = (await response.json()) as { code?: string; message?: string };
    if (!response.ok) {
      setError(`${payload.code || 'ADMIN_POLICY_RESET_FAILED'}: ${payload.message || 'Reset failed.'}`);
      return;
    }
    setFeedback(`Reset policy for ${userEmail}.`);
    await loadAdminContext();
  }

  async function toggleUnlimited(userEmail: string, nextUnlimited: boolean) {
    setError(null);
    setFeedback(null);
    const response = await fetch('/api/admin/upload-policy/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail, isUnlimited: nextUnlimited, reason: 'admin-ui' })
    });
    const payload = (await response.json()) as { code?: string; message?: string };
    if (!response.ok) {
      setError(`${payload.code || 'ADMIN_POLICY_OVERRIDE_FAILED'}: ${payload.message || 'Override failed.'}`);
      return;
    }
    setFeedback(`${nextUnlimited ? 'Enabled' : 'Disabled'} unlimited for ${userEmail}.`);
    await loadAdminContext();
  }

  async function runRetentionSweep() {
    setError(null);
    setFeedback(null);
    const response = await fetch('/api/admin/retention/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nowUtcIso: retentionNowUtcIso || undefined })
    });
    const payload = (await response.json()) as
      | ({ ok?: boolean } & RetentionResult)
      | { code?: string; message?: string };
    if (!response.ok) {
      const err = payload as { code?: string; message?: string };
      setError(`${err.code || 'ADMIN_RETENTION_FAILED'}: ${err.message || 'Retention sweep failed.'}`);
      return;
    }
    setRetentionResult(payload as RetentionResult);
    setFeedback('Retention sweep completed.');
  }

  async function runArchive() {
    setError(null);
    setFeedback(null);
    const response = await fetch('/api/admin/audit/archive/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const payload = (await response.json()) as { code?: string; message?: string };
    if (!response.ok) {
      setError(`${payload.code || 'ADMIN_AUDIT_ARCHIVE_FAILED'}: ${payload.message || 'Archive failed.'}`);
      return;
    }
    setFeedback('Audit archive run completed.');
    await loadAdminContext();
  }

  async function toggleAlias(alias: LearnedAlias, nextEnabled: boolean) {
    setError(null);
    setFeedback(null);
    const response = await fetch('/api/admin/mapping-governance/aliases/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        normalizedSourceColumn: alias.normalizedSourceColumn,
        canonicalField: alias.canonicalField,
        isEnabled: nextEnabled
      })
    });
    const payload = (await response.json()) as { code?: string; message?: string };
    if (!response.ok) {
      setError(`${payload.code || 'ADMIN_ALIAS_UPDATE_FAILED'}: ${payload.message || 'Alias update failed.'}`);
      return;
    }
    setFeedback(`${nextEnabled ? 'Enabled' : 'Disabled'} tenant alias ${alias.normalizedSourceColumn} -> ${alias.canonicalField}.`);
    await loadAdminContext();
  }

  function downloadAuditExport() {
    const params = new URLSearchParams();
    params.set('format', auditFormat);
    if (auditLimit.trim()) params.set('limit', auditLimit.trim());
    if (auditActionType.trim()) params.set('actionType', auditActionType.trim());
    if (auditActorEmail.trim()) params.set('actorEmail', auditActorEmail.trim());
    window.open(`/api/admin/audit/export?${params.toString()}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="panel" data-testid="admin-governance-console">
      <div className="screenToolbar">
        <div className="screenToolbarMeta">
          <span className="missionShellEyebrow">Governance</span>
          <p className="p">Access control, audit operations, retention, and tenant mapping stewardship.</p>
        </div>
      </div>

      {error ? <div className="alertError">{error}</div> : null}
      {feedback ? <div className="alertSuccess">{feedback}</div> : null}

      {isAdmin === false && canBootstrapAdmin && (
        <section className="panel">
          <span className="missionShellEyebrow">Admin &gt; Access &amp; Roles</span>
          <p className="p">This tenant has no active admin. Claim the first tenant admin role to unlock the governance workspace.</p>
          <button className="btn" type="button" onClick={() => void claimBootstrapAdmin()}>
            Claim Tenant Admin
          </button>
        </section>
      )}

      {isAdmin === false && !canBootstrapAdmin && (
        <div className="alertWarning" data-testid="admin-not-authorized">
          ADMIN_REQUIRED: You do not have admin access.
        </div>
      )}

      {isAdmin && (
        <div className="screenStack">
          <section className="panel">
            <span className="missionShellEyebrow">Admin &gt; Access &amp; Roles</span>
            <p className="p">Grant or revoke tenant admin access while keeping user policy controls in the same operating view.</p>
            <div className="screenInlineForm">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search users..."
              />
              <button className="btn" type="button" onClick={() => void loadAdminContext(query, aliasQuery)}>
                Refresh Users
              </button>
            </div>
            <p className="missionSubtle">Active admins: {activeAdminCount}</p>
            <div className="mappingTableWrap">
              <table className="mappingTable">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Comparisons Used</th>
                    <th>Unlimited</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.email}>
                      <td>{user.email}</td>
                      <td>{user.isAdmin ? 'admin' : 'user'}</td>
                      <td>{user.policy.comparisonsUsed}</td>
                      <td>{user.policy.isUnlimited ? 'yes' : 'no'}</td>
                      <td>
                        <div className="cellChips">
                          <button className="btn" type="button" onClick={() => void (user.isAdmin ? revokeAdmin(user.email) : grantAdmin(user.email))}>
                            {user.isAdmin ? 'Revoke Admin' : 'Grant Admin'}
                          </button>
                          <button className="btn" type="button" onClick={() => void resetPolicy(user.email)}>
                            Reset Policy
                          </button>
                          <button className="btn" type="button" onClick={() => void toggleUnlimited(user.email, !user.policy.isUnlimited)}>
                            {user.policy.isUnlimited ? 'Disable Unlimited' : 'Enable Unlimited'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No users found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <span className="missionShellEyebrow">Admin &gt; Audit &amp; Compliance</span>
            <p className="p">Export tenant audit evidence and manage append-only archive runs from one place.</p>
            <div className="screenInlineForm">
              <select value={auditFormat} onChange={(event) => setAuditFormat(event.target.value as 'csv' | 'ndjson')}>
                <option value="csv">CSV</option>
                <option value="ndjson">NDJSON</option>
              </select>
              <input value={auditLimit} onChange={(event) => setAuditLimit(event.target.value)} placeholder="Limit" />
              <input value={auditActionType} onChange={(event) => setAuditActionType(event.target.value)} placeholder="Action type" />
              <input value={auditActorEmail} onChange={(event) => setAuditActorEmail(event.target.value)} placeholder="Actor email" />
              <button className="btn" type="button" onClick={downloadAuditExport}>
                Export Audit
              </button>
              <button className="btn" type="button" onClick={() => void runArchive()}>
                Run Archive
              </button>
            </div>
            <div className="mappingTableWrap">
              <table className="mappingTable">
                <thead>
                  <tr>
                    <th>Archive Date</th>
                    <th>Triggered</th>
                    <th>By</th>
                    <th>Records</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {archiveRuns.map((run) => (
                    <tr key={run.archiveId}>
                      <td>{run.archiveDateUtc}</td>
                      <td>{new Date(run.triggeredAtUtc).toLocaleString()}</td>
                      <td>{run.triggeredBy}</td>
                      <td>{run.recordCount}</td>
                      <td>{run.storageTarget}</td>
                    </tr>
                  ))}
                  {archiveRuns.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No archive runs yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <span className="missionShellEyebrow">Admin &gt; Data Retention</span>
            <p className="p">Run a manual retention sweep and review what was removed.</p>
            <div className="screenInlineForm">
              <input
                value={retentionNowUtcIso}
                onChange={(event) => setRetentionNowUtcIso(event.target.value)}
                placeholder="Optional nowUtcIso"
              />
              <button className="btn" type="button" onClick={() => void runRetentionSweep()}>
                Run Retention Sweep
              </button>
            </div>
            {retentionResult ? (
              <div className="mappingTableWrap">
                <table className="mappingTable">
                  <tbody>
                    <tr>
                      <th>Deleted export artifacts</th>
                      <td>{retentionResult.deletedExportArtifacts}</td>
                    </tr>
                    <tr>
                      <th>Deleted notifications</th>
                      <td>{retentionResult.deletedNotifications}</td>
                    </tr>
                    <tr>
                      <th>Deleted revoked shares</th>
                      <td>{retentionResult.deletedRevokedShares}</td>
                    </tr>
                    <tr>
                      <th>Swept at</th>
                      <td>{new Date(retentionResult.sweptAtUtc).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section className="panel">
            <span className="missionShellEyebrow">Admin &gt; Mapping Governance</span>
            <p className="p">Review tenant-learned aliases, keep the good ones enabled, and suppress noisy ones.</p>
            <div className="screenInlineForm">
              <input
                value={aliasQuery}
                onChange={(event) => setAliasQuery(event.target.value)}
                placeholder="Search learned aliases..."
              />
              <button className="btn" type="button" onClick={() => void loadAdminContext(query, aliasQuery)}>
                Refresh Aliases
              </button>
            </div>
            <div className="mappingTableWrap">
              <table className="mappingTable">
                <thead>
                  <tr>
                    <th>Source Header</th>
                    <th>Canonical Field</th>
                    <th>Confirmations</th>
                    <th>Confidence Band</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {aliases.map((alias) => (
                    <tr key={`${alias.normalizedSourceColumn}-${alias.canonicalField}`}>
                      <td>{alias.normalizedSourceColumn}</td>
                      <td>{alias.canonicalField}</td>
                      <td>{alias.confirmations}</td>
                      <td>{alias.confidenceBand}</td>
                      <td>{alias.isEnabled ? 'enabled' : 'disabled'}</td>
                      <td>
                        <button className="btn" type="button" onClick={() => void toggleAlias(alias, !alias.isEnabled)}>
                          {alias.isEnabled ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {aliases.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No tenant-learned aliases yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
