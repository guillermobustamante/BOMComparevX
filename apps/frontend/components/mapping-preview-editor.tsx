'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ConfirmIcon } from '@/components/mission-icons';

type MappingReviewState = 'AUTO' | 'REVIEW_REQUIRED' | 'LOW_CONFIDENCE_WARNING';

interface PreviewColumn {
  sourceColumn: string;
  canonicalField: string | null;
  strategy: 'REGISTRY_EXACT' | 'REGISTRY_FUZZY' | 'HEURISTIC' | 'MANUAL' | 'TENANT_PACK';
  confidence: number;
  reviewState: MappingReviewState;
  fieldClass?: 'identity' | 'comparable' | 'display' | 'business_impact' | null;
  evidence?: {
    reasons?: string[];
    negativeSignals?: string[];
  };
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
  'lifecycle_status',
  'unit_of_measure',
  'find_number',
  'assembly',
  'parent_path',
  'plant',
  'make_buy',
  'material',
  'finish',
  'weight',
  'effectivity',
  'effectivity_from',
  'effectivity_to',
  'serial_range',
  'drawing_number',
  'manufacturer_part_number',
  'customer_part_number',
  'compliance_status',
  'hazard_class',
  'location',
  'discipline',
  'work_center',
  'procurement_type',
  'lead_time',
  'material_group',
  'routing_ref',
  'alternate_part',
  'program',
  'vehicle_line',
  'option_code',
  'engineering_level',
  'change_notice',
  'supplier_code',
  'ppap_status',
  'tooling_status',
  'service_part_flag',
  'dash_number',
  'tail_number',
  'lot',
  'configuration_state',
  'criticality',
  'airworthiness_class',
  'approved_supplier',
  'reference_designator',
  'footprint',
  'package',
  'manufacturer',
  'avl',
  'rohs',
  'reach',
  'lifecycle_risk',
  'substitute_part',
  'asset_id',
  'system',
  'spec_section',
  'level',
  'zone',
  'room',
  'ifc_class',
  'cobie_attribute',
  'install_phase',
  'revision_package'
];

export function MappingPreviewEditor({ revisionId }: { revisionId: string }) {
  const searchParams = useSearchParams();
  const profile = searchParams.get('profile') || '';
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);
  const [ackWarnings, setAckWarnings] = useState(false);
  const [editedMap, setEditedMap] = useState<Record<string, string>>({});
  const [selectedColumn, setSelectedColumn] = useState<PreviewColumn | null>(null);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const previewUrl = `/api/mappings/preview/${encodeURIComponent(revisionId)}${
          profile ? `?profile=${encodeURIComponent(profile)}` : ''
        }`;
        const response = await fetch(previewUrl, {
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
        setSelectedColumn(parsed.columns[0] || null);
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
  }, [revisionId, profile]);

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
        <p className="p">Loading revision mapping...</p>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="panel">
        <div className="alertError" data-testid="mapping-preview-error">
          {error || 'Preview unavailable.'}
        </div>
      </div>
    );
  }

  return (
    <div className="panel" data-testid="mapping-preview-panel">
      <div className="screenToolbar">
        <div className="screenToolbarMeta">
          <span className="missionShellEyebrow">Confidence review</span>
          <p className="p">Revision: {preview.revisionId}</p>
        </div>
        <div className="screenToolbarActions">
          <button
            type="button"
            className="screenIconAction"
            onClick={() => void onConfirm()}
            disabled={!canConfirm}
            aria-label="Confirm mapping"
            title="Confirm mapping"
            data-testid="mapping-confirm-btn"
          >
            <ConfirmIcon />
          </button>
        </div>
      </div>

      <div className="mappingTableWrap">
        <table className="mappingTable" data-testid="mapping-table">
          <thead>
            <tr>
              <th>Source Column</th>
              <th>Mapped Canonical Field</th>
              <th>Strategy</th>
              <th>Confidence</th>
              <th>Review State</th>
              <th>Explain</th>
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
                  {column.fieldClass ? (
                    <div className="missionSubtle">{column.fieldClass}</div>
                  ) : null}
                  {column.evidence?.reasons?.length ? (
                    <div className="missionSubtle">{column.evidence.reasons.join(', ')}</div>
                  ) : null}
                  {column.evidence?.negativeSignals?.length ? (
                    <div className="missionSubtle">{column.evidence.negativeSignals.join(', ')}</div>
                  ) : null}
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
                <td>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setSelectedColumn(column)}
                    data-testid={`mapping-explain-${testIdSafe(column.sourceColumn)}`}
                  >
                    Explain
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedColumn ? (
        <div className="panel" data-testid="mapping-explainability-panel">
          <strong>Explainability Diagnostics</strong>
          <p className="p">
            Review how the system scored <code>{selectedColumn.sourceColumn}</code> before you accept or override it.
          </p>
          <div className="mappingTableWrap">
            <table className="mappingTable">
              <tbody>
                <tr>
                  <th>Suggested field</th>
                  <td>{selectedColumn.canonicalField || 'unmapped'}</td>
                </tr>
                <tr>
                  <th>Strategy</th>
                  <td>{selectedColumn.strategy}</td>
                </tr>
                <tr>
                  <th>Confidence</th>
                  <td>{selectedColumn.confidence.toFixed(2)}</td>
                </tr>
                <tr>
                  <th>Review state</th>
                  <td>{selectedColumn.reviewState}</td>
                </tr>
                <tr>
                  <th>Field class</th>
                  <td>{selectedColumn.fieldClass || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="screenStack">
            <div>
              <strong>Positive evidence</strong>
              {selectedColumn.evidence?.reasons?.length ? (
                <ul>
                  {selectedColumn.evidence.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="missionSubtle">No positive evidence captured.</p>
              )}
            </div>
            <div>
              <strong>Suppression / negative signals</strong>
              {selectedColumn.evidence?.negativeSignals?.length ? (
                <ul>
                  {selectedColumn.evidence.negativeSignals.map((signal) => (
                    <li key={signal}>{signal}</li>
                  ))}
                </ul>
              ) : (
                <p className="missionSubtle">No suppressing signals captured.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

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
