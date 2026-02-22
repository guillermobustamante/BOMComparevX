'use client';

import { useEffect, useState } from 'react';

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

export function AdminPolicyPanel() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUserEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadAdminContext(searchQuery = '') {
    setError(null);
    const meResponse = await fetch('/api/admin/me', { method: 'GET', cache: 'no-store' });
    const mePayload = (await meResponse.json()) as { isAdmin?: boolean; code?: string; message?: string };
    if (!meResponse.ok) {
      setError(`${mePayload.code || 'ADMIN_CONTEXT_FAILED'}: ${mePayload.message || 'Could not load admin context.'}`);
      setIsAdmin(false);
      setUsers([]);
      return;
    }

    const hasAdminRole = Boolean(mePayload.isAdmin);
    setIsAdmin(hasAdminRole);
    if (!hasAdminRole) {
      setUsers([]);
      return;
    }

    const suffix = searchQuery.trim() ? `?query=${encodeURIComponent(searchQuery.trim())}` : '';
    const usersResponse = await fetch(`/api/admin/users${suffix}`, { method: 'GET', cache: 'no-store' });
    const usersPayload = (await usersResponse.json()) as
      | { users?: AdminUserEntry[] }
      | { code?: string; message?: string };
    if (!usersResponse.ok) {
      const err = usersPayload as { code?: string; message?: string };
      setError(`${err.code || 'ADMIN_USERS_FAILED'}: ${err.message || 'Could not load users.'}`);
      setUsers([]);
      return;
    }

    setUsers((usersPayload as { users?: AdminUserEntry[] }).users || []);
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
    await loadAdminContext(query);
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
    await loadAdminContext(query);
  }

  useEffect(() => {
    void loadAdminContext();
  }, []);

  return (
    <section className="panel" data-testid="admin-panel">
      <h1 className="h1">Admin</h1>
      <p className="p">Manage upload policy reset/override with DB role-claim authorization.</p>

      {error && (
        <div className="alertError" data-testid="admin-error">
          {error}
        </div>
      )}
      {feedback && (
        <div className="alertSuccess" data-testid="admin-feedback">
          {feedback}
        </div>
      )}

      {isAdmin === false && (
        <div className="alertWarning" data-testid="admin-not-authorized">
          ADMIN_REQUIRED: You do not have admin access.
        </div>
      )}

      {isAdmin && (
        <>
          <div className="resultsFilters">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search users..."
              data-testid="admin-user-search-input"
            />
            <button className="btn" type="button" onClick={() => void loadAdminContext(query)} data-testid="admin-user-search-btn">
              Search
            </button>
          </div>

          <div className="mappingTableWrap">
            <table className="mappingTable" data-testid="admin-users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Comparisons Used</th>
                  <th>Cooldown Until</th>
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
                    <td>{user.policy.cooldownUntilUtc ? new Date(user.policy.cooldownUntilUtc).toLocaleString() : '-'}</td>
                    <td>{user.policy.isUnlimited ? 'yes' : 'no'}</td>
                    <td>
                      <div className="cellChips">
                        <button
                          className="btn"
                          type="button"
                          onClick={() => void resetPolicy(user.email)}
                          data-testid={`admin-reset-${user.email}`}
                        >
                          Reset
                        </button>
                        <button
                          className="btn"
                          type="button"
                          onClick={() => void toggleUnlimited(user.email, !user.policy.isUnlimited)}
                          data-testid={`admin-toggle-unlimited-${user.email}`}
                        >
                          {user.policy.isUnlimited ? 'Disable Unlimited' : 'Enable Unlimited'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
