'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DeleteIcon, EditIcon, OpenIcon, RefreshIcon, TagIcon } from '@/components/mission-icons';

interface HistorySession {
  historyId: string;
  jobId: string;
  sessionId: string;
  sessionName: string | null;
  tagLabel: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  status: string;
  leftRevisionId?: string | null;
  rightRevisionId?: string | null;
  comparisonLabel?: string;
  latest?: boolean;
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
        <div className="alertWarning" data-testid="history-feature-disabled">
          HISTORY_PARITY_DISABLED: History parity operations are disabled by feature flag.
        </div>
      </section>
    );
  }

  return (
    <section className="panel" data-testid="history-panel">
      <div className="screenToolbar">
        <div className="screenToolbarMeta">
          <span className="missionShellEyebrow">Session archive</span>
          <p className="p">Rename sessions, apply private label tags, and soft-delete history entries.</p>
        </div>
        <div className="screenToolbarActions">
          <button
            className="screenIconAction"
            type="button"
            onClick={() => void loadSessions()}
            aria-label="Refresh history"
            title="Refresh history"
            data-testid="history-refresh-btn"
          >
            <RefreshIcon />
          </button>
        </div>
      </div>

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
                  <div className="screenRowActions">
                    <button
                      className="screenIconAction screenIconActionCompact"
                      type="button"
                      onClick={() => void renameSession(session.historyId)}
                      aria-label={`Rename ${session.sessionName || session.historyId}`}
                      title="Rename"
                      data-testid={`history-rename-btn-${session.historyId}`}
                    >
                      <EditIcon />
                    </button>
                    <button
                      className="screenIconAction screenIconActionCompact"
                      type="button"
                      onClick={() => void updateTag(session.historyId)}
                      aria-label={`Save tag for ${session.sessionName || session.historyId}`}
                      title="Save tag"
                      data-testid={`history-tag-btn-${session.historyId}`}
                    >
                      <TagIcon />
                    </button>
                    <Link
                      className="screenIconAction screenIconActionCompact"
                      href={
                        session.leftRevisionId && session.rightRevisionId
                          ? `/results?sessionId=${encodeURIComponent(session.sessionId)}&leftRevisionId=${encodeURIComponent(
                              session.leftRevisionId
                            )}&rightRevisionId=${encodeURIComponent(session.rightRevisionId)}`
                          : `/results?comparisonId=${encodeURIComponent(session.jobId)}&sessionId=${encodeURIComponent(session.sessionId)}`
                      }
                      aria-label={`Open ${session.sessionName || session.historyId}`}
                      title="Open"
                      data-testid={`history-open-results-${session.historyId}`}
                    >
                      <OpenIcon />
                    </Link>
                    <button
                      className="screenIconAction screenIconActionCompact"
                      type="button"
                      onClick={() => void softDelete(session.historyId)}
                      aria-label={`Delete ${session.sessionName || session.historyId}`}
                      title="Delete"
                      data-testid={`history-delete-btn-${session.historyId}`}
                    >
                      <DeleteIcon />
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
