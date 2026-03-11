'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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

  return (
    <section className="panel" data-testid="mapping-control-center">
      <div className="screenToolbar">
        <div className="screenToolbarMeta">
          <span className="missionShellEyebrow">Mappings</span>
          <p className="p">Review confirmed mapping snapshots and jump directly into revision-level mapping review.</p>
        </div>
      </div>

      {error ? <div className="alertError">{error}</div> : null}

      <section className="panel">
        <span className="missionShellEyebrow">Mappings</span>
        <p className="p">Open a revision preview when you already know the revision ID.</p>
        <div className="screenInlineForm">
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

      <section className="panel">
        <span className="missionShellEyebrow">Mapping Snapshot Review</span>
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
                  <td>{new Date(snapshot.confirmedAtUtc).toLocaleString()}</td>
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

      {selected ? (
        <section className="panel">
          <span className="missionShellEyebrow">Snapshot Detail</span>
          <p className="p">Revision `{selected.revisionId}` confirmed by `{selected.createdBy}` on {new Date(selected.confirmedAtUtc).toLocaleString()}.</p>
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
