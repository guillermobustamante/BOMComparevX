'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActiveWorkspaceNotice } from '@/components/active-workspace-notice';

interface MappingSnapshotSummary {
  mappingId: string;
  revisionId: string;
  confirmedAtUtc: string;
  createdBy: string;
  sourceColumnCount: number;
  mappedColumnCount: number;
  averageConfidence: number | null;
}

interface MappingSnapshotDetail {
  mappingId: string;
  revisionId: string;
  confirmedAtUtc: string;
  createdBy: string;
  mappings: Array<{
    sourceColumn: string;
    canonicalField: string | null;
    strategy?: string;
    confidence?: number;
    reviewState?: string;
  }>;
}

const mappingTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
});

function formatMappingTimestamp(value: string) {
  return mappingTimestampFormatter.format(new Date(value));
}

export function MappingControlCenter() {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<MappingSnapshotSummary[]>([]);
  const [selected, setSelected] = useState<MappingSnapshotDetail | null>(null);
  const [revisionInput, setRevisionInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function loadSnapshots() {
    setError(null);
    const response = await fetch('/api/mappings?limit=50', {
      method: 'GET',
      cache: 'no-store'
    });
    const payload = (await response.json()) as
      | { snapshots?: MappingSnapshotSummary[]; code?: string; message?: string };
    if (!response.ok) {
      setError(`${payload.code || 'MAPPING_SNAPSHOTS_FAILED'}: ${payload.message || 'Could not load mapping snapshots.'}`);
      setSnapshots([]);
      return;
    }
    setSnapshots(payload.snapshots || []);
  }

  useEffect(() => {
    void loadSnapshots();
  }, []);

  async function openSnapshot(revisionId: string) {
    setError(null);
    const response = await fetch(`/api/mappings/${encodeURIComponent(revisionId)}`, {
      method: 'GET',
      cache: 'no-store'
    });
    const payload = (await response.json()) as
      | ({ mappings?: MappingSnapshotDetail['mappings'] } & Omit<MappingSnapshotDetail, 'mappings'>)
      | { code?: string; message?: string };
    if (!response.ok) {
      const err = payload as { code?: string; message?: string };
      setError(`${err.code || 'MAPPING_SNAPSHOT_FAILED'}: ${err.message || 'Could not load mapping snapshot.'}`);
      return;
    }
    setSelected(payload as MappingSnapshotDetail);
  }

  const confidenceSnapshots = snapshots.filter((snapshot) => snapshot.averageConfidence !== null);
  const averageConfidence =
    confidenceSnapshots.length > 0
      ? (
          confidenceSnapshots.reduce((sum, snapshot) => sum + (snapshot.averageConfidence || 0), 0) /
          confidenceSnapshots.length
        ).toFixed(2)
      : '--';

  return (
    <section className="panel missionWorkspacePage missionWorkspacePageMapping" data-testid="mapping-control-center">
      <ActiveWorkspaceNotice
        eyebrow="Active Session"
        message="Mapping review stays separate from results, but you can jump back to the active session workspace at any time."
        dataTestId="mappings-active-workspace"
      />
      <div className="screenToolbar missionWorkspaceHero">
        <div className="screenToolbarMeta missionWorkspaceHeroMeta">
          <span className="missionShellEyebrow">Mapping Mission Control</span>
          <p className="p">Review confirmed mapping snapshots, open a revision directly, and keep governance decisions in the same workspace.</p>
        </div>
        <div className="screenToolbarActions missionWorkspaceHeroActions">
          <span className="missionPill">{snapshots.length} snapshots</span>
          {selected ? <span className="missionPill">Focused on {selected.revisionId}</span> : null}
          <span className="missionPill">{averageConfidence} avg confidence</span>
        </div>
      </div>

      {error ? <div className="alertError">{error}</div> : null}

      <div className="mappingCenterGrid">
        <section className="panel missionWorkspaceCard mappingCenterActionCard">
          <span className="missionShellEyebrow">Revision Access</span>
          <h2 className="h2">Open a mapping preview directly</h2>
          <p className="p">Use a revision ID when you already know which BOM needs field-understanding review.</p>
          <div className="screenInlineForm mappingCenterInlineForm">
            <input
              value={revisionInput}
              onChange={(event) => setRevisionInput(event.target.value)}
              placeholder="Revision ID"
            />
            <button
              className="btn"
              type="button"
              onClick={() => {
                const next = revisionInput.trim();
                if (next) router.push(`/mappings/${encodeURIComponent(next)}`);
              }}
            >
              Open Revision Preview
            </button>
            <button className="btn" type="button" onClick={() => void loadSnapshots()}>
              Refresh Snapshots
            </button>
          </div>
        </section>

        <section className="panel missionWorkspaceCard mappingCenterPrimary">
          <div className="missionWorkspaceCardHeader">
            <div className="missionWorkspaceCardTitleGroup">
              <span className="missionShellEyebrow">Snapshot Queue</span>
              <h2 className="h2">Confirmed mapping snapshots</h2>
            </div>
          </div>
          <div className="mappingTableWrap">
            <table className="mappingTable">
              <thead>
                <tr>
                  <th>Revision</th>
                  <th>Confirmed</th>
                  <th>By</th>
                  <th>Mapped Columns</th>
                  <th>Avg Confidence</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.mappingId}>
                    <td>{snapshot.revisionId}</td>
                    <td>{formatMappingTimestamp(snapshot.confirmedAtUtc)}</td>
                    <td>{snapshot.createdBy}</td>
                    <td>{snapshot.mappedColumnCount}/{snapshot.sourceColumnCount}</td>
                    <td>{snapshot.averageConfidence === null ? '-' : snapshot.averageConfidence.toFixed(2)}</td>
                    <td>
                      <div className="cellChips">
                        <button className="btn" type="button" onClick={() => void openSnapshot(snapshot.revisionId)}>
                          Review Snapshot
                        </button>
                        <button className="btn" type="button" onClick={() => router.push(`/mappings/${encodeURIComponent(snapshot.revisionId)}`)}>
                          Open Mapping
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {snapshots.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No confirmed mapping snapshots yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selected ? (
        <section className="panel missionWorkspaceCard mappingCenterDetailCard">
          <div className="missionWorkspaceCardHeader">
            <div className="missionWorkspaceCardTitleGroup">
              <span className="missionShellEyebrow">Snapshot Detail</span>
              <h2 className="h2">Revision {selected.revisionId}</h2>
              <p className="p">Confirmed by {selected.createdBy} on {formatMappingTimestamp(selected.confirmedAtUtc)}.</p>
            </div>
          </div>
          <div className="mappingTableWrap">
            <table className="mappingTable">
              <thead>
                <tr>
                  <th>Source Column</th>
                  <th>Canonical Field</th>
                  <th>Strategy</th>
                  <th>Confidence</th>
                  <th>Review State</th>
                </tr>
              </thead>
              <tbody>
                {selected.mappings.map((mapping) => (
                  <tr key={mapping.sourceColumn}>
                    <td>{mapping.sourceColumn}</td>
                    <td>{mapping.canonicalField || '-'}</td>
                    <td>{mapping.strategy || '-'}</td>
                    <td>{typeof mapping.confidence === 'number' ? mapping.confidence.toFixed(2) : '-'}</td>
                    <td>{mapping.reviewState || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  );
}
