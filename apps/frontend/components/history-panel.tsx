'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ActiveWorkspaceNotice } from '@/components/active-workspace-notice';
import {
  CloseIcon,
  ConfirmIcon,
  DeleteIcon,
  FileDetailsIcon,
  OpenIcon,
  RefreshIcon,
  TagIcon
} from '@/components/mission-icons';
import { readActiveWorkspace } from '@/lib/active-workspace';

interface HistorySessionEntry {
  historyId: string;
  jobId: string;
  sessionId: string;
  sessionName: string | null;
  tagLabel: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  status: string;
  initiatorEmail: string;
  comparisonId?: string | null;
  leftRevisionId?: string | null;
  rightRevisionId?: string | null;
  comparisonLabel?: string;
  comparisonDateLabel?: string;
  current?: boolean;
  latest?: boolean;
  canRename?: boolean;
  canDelete?: boolean;
}

interface HistorySessionGroup {
  sessionId: string;
  sessionName: string | null;
  latestEntry: HistorySessionEntry;
  renameTargetHistoryId: string | null;
  entries: HistorySessionEntry[];
  comparisonCount: number;
  ownerEmail: string;
  active: boolean;
}

function buildResultsUrl(entry: HistorySessionEntry): string | null {
  const params = new URLSearchParams();
  if (entry.comparisonId) {
    params.set('comparisonId', entry.comparisonId);
  } else if (entry.leftRevisionId && entry.rightRevisionId) {
    params.set('leftRevisionId', entry.leftRevisionId);
    params.set('rightRevisionId', entry.rightRevisionId);
  } else {
    return null;
  }

  params.set('sessionId', entry.sessionId);
  return `/results?${params.toString()}`;
}

function comparisonFileName(entry: Pick<HistorySessionEntry, 'comparisonLabel' | 'comparisonDateLabel'>): string {
  const label = entry.comparisonLabel || 'Comparison';
  const comparisonDateLabel = entry.comparisonDateLabel || '';
  const suffix = comparisonDateLabel ? ` (${comparisonDateLabel})` : '';
  return suffix && label.endsWith(suffix) ? label.slice(0, -suffix.length) : label;
}

function buildSessionGroups(entries: HistorySessionEntry[], activeSessionId: string | null): HistorySessionGroup[] {
  const grouped = new Map<string, HistorySessionEntry[]>();
  for (const entry of entries) {
    const current = grouped.get(entry.sessionId);
    if (current) {
      current.push(entry);
      continue;
    }
    grouped.set(entry.sessionId, [entry]);
  }

  return [...grouped.entries()]
    .map(([sessionId, sessionEntries]) => {
      const sorted = [...sessionEntries].sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc));
      const latestEntry = sorted[0];
      const renameTarget = sorted.find((entry) => entry.canRename) || null;
      return {
        sessionId,
        sessionName: latestEntry?.sessionName || null,
        latestEntry,
        renameTargetHistoryId: renameTarget?.historyId || null,
        entries: sorted,
        comparisonCount: sorted.length,
        ownerEmail: latestEntry?.initiatorEmail || 'unknown-user',
        active: activeSessionId === sessionId || sorted.some((entry) => entry.current)
      };
    })
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return b.latestEntry.createdAtUtc.localeCompare(a.latestEntry.createdAtUtc);
    });
}

export function HistoryPanel() {
  const historyParityEnabled =
    (process.env.NEXT_PUBLIC_HISTORY_PARITY_V1 || 'true').trim().toLowerCase() !== 'false';
  const [sessions, setSessions] = useState<HistorySessionEntry[]>([]);
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});
  const [tagDraft, setTagDraft] = useState<Record<string, string>>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<HistorySessionEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function loadSessions() {
    try {
      const workspace = readActiveWorkspace();
      const query = new URLSearchParams();
      if (workspace?.comparisonId) {
        query.set('currentComparisonId', workspace.comparisonId);
      }
      setActiveSessionId(workspace?.sessionId || null);

      const response = await fetch(`/api/history/sessions${query.size ? `?${query.toString()}` : ''}`, {
        method: 'GET',
        cache: 'no-store'
      });
      const payload = (await response.json()) as
        | { sessions?: HistorySessionEntry[] }
        | { code?: string; message?: string };
      if (!response.ok) {
        const err = payload as { code?: string; message?: string };
        setError(`${err.code || 'HISTORY_LOAD_FAILED'}: ${err.message || 'Could not load revision chains.'}`);
        setSessions([]);
        return;
      }

      const next = (payload as { sessions?: HistorySessionEntry[] }).sessions || [];
      setSessions(next);

      const nextRenameDraft: Record<string, string> = {};
      const nextTagDraft: Record<string, string> = {};
      for (const entry of next) {
        if (nextRenameDraft[entry.sessionId] === undefined) {
          nextRenameDraft[entry.sessionId] = entry.sessionName || '';
        }
        nextTagDraft[entry.historyId] = entry.tagLabel || '';
      }
      setRenameDraft(nextRenameDraft);
      setTagDraft(nextTagDraft);
    } catch {
      setError('HISTORY_LOAD_FAILED: Could not load revision chains.');
      setSessions([]);
    }
  }

  useEffect(() => {
    if (!historyParityEnabled) return;
    void loadSessions();
  }, [historyParityEnabled]);

  async function renameSession(historyId: string, sessionId: string) {
    const draft = (renameDraft[sessionId] || '').trim();
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
    setFeedback('Session title updated.');
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
      setError(`${payload.code || 'HISTORY_TAG_FAILED'}: ${payload.message || 'Private label update failed.'}`);
      return;
    }
    setFeedback('Private label updated.');
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
    setFeedback('Latest comparison removed.');
    setSelectedEntry((current) => (current?.historyId === historyId ? null : current));
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

  const groupedSessions = buildSessionGroups(sessions, activeSessionId);
  const selectedEntryUrl = selectedEntry ? buildResultsUrl(selectedEntry) : null;

  return (
    <section className="panel missionWorkspacePage missionWorkspacePageHistory historyChainsPanel" data-testid="history-panel">
      <ActiveWorkspaceNotice
        eyebrow="Active Session"
        message="Your last change review is available if you want to return without rebuilding the URL."
        dataTestId="history-active-workspace"
      />

      <div className="screenToolbar historyChainsToolbar">
        <div className="screenToolbarMeta">
          <span className="missionShellEyebrow">Saved comparison history</span>
          <p className="p">
            Reopen saved BOM comparisons and see how each revision chain evolved over time.
          </p>
        </div>
        <div className="screenToolbarActions">
          <span className="missionPill missionPillMeta historyChainsToolbarPill">Grouped by session</span>
          <span className="missionPill missionPillMeta historyChainsToolbarPill">Newest first</span>
          <button
            className="screenIconAction"
            type="button"
            onClick={() => void loadSessions()}
            aria-label="Refresh revision chains"
            title="Refresh revision chains"
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

      <div className="historySessionList" data-testid="history-session-list">
        {groupedSessions.map((session) => (
          <details
            className={`historySessionCard ${session.active ? 'historySessionCardActive' : ''}`}
            key={session.sessionId}
            data-testid={`history-session-${session.sessionId}`}
          >
            <summary className="historySessionSummary" data-testid={`history-session-summary-${session.sessionId}`}>
              <div className="historySessionMain">
                <div className="historySessionNameRow">
                  <div className="historySessionName">{session.sessionName || 'Untitled session'}</div>
                  {session.active ? <span className="missionPill historyPillActive">Active review</span> : null}
                  {session.latestEntry.latest ? <span className="missionPill missionPillMeta historyPillLatest">Latest saved</span> : null}
                </div>
                <div className="historySessionMeta">
                  <span>Owner: {session.ownerEmail}</span>
                  <span>Newest comparison: {comparisonFileName(session.latestEntry)}</span>
                </div>
              </div>
              <div className="historySessionMetric">
                <strong>{session.comparisonCount}</strong>
                <span>Comparisons</span>
              </div>
              <span className="historySessionToggleLabel" aria-hidden="true">View chain</span>
              <span className="historySessionToggle" aria-hidden="true" />
            </summary>

            <div className="historySessionBody">
              <div className="historySessionEditorCard">
                <p className="missionShellEyebrow">Session title</p>
                <div className="historySessionEditorRow">
                  <input
                    className="historySessionInput"
                    value={renameDraft[session.sessionId] || ''}
                    onChange={(event) =>
                      setRenameDraft((current) => ({
                        ...current,
                        [session.sessionId]: event.target.value
                      }))
                    }
                    placeholder="Untitled session"
                    readOnly={!session.renameTargetHistoryId}
                    data-testid={`history-session-name-input-${session.sessionId}`}
                  />
                  <button
                    className="btn"
                    type="button"
                    onClick={() => session.renameTargetHistoryId && void renameSession(session.renameTargetHistoryId, session.sessionId)}
                    disabled={!session.renameTargetHistoryId}
                    data-testid={`history-session-name-save-${session.sessionId}`}
                  >
                    <ConfirmIcon />
                    Save title
                  </button>
                </div>
                <p className="historySessionEditorHint">Renaming applies to the full revision chain.</p>
              </div>

              <div className="historyComparisonTimeline" data-testid={`history-session-timeline-${session.sessionId}`}>
                {session.entries.map((entry, index) => {
                  const entryUrl = buildResultsUrl(entry);
                  const comparisonNumber = session.comparisonCount - index;
                  return (
                    <article
                      className={`historyComparisonCard ${entry.current ? 'historyComparisonCardCurrent' : ''}`}
                      key={entry.historyId}
                      data-testid={`history-comparison-${entry.historyId}`}
                    >
                      <div className="historyComparisonTop">
                        <div className="historyComparisonStep">Comparison {comparisonNumber}</div>
                        <div className="historyComparisonMain">
                          <div className="historyComparisonTitle">{comparisonFileName(entry)}</div>
                          <div className="historyComparisonMeta">
                            <span>{entry.comparisonDateLabel || new Date(entry.createdAtUtc).toLocaleString()}</span>
                            <span>{entry.initiatorEmail}</span>
                          </div>
                        </div>
                        <div className="historyComparisonState">
                          <span className="missionPill missionPillMeta">{entry.status}</span>
                          {entry.current ? <span className="missionPill historyPillActive">Current</span> : null}
                          {entry.latest ? <span className="missionPill missionPillMeta historyPillLatest">Latest saved</span> : null}
                        </div>
                      </div>

                      <div className="historyComparisonActions">
                        <button
                          className="btn"
                          type="button"
                          onClick={() => setSelectedEntry(entry)}
                          aria-label={`Revision details for ${entry.comparisonLabel || entry.historyId}`}
                          title="Revision details"
                          data-testid={`history-details-open-${entry.historyId}`}
                        >
                          <FileDetailsIcon />
                          View details
                        </button>
                        {entryUrl ? (
                          <Link
                            className="btn btnPrimary"
                            href={entryUrl}
                            aria-label={`Open ${entry.comparisonLabel || entry.historyId}`}
                            title="Open comparison"
                            data-testid={`history-open-results-${entry.historyId}`}
                          >
                            <OpenIcon />
                            Open review
                          </Link>
                        ) : (
                          <button
                            className="btn"
                            type="button"
                            disabled
                            aria-label={`Open ${entry.historyId}`}
                            title="Open comparison"
                            data-testid={`history-open-results-${entry.historyId}`}
                          >
                            <OpenIcon />
                            Open review
                          </button>
                        )}
                        <button
                          className="screenIconAction screenIconActionCompact historyDeleteAction"
                          type="button"
                          onClick={() => void softDelete(entry.historyId)}
                          disabled={!entry.canDelete}
                          aria-label={`Delete ${entry.comparisonLabel || entry.historyId}`}
                          title={entry.canDelete ? 'Delete latest comparison' : 'Only the latest comparison can be deleted'}
                          data-testid={`history-delete-btn-${entry.historyId}`}
                        >
                          <DeleteIcon />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </details>
        ))}

        {groupedSessions.length === 0 ? (
          <div className="historyEmptyState" data-testid="history-empty-state">
            No revision chains are available yet.
          </div>
        ) : null}
      </div>

      {selectedEntry ? (
        <div className="screenModalLayer" role="presentation">
          <button
            className="screenModalBackdrop"
            type="button"
            aria-label="Close comparison details"
            onClick={() => setSelectedEntry(null)}
          />
          <div
            className="panel screenModalCard screenModalCardCompact missionWorkspaceDialog historyDetailsDialog"
            data-testid="history-comparison-details-dialog"
          >
            <div className="screenModalHeader">
              <div className="screenToolbarMeta">
                <p className="missionShellEyebrow">Revision Details</p>
                <h2 className="h2">{comparisonFileName(selectedEntry)}</h2>
                <p className="p">{selectedEntry.comparisonDateLabel || new Date(selectedEntry.createdAtUtc).toLocaleString()}</p>
              </div>
              <button
                className="screenIconAction screenIconActionCompact"
                type="button"
                onClick={() => setSelectedEntry(null)}
                aria-label="Close comparison details dialog"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="historyDetailsGrid">
              <div className="historyDetailsItem">
                <span>Session title</span>
                <strong>{selectedEntry.sessionName || 'Untitled session'}</strong>
              </div>
              <div className="historyDetailsItem">
                <span>Status</span>
                <strong>{selectedEntry.status}</strong>
              </div>
              <div className="historyDetailsItem">
                <span>Owner</span>
                <strong>{selectedEntry.initiatorEmail}</strong>
              </div>
              <div className="historyDetailsItem">
                <span>Markers</span>
                <strong>
                  {[selectedEntry.current ? 'Current' : null, selectedEntry.latest ? 'Latest' : null].filter(Boolean).join(' / ') || 'Completed'}
                </strong>
              </div>
            </div>

            <div className="historyDetailsLabelCard">
              <p className="missionShellEyebrow">Private label</p>
              <div className="screenInlineForm historyDetailsInlineForm">
                <input
                  value={tagDraft[selectedEntry.historyId] || ''}
                  onChange={(event) =>
                    setTagDraft((current) => ({
                      ...current,
                      [selectedEntry.historyId]: event.target.value
                    }))
                  }
                  placeholder="Add private label"
                  data-testid={`history-tag-input-${selectedEntry.historyId}`}
                />
                <button
                  className="btn"
                  type="button"
                  onClick={() => void updateTag(selectedEntry.historyId)}
                  data-testid={`history-tag-btn-${selectedEntry.historyId}`}
                >
                  <TagIcon />
                  Save label
                </button>
              </div>
            </div>

            <div className="screenDialogActions historyDetailsActions">
              {selectedEntryUrl ? (
                <Link className="btn" href={selectedEntryUrl} data-testid={`history-details-open-results-${selectedEntry.historyId}`}>
                  <OpenIcon />
                  Open comparison
                </Link>
              ) : null}
              <button
                className="btn historyDeleteButton"
                type="button"
                onClick={() => void softDelete(selectedEntry.historyId)}
                disabled={!selectedEntry.canDelete}
                data-testid={`history-details-delete-${selectedEntry.historyId}`}
              >
                <DeleteIcon />
                Delete latest
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
