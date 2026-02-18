'use client';

import { useEffect, useMemo, useState } from 'react';

type MappingReviewState = 'AUTO' | 'REVIEW_REQUIRED' | 'LOW_CONFIDENCE_WARNING';

interface PreviewColumn {
  sourceColumn: string;
  canonicalField: string | null;
  strategy: 'REGISTRY_EXACT' | 'REGISTRY_FUZZY' | 'HEURISTIC' | 'MANUAL';
  confidence: number;
  reviewState: MappingReviewState;
}

interface PreviewPayload {
  contractVersion: string;
  revisionId: string;
  columns: PreviewColumn[];
  sampleRows: Array<Record<string, string | number | null>>;
  requiredFieldsStatus: Array<{ field: string; mapped: boolean; warning: boolean }>;
  canProceed: boolean;
}

const editableCanonicalOptions = [
  'part_number',
  'description',
  'quantity',
  'revision',
  'supplier',
  'cost',
  'lifecycle_status'
];

export function MappingPreviewEditor({ revisionId }: { revisionId: string }) {
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);
  const [ackWarnings, setAckWarnings] = useState(false);
  const [editedMap, setEditedMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/mappings/preview/${encodeURIComponent(revisionId)}`, {
          method: 'GET',
          cache: 'no-store'
        });
        const payload = (await response.json()) as PreviewPayload | { code?: string; message?: string };
        if (!response.ok) {
          const errorPayload = payload as { code?: string; message?: string };
          if (!mounted) return;
          setError(
            `${errorPayload.code || 'MAPPING_PREVIEW_FAILED'}: ${errorPayload.message || 'Preview failed.'}`
          );
          return;
        }
        if (!mounted) return;
        const parsed = payload as PreviewPayload;
        setPreview(parsed);
        setEditedMap(
          Object.fromEntries(
            parsed.columns.map((column) => [column.sourceColumn, column.canonicalField || ''])
          )
        );
      } catch {
        if (mounted) setError('MAPPING_PREVIEW_FAILED: Could not load mapping preview.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [revisionId]);

  const lowConfidenceRows = useMemo(() => {
    if (!preview) return [];
    return preview.columns.filter((column) => column.reviewState === 'LOW_CONFIDENCE_WARNING');
  }, [preview]);

  const hasLowConfidence = lowConfidenceRows.length > 0;
  const testIdSafe = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const canConfirm = useMemo(() => {
    if (!preview) return false;
    if (hasLowConfidence && !ackWarnings) return false;
    return true;
  }, [preview, hasLowConfidence, ackWarnings]);

  async function onConfirm() {
    if (!preview) return;
    setConfirmError(null);
    setConfirmSuccess(null);

    const payload = {
      contractVersion: preview.contractVersion,
      revisionId: preview.revisionId,
      explicitWarningAcknowledged: ackWarnings,
      mappings: preview.columns.map((column) => ({
        sourceColumn: column.sourceColumn,
        canonicalField: editedMap[column.sourceColumn] || '__unmapped__',
        reviewState: column.reviewState
      }))
    };

    const response = await fetch('/api/mappings/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = (await response.json()) as {
      code?: string;
      message?: string;
      correlationId?: string;
      mappingId?: string;
      revisionId?: string;
    };
    if (!response.ok) {
      setConfirmError(`${result.code || 'MAPPING_CONFIRM_FAILED'}: ${result.message || 'Confirm failed.'}`);
      return;
    }
    setConfirmSuccess(
      `MAPPING_CONFIRM_SUBMITTED: mappingId=${result.mappingId || 'n/a'} revisionId=${result.revisionId || preview.revisionId}`
    );
  }

  if (loading) {
    return (
      <div className="panel">
        <h1 className="h1">Mapping Preview</h1>
        <p className="p">Loading revision mapping...</p>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="panel">
        <h1 className="h1">Mapping Preview</h1>
        <div className="alertError" data-testid="mapping-preview-error">
          {error || 'Preview unavailable.'}
        </div>
      </div>
    );
  }

  return (
    <div className="panel" data-testid="mapping-preview-panel">
      <h1 className="h1">Mapping Preview</h1>
      <p className="p">Revision: {preview.revisionId}</p>

      <div className="mappingTableWrap">
        <table className="mappingTable" data-testid="mapping-table">
          <thead>
            <tr>
              <th>Source Column</th>
              <th>Mapped Canonical Field</th>
              <th>Strategy</th>
              <th>Confidence</th>
              <th>Review State</th>
            </tr>
          </thead>
          <tbody>
            {preview.columns.map((column) => (
              <tr key={column.sourceColumn} data-testid={`mapping-row-${testIdSafe(column.sourceColumn)}`}>
                <td>{column.sourceColumn}</td>
                <td>
                  <select
                    value={editedMap[column.sourceColumn] || ''}
                    onChange={(e) =>
                      setEditedMap((current) => ({
                        ...current,
                        [column.sourceColumn]: e.target.value
                      }))
                    }
                    data-testid={`mapping-select-${testIdSafe(column.sourceColumn)}`}
                  >
                    <option value="">Select field...</option>
                    {editableCanonicalOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <span className="chip">{column.strategy}</span>
                </td>
                <td>{column.confidence.toFixed(2)}</td>
                <td>
                  <span
                    className={
                      column.reviewState === 'AUTO'
                        ? 'chip chipAuto'
                        : column.reviewState === 'REVIEW_REQUIRED'
                          ? 'chip chipReview'
                          : 'chip chipWarn'
                    }
                  >
                    {column.reviewState}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mappingSampleRows" data-testid="mapping-sample-rows">
        <strong>Sample Rows</strong>
        <pre>{JSON.stringify(preview.sampleRows, null, 2)}</pre>
      </div>

      {hasLowConfidence && (
        <label className="mappingAck" data-testid="mapping-warning-ack">
          <input
            type="checkbox"
            checked={ackWarnings}
            onChange={(e) => setAckWarnings(e.currentTarget.checked)}
          />
          I acknowledge low-confidence mappings and want to proceed.
        </label>
      )}

      <div className="actions">
        <button
          type="button"
          className="btn btnPrimary"
          onClick={onConfirm}
          disabled={!canConfirm}
          data-testid="mapping-confirm-btn"
        >
          Confirm Mapping
        </button>
      </div>

      {confirmError && (
        <div className="alertError" data-testid="mapping-confirm-error">
          {confirmError}
        </div>
      )}

      {confirmSuccess && (
        <div className="alertSuccess" data-testid="mapping-confirm-success">
          {confirmSuccess}
        </div>
      )}
    </div>
  );
}
