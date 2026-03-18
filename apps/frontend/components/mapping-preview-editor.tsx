'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ConfirmIcon } from '@/components/mission-icons';

type MappingReviewState = 'AUTO' | 'REVIEW_REQUIRED' | 'LOW_CONFIDENCE_WARNING';
type MappingGroupId =
  | 'required_compare'
  | 'recommended_matching'
  | 'impact_classification'
  | 'preserved_unclassified';
type MappingReadiness = 'ready' | 'warning' | 'blocked';
type ImpactReadiness = 'strong' | 'partial' | 'weak';

interface PreviewColumn {
  sourceColumn: string;
  displayLabel: string;
  canonicalField: string | null;
  canonicalFieldLabel: string | null;
  suggestedBusinessMeaning: string | null;
  sampleValues: string[];
  strategy: 'REGISTRY_EXACT' | 'REGISTRY_FUZZY' | 'HEURISTIC' | 'MANUAL' | 'TENANT_PACK';
  confidence: number;
  reviewState: MappingReviewState;
  fieldClass?: 'identity' | 'comparable' | 'display' | 'business_impact' | null;
  fieldRoles: string[];
  groupId: MappingGroupId;
  consequenceLevel: 'critical' | 'important' | 'helpful' | 'informational';
  whyItMatters: string;
  proceedImpact: string;
  semanticFamily: string | null;
  classificationTags: string[];
  likelyCategories: string[];
  evidence?: {
    reasons?: string[];
    negativeSignals?: string[];
  };
}

interface PreviewPayload {
  contractVersion: string;
  revisionId: string;
  summary: {
    comparisonReadiness: MappingReadiness;
    impactReadiness: ImpactReadiness;
    unresolvedCount: number;
    lowConfidenceCriticalCount: number;
    canProceed: boolean;
    proceedLabel: string;
  };
  groups: Array<{
    id: MappingGroupId;
    label: string;
    description: string;
    counts: {
      total: number;
      unresolved: number;
      lowConfidence: number;
    };
  }>;
  columns: PreviewColumn[];
  impactReadiness: {
    recognizedTriggerColumns: number;
    semanticallyUnclassifiedColumns: string[];
    likelyCoverageNotes: string[];
  };
  recommendedActions: string[];
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

const GROUP_ORDER: MappingGroupId[] = [
  'required_compare',
  'recommended_matching',
  'impact_classification',
  'preserved_unclassified'
];

function formatReadiness(value: string): string {
  return value
    .split('_')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function testIdSafe(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function MappingPreviewEditor({ revisionId }: { revisionId: string }) {
  const searchParams = useSearchParams();
  const profile = searchParams.get('profile') || '';
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);
  const [ackWarnings, setAckWarnings] = useState(false);
  const [ackImpactCoverage, setAckImpactCoverage] = useState(false);
  const [editedMap, setEditedMap] = useState<Record<string, string>>({});

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
        setEditedMap(
          Object.fromEntries(
            parsed.columns.map((column) => [column.sourceColumn, column.canonicalField || ''])
          )
        );
      } catch {
        if (mounted) {
          setError('MAPPING_PREVIEW_FAILED: Could not load mapping preview.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void run();
    return () => {
      mounted = false;
    };
  }, [profile, revisionId]);

  const lowConfidenceRows = useMemo(
    () => preview?.columns.filter((column) => column.reviewState === 'LOW_CONFIDENCE_WARNING') || [],
    [preview]
  );
  const hasLowConfidence = lowConfidenceRows.length > 0;
  const requiresImpactAck = !!preview && preview.summary.canProceed && preview.summary.impactReadiness !== 'strong';

  const acceptedAsSuggested = useMemo(() => {
    if (!preview) return true;
    return preview.columns.every((column) => (editedMap[column.sourceColumn] || '') === (column.canonicalField || ''));
  }, [editedMap, preview]);

  const learnedAliasSuggestions = useMemo(() => {
    if (!preview) return [];
    return preview.columns
      .filter((column) => {
        const nextValue = editedMap[column.sourceColumn] || '';
        return nextValue.length > 0 && nextValue !== (column.canonicalField || '');
      })
      .map((column) => ({
        sourceColumn: column.sourceColumn,
        canonicalField: editedMap[column.sourceColumn],
        suggestedAlias: column.sourceColumn
      }));
  }, [editedMap, preview]);

  const canConfirm = !!preview &&
    (!hasLowConfidence || ackWarnings) &&
    (!requiresImpactAck || ackImpactCoverage);

  async function onConfirm() {
    if (!preview) return;

    setConfirmError(null);
    setConfirmSuccess(null);

    const confirmationMode = acceptedAsSuggested
      ? 'accepted_as_suggested'
      : hasLowConfidence
        ? 'accepted_with_warnings'
        : 'accepted_with_overrides';

    try {
      const response = await fetch('/api/mappings/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractVersion: preview.contractVersion,
          revisionId: preview.revisionId,
          explicitWarningAcknowledged: ackWarnings,
          confirmationMode,
          acceptedAsSuggested,
          impactCoverageAcknowledged: requiresImpactAck ? ackImpactCoverage : false,
          learnedAliasSuggestions,
          mappings: preview.columns.map((column) => ({
            sourceColumn: column.sourceColumn,
            canonicalField: editedMap[column.sourceColumn] || '__unmapped__',
            originalCanonicalField: column.canonicalField,
            strategy: column.strategy,
            confidence: column.confidence,
            reviewState: column.reviewState
          }))
        })
      });

      const result = (await response.json()) as {
        code?: string;
        message?: string;
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
    } catch {
      setConfirmError('MAPPING_CONFIRM_FAILED: Could not submit the mapping confirmation.');
    }
  }

  if (loading) {
    return (
      <div className="panel missionWorkspacePage missionWorkspacePageMappingPreview mappingWorkspace" data-testid="mapping-preview-panel">
        <p className="p">Loading field understanding workspace...</p>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="panel missionWorkspacePage missionWorkspacePageMappingPreview">
        <div className="alertError" data-testid="mapping-preview-error">
          {error || 'Preview unavailable.'}
        </div>
      </div>
    );
  }

  return (
    <section className="panel missionWorkspacePage missionWorkspacePageMappingPreview mappingWorkspace" data-testid="mapping-preview-panel">
      <div className="screenToolbar mappingWorkspaceHeader">
        <div className="screenToolbarMeta">
          <span className="missionShellEyebrow">Field Understanding Workspace</span>
          <h2 className="h2">Review how this BOM will be understood before comparison starts.</h2>
          <p className="p">
            Revision: <code>{preview.revisionId}</code>
          </p>
        </div>
        <div className="screenToolbarActions mappingWorkspaceHeaderActions">
          <div className={`mappingReadinessBadge mappingReadinessBadge-${preview.summary.comparisonReadiness}`}>
            Comparison {formatReadiness(preview.summary.comparisonReadiness)}
          </div>
          <button
            type="button"
            className="screenIconAction"
            onClick={() => void onConfirm()}
            disabled={!canConfirm}
            aria-label={preview.summary.proceedLabel}
            title={preview.summary.proceedLabel}
            data-testid="mapping-confirm-btn"
          >
            <ConfirmIcon />
          </button>
        </div>
      </div>

      <div className="mappingSummaryGrid" data-testid="mapping-summary-grid">
        <article className="mappingSummaryCard" data-testid="mapping-summary-card-comparison">
          <span className="mappingSummaryLabel">Comparison readiness</span>
          <strong>{formatReadiness(preview.summary.comparisonReadiness)}</strong>
          <p>{preview.summary.canProceed ? 'Safe to compare once you confirm.' : 'Resolve critical gaps first.'}</p>
        </article>
        <article className="mappingSummaryCard" data-testid="mapping-summary-card-impact">
          <span className="mappingSummaryLabel">Impact readiness</span>
          <strong>{formatReadiness(preview.summary.impactReadiness)}</strong>
          <p>{preview.impactReadiness.recognizedTriggerColumns} trigger-capable columns recognized.</p>
        </article>
        <article className="mappingSummaryCard" data-testid="mapping-summary-card-unresolved">
          <span className="mappingSummaryLabel">Unresolved items</span>
          <strong>{preview.summary.unresolvedCount}</strong>
          <p>Preserved columns that still need business meaning or mapping review.</p>
        </article>
        <article className="mappingSummaryCard" data-testid="mapping-summary-card-low-confidence">
          <span className="mappingSummaryLabel">Low-confidence critical</span>
          <strong>{preview.summary.lowConfidenceCriticalCount}</strong>
          <p>Critical suggestions that should be reviewed before you proceed.</p>
        </article>
      </div>

      <div className="mappingInsightGrid">
        <article className="mappingInsightCard" data-testid="mapping-recommended-actions">
          <h3 className="h3">What to do next</h3>
          <ul className="mappingActionList">
            {preview.recommendedActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </article>
        <article className="mappingInsightCard" data-testid="mapping-impact-readiness">
          <h3 className="h3">Impact readiness</h3>
          <ul className="mappingActionList">
            {preview.impactReadiness.likelyCoverageNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          {preview.impactReadiness.semanticallyUnclassifiedColumns.length > 0 ? (
            <p className="missionSubtle">
              Still unclassified: {preview.impactReadiness.semanticallyUnclassifiedColumns.join(', ')}
            </p>
          ) : null}
        </article>
      </div>

      <div className="mappingGroupStack">
        {GROUP_ORDER.map((groupId) => {
          const group = preview.groups.find((item) => item.id === groupId);
          const columns = preview.columns.filter((column) => column.groupId === groupId);
          if (!group || columns.length === 0) return null;

          return (
            <section className="mappingGroupSection" key={group.id} data-testid={`mapping-group-${group.id}`}>
              <div className="mappingGroupHeader">
                <div>
                  <h3 className="h3">{group.label}</h3>
                  <p className="p">{group.description}</p>
                </div>
                <div className="mappingGroupCounts">
                  <span className="chip">{group.counts.total} total</span>
                  <span className="chip">{group.counts.unresolved} unresolved</span>
                  <span className="chip">{group.counts.lowConfidence} low confidence</span>
                </div>
              </div>

              <div className="mappingColumnGrid">
                {columns.map((column) => (
                  <article
                    className={`mappingColumnCard mappingColumnCard-${column.consequenceLevel}`}
                    key={column.sourceColumn}
                    data-testid={`mapping-row-${testIdSafe(column.sourceColumn)}`}
                  >
                    <div className="mappingColumnCardTop">
                      <div>
                        <span className="missionShellEyebrow">{column.displayLabel}</span>
                        <h4 className="h3">{column.sourceColumn}</h4>
                      </div>
                      <div className="mappingColumnStatus">
                        <span className={`chip chip-${column.consequenceLevel}`}>{column.consequenceLevel}</span>
                        <span
                          className={
                            column.reviewState === 'AUTO'
                              ? 'chip chipAuto'
                              : column.reviewState === 'REVIEW_REQUIRED'
                                ? 'chip chipReview'
                                : 'chip chipWarn'
                          }
                        >
                          {formatReadiness(column.reviewState.toLowerCase())}
                        </span>
                      </div>
                    </div>

                    <div className="mappingColumnMeta">
                      <div>
                        <strong>Suggested field</strong>
                        <p>{column.canonicalFieldLabel || 'Not yet mapped'}</p>
                      </div>
                      <div>
                        <strong>Business meaning</strong>
                        <p>{column.suggestedBusinessMeaning || 'Needs review'}</p>
                      </div>
                      <div>
                        <strong>Confidence</strong>
                        <p>{column.confidence.toFixed(2)} via {column.strategy}</p>
                      </div>
                    </div>

                    <div className="mappingColumnRoles">
                      {column.fieldRoles.map((role) => (
                        <span className="chip" key={`${column.sourceColumn}-${role}`}>
                          {role}
                        </span>
                      ))}
                    </div>

                    <div className="mappingColumnSamples">
                      <strong>Sample values</strong>
                      <p>{column.sampleValues.length > 0 ? column.sampleValues.join(' | ') : 'No sample values captured.'}</p>
                    </div>

                    <div className="mappingColumnExplanation">
                      <strong>Why this matters</strong>
                      <p>{column.whyItMatters}</p>
                      <strong>Proceed impact</strong>
                      <p>{column.proceedImpact}</p>
                    </div>

                    <label className="mappingColumnSelectWrap">
                      <span>Use this field</span>
                      <select
                        value={editedMap[column.sourceColumn] || ''}
                        onChange={(event) =>
                          setEditedMap((current) => ({
                            ...current,
                            [column.sourceColumn]: event.target.value
                          }))
                        }
                        data-testid={`mapping-select-${testIdSafe(column.sourceColumn)}`}
                      >
                        <option value="">Preserve only / unresolved</option>
                        {editableCanonicalOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    {(column.semanticFamily || column.classificationTags.length > 0 || column.likelyCategories.length > 0) ? (
                      <div className="mappingTaxonomyPanel">
                        <strong>Taxonomy relevance</strong>
                        <p>
                          Family: {column.semanticFamily || 'not recognized'}
                        </p>
                        {column.classificationTags.length > 0 ? (
                          <p>Classification tags: {column.classificationTags.join(', ')}</p>
                        ) : null}
                        {column.likelyCategories.length > 0 ? (
                          <p>Likely impact categories: {column.likelyCategories.join(', ')}</p>
                        ) : null}
                      </div>
                    ) : null}

                    <details className="mappingEvidencePanel" data-testid={`mapping-explain-${testIdSafe(column.sourceColumn)}`}>
                      <summary>Why suggested?</summary>
                      <div className="mappingEvidenceBody">
                        <div>
                          <strong>Positive evidence</strong>
                          {column.evidence?.reasons?.length ? (
                            <ul className="mappingActionList">
                              {column.evidence.reasons.map((reason) => (
                                <li key={reason}>{reason}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="missionSubtle">No positive evidence captured.</p>
                          )}
                        </div>
                        <div>
                          <strong>Negative signals</strong>
                          {column.evidence?.negativeSignals?.length ? (
                            <ul className="mappingActionList">
                              {column.evidence.negativeSignals.map((signal) => (
                                <li key={signal}>{signal}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="missionSubtle">No suppressing signals captured.</p>
                          )}
                        </div>
                      </div>
                    </details>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mappingSampleRows" data-testid="mapping-sample-rows">
        <strong>Preserved source rows</strong>
        <pre>{JSON.stringify(preview.sampleRows, null, 2)}</pre>
      </div>

      {hasLowConfidence ? (
        <label className="mappingAck" data-testid="mapping-warning-ack">
          <input
            type="checkbox"
            checked={ackWarnings}
            onChange={(event) => setAckWarnings(event.currentTarget.checked)}
          />
          I reviewed the low-confidence comparison-critical suggestions and still want to proceed.
        </label>
      ) : null}

      {requiresImpactAck ? (
        <label className="mappingAck" data-testid="mapping-impact-ack">
          <input
            type="checkbox"
            checked={ackImpactCoverage}
            onChange={(event) => setAckImpactCoverage(event.currentTarget.checked)}
          />
          I understand impact classification coverage is partial and want to continue anyway.
        </label>
      ) : null}

      {learnedAliasSuggestions.length > 0 ? (
        <div className="mappingAliasSuggestions" data-testid="mapping-learned-alias-suggestions">
          <strong>Learned alias suggestions</strong>
          <p className="missionSubtle">
            These overrides will be sent as suggestions only and will not be auto-promoted for the tenant.
          </p>
          <ul className="mappingActionList">
            {learnedAliasSuggestions.map((suggestion) => (
              <li key={`${suggestion.sourceColumn}-${suggestion.canonicalField}`}>
                {suggestion.sourceColumn}
                {' -> '}
                {suggestion.canonicalField}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mappingConfirmBar">
        <p className="missionSubtle">
          {preview.summary.proceedLabel}. This records reviewer intent without auto-promoting tenant behavior.
        </p>
        <button
          type="button"
          className="btn btnPrimary"
          onClick={() => void onConfirm()}
          disabled={!canConfirm}
          data-testid="mapping-confirm-cta"
        >
          {preview.summary.proceedLabel}
        </button>
      </div>

      {confirmError ? (
        <div className="alertError" data-testid="mapping-confirm-error">
          {confirmError}
        </div>
      ) : null}

      {confirmSuccess ? (
        <div className="alertSuccess" data-testid="mapping-confirm-success">
          {confirmSuccess}
        </div>
      ) : null}
    </section>
  );
}
