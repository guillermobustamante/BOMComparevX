'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface HistorySession {
  historyId: string;
  jobId: string;
  sessionId: string;
  sessionName: string | null;
  tagLabel: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  status: string;
}

export function HistoryPanel() {
  const historyParityEnabled =
    (process.env.NEXT_PUBLIC_HISTORY_PARITY_V1 || 'true').trim().toLowerCase() !== 'false';
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});
  const [tagDraft, setTagDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadSessions() {
    try {
      const response = await fetch('/api/history/sessions', { method: 'GET', cache: 'no-store' });
      const payload = (await response.json()) as
        | { sessions?: HistorySession[] }
        | { code?: string; message?: string };
      if (!response.ok) {
        const err = payload as { code?: string; message?: string };
        setError(`${err.code || 'HISTORY_LOAD_FAILED'}: ${err.message || 'Could not load history.'}`);
        setSessions([]);
        return;
      }

      const next = (payload as { sessions?: HistorySession[] }).sessions || [];
      setSessions(next);
      setRenameDraft((current) => {
        const updated = { ...current };
        for (const session of next) {
          if (updated[session.historyId] === undefined) {
            updated[session.historyId] = session.sessionName || '';
          }
        }
        return updated;
      });
      setTagDraft((current) => {
        const updated = { ...current };
        for (const session of next) {
          if (updated[session.historyId] === undefined) {
            updated[session.historyId] = session.tagLabel || '';
          }
        }
        return updated;
      });
    } catch {
      setError('HISTORY_LOAD_FAILED: Could not load history.');
      setSessions([]);
    }
  }

  useEffect(() => {
    if (!historyParityEnabled) return;
    void loadSessions();
  }, [historyParityEnabled]);

  async function renameSession(historyId: string) {
    const draft = (renameDraft[historyId] || '').trim();
    setError(null);
    setFeedback(null);
    const response = await fetch(`/api/history/sessions/${encodeURIComponent(historyId)}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionName: draft })
    });
    const payload = (await response.json()) as { code?: string; message?: string };
    if (!response.ok) {
      setError(`${payload.code || 'HISTORY_RENAME_FAILED'}: ${payload.message || 'Rename failed.'}`);
      return;
    }
    setFeedback('Session name updated.');
    await loadSessions();
  }

  async function updateTag(historyId: string) {
    const draft = (tagDraft[historyId] || '').trim();
    setError(null);
    setFeedback(null);
    const response = await fetch(`/api/history/sessions/${encodeURIComponent(historyId)}/tag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagLabel: draft })
    });
    const payload = (await response.json()) as { code?: string; message?: string };
    if (!response.ok) {
      setError(`${payload.code || 'HISTORY_TAG_FAILED'}: ${payload.message || 'Tag update failed.'}`);
      return;
    }
    setFeedback('Tag updated.');
    await loadSessions();
  }

  async function softDelete(historyId: string) {
    setError(null);
    setFeedback(null);
    const response = await fetch(`/api/history/sessions/${encodeURIComponent(historyId)}/delete`, {
      method: 'POST'
    });
    const payload = (await response.json()) as { code?: string; message?: string };
    if (!response.ok) {
      setError(`${payload.code || 'HISTORY_DELETE_FAILED'}: ${payload.message || 'Delete failed.'}`);
      return;
    }
    setFeedback('Session deleted.');
    await loadSessions();
  }

  if (!historyParityEnabled) {
    return (
      <section className="panel" data-testid="history-panel">
        <h1 className="h1">History</h1>
        <div className="alertWarning" data-testid="history-feature-disabled">
          HISTORY_PARITY_DISABLED: History parity operations are disabled by feature flag.
        </div>
      </section>
    );
  }

  return (
    <section className="panel" data-testid="history-panel">
      <h1 className="h1">History</h1>
      <p className="p">Rename sessions, apply private label tags, and soft-delete history entries.</p>

      {error && (
        <div className="alertError" data-testid="history-error">
          {error}
        </div>
      )}
      {feedback && (
        <div className="alertSuccess" data-testid="history-feedback">
          {feedback}
        </div>
      )}

      <div className="mappingTableWrap">
        <table className="mappingTable" data-testid="history-table">
          <thead>
            <tr>
              <th>Created</th>
              <th>Session Name</th>
              <th>Tag</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.historyId} data-testid={`history-row-${session.historyId}`}>
                <td>{new Date(session.createdAtUtc).toLocaleString()}</td>
                <td>
                  <input
                    value={renameDraft[session.historyId] || ''}
                    onChange={(event) =>
                      setRenameDraft((current) => ({
                        ...current,
                        [session.historyId]: event.target.value
                      }))
                    }
                    placeholder="Session name"
                    data-testid={`history-rename-input-${session.historyId}`}
                  />
                </td>
                <td>
                  <input
                    value={tagDraft[session.historyId] || ''}
                    onChange={(event) =>
                      setTagDraft((current) => ({
                        ...current,
                        [session.historyId]: event.target.value
                      }))
                    }
                    placeholder="Tag label"
                    data-testid={`history-tag-input-${session.historyId}`}
                  />
                </td>
                <td>{session.status}</td>
                <td>
                  <div className="actions" style={{ marginTop: 0 }}>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => void renameSession(session.historyId)}
                      data-testid={`history-rename-btn-${session.historyId}`}
                    >
                      Rename
                    </button>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => void updateTag(session.historyId)}
                      data-testid={`history-tag-btn-${session.historyId}`}
                    >
                      Save Tag
                    </button>
                    <Link
                      className="btn"
                      href={`/results?comparisonId=${encodeURIComponent(session.jobId)}&sessionId=${encodeURIComponent(session.sessionId)}`}
                      data-testid={`history-open-results-${session.historyId}`}
                    >
                      Open
                    </Link>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => void softDelete(session.historyId)}
                      data-testid={`history-delete-btn-${session.historyId}`}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={5}>No active history sessions.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

