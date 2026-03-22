'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircleIcon,
  CloseIcon,
  OpenIcon,
  RunIcon,
  UploadTrayIcon
} from '@/components/mission-icons';

interface ValidationError {
  code?: string;
  message?: string;
  correlationId?: string;
  cooldownUntilUtc?: string;
  comparisonsUsed?: number;
  unrestrictedComparisonsRemaining?: number;
}

interface ValidationWarning {
  code: string;
  message: string;
  file?: 'fileA' | 'fileB';
  selectedSheetName?: string;
}

interface ValidationSuccess {
  accepted: true;
  correlationId: string;
  files: {
    fileA: { name: string; size: number };
    fileB: { name: string; size: number };
  };
  warnings: ValidationWarning[];
  fallbackParserUsed: boolean;
  sheetSelections: {
    fileA: string | null;
    fileB: string | null;
  };
  policy?: {
    comparisonsUsed: number;
    unrestrictedComparisonsRemaining: number;
    cooldownUntilUtc: string | null;
    isUnlimited: boolean;
  };
}

interface IntakeSuccess {
  jobId: string;
  sessionId: string;
  leftRevisionId: string | null;
  rightRevisionId: string | null;
  historyId: string | null;
  status: 'accepted';
  correlationId: string;
  idempotentReplay: boolean;
}

interface UploadFeedbackDialog {
  title: string;
  eyebrow: string;
  details: string[];
}

interface SheetOption {
  name: string;
  preferred: boolean;
}

interface WorkbookMetadataSuccess {
  fileKind: 'csv' | 'workbook';
  visibleSheets: SheetOption[];
  selectedSheetName: string;
  dropdownDisabled: boolean;
}

interface SheetSelectorState {
  fileKind: 'csv' | 'workbook' | null;
  options: SheetOption[];
  selectedSheetName: string;
  dropdownDisabled: boolean;
  isLoading: boolean;
}

type RevisionSlot = 'a' | 'b';

interface DisplayValidationWarning {
  message: string;
  selectedSheetName?: string;
  files: Array<'fileA' | 'fileB'>;
}

function formatFileSize(value: number): string {
  if (value < 1024) return `${value} Bytes`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function emptySheetSelectorState(label = 'Select file first'): SheetSelectorState {
  return {
    fileKind: null,
    options: [{ name: label, preferred: true }],
    selectedSheetName: '',
    dropdownDisabled: true,
    isLoading: false
  };
}

function loadingSheetSelectorState(): SheetSelectorState {
  return {
    fileKind: null,
    options: [{ name: 'Loading sheets...', preferred: true }],
    selectedSheetName: '',
    dropdownDisabled: true,
    isLoading: true
  };
}

function fileLabel(file: 'fileA' | 'fileB'): string {
  return file === 'fileA' ? 'Revision A' : 'Revision B';
}

export function UploadValidationForm() {
  const router = useRouter();
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [sheetSelectorA, setSheetSelectorA] = useState<SheetSelectorState>(() => emptySheetSelectorState());
  const [sheetSelectorB, setSheetSelectorB] = useState<SheetSelectorState>(() => emptySheetSelectorState());
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);
  const [warningDialogOpen, setWarningDialogOpen] = useState(false);
  const [isMasterDragActive, setIsMasterDragActive] = useState(false);
  const [activeRevisionDrop, setActiveRevisionDrop] = useState<RevisionSlot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQueueing, setIsQueueing] = useState(false);
  const [error, setError] = useState<ValidationError | null>(null);
  const [success, setSuccess] = useState<ValidationSuccess | null>(null);
  const [intakeSuccess, setIntakeSuccess] = useState<IntakeSuccess | null>(null);
  const [blockedUntilUtc, setBlockedUntilUtc] = useState<string | null>(null);
  const [feedbackDialog, setFeedbackDialog] = useState<UploadFeedbackDialog | null>(null);
  const [resultsLinkAcknowledged, setResultsLinkAcknowledged] = useState(false);
  const [isAutoOpeningResults, setIsAutoOpeningResults] = useState(false);

  const isBlocked = useMemo(() => !!blockedUntilUtc, [blockedUntilUtc]);
  const selectorsReady = useMemo(
    () =>
      !!fileA &&
      !!fileB &&
      !sheetSelectorA.isLoading &&
      !sheetSelectorB.isLoading &&
      !!sheetSelectorA.selectedSheetName &&
      !!sheetSelectorB.selectedSheetName,
    [fileA, fileB, sheetSelectorA, sheetSelectorB]
  );
  const canSubmit = useMemo(
    () => selectorsReady && !isSubmitting && !isQueueing && !isBlocked,
    [selectorsReady, isSubmitting, isQueueing, isBlocked]
  );
  const displayValidationWarnings = useMemo<DisplayValidationWarning[]>(() => {
    const grouped = new Map<string, DisplayValidationWarning>();
    for (const warning of validationWarnings) {
      const key = `${warning.code}::${warning.message}::${warning.selectedSheetName || ''}`;
      const existing = grouped.get(key);
      if (existing) {
        if (warning.file && !existing.files.includes(warning.file)) {
          existing.files.push(warning.file);
        }
        continue;
      }
      grouped.set(key, {
        message: warning.message,
        selectedSheetName: warning.selectedSheetName,
        files: warning.file ? [warning.file] : []
      });
    }
    return Array.from(grouped.values()).map((warning) => ({
      ...warning,
      files: [...warning.files].sort()
    }));
  }, [validationWarnings]);

  function applyFileToSlot(slot: RevisionSlot, nextFile: File | null) {
    if (slot === 'a') {
      applyPickedFiles(nextFile, fileB);
      return;
    }
    applyPickedFiles(fileA, nextFile);
  }

  function applyPickedFiles(nextFileA: File | null, nextFileB: File | null) {
    const revisionAChanged = nextFileA !== fileA;
    const revisionBChanged = nextFileB !== fileB;
    setFileA(nextFileA);
    setFileB(nextFileB);
    if (revisionAChanged) {
      setSheetSelectorA(nextFileA ? loadingSheetSelectorState() : emptySheetSelectorState());
    }
    if (revisionBChanged) {
      setSheetSelectorB(nextFileB ? loadingSheetSelectorState() : emptySheetSelectorState());
    }
    setValidationWarnings([]);
    setWarningDialogOpen(false);
    setError(null);
    setSuccess(null);
    setIntakeSuccess(null);
    setResultsLinkAcknowledged(false);
    setIsAutoOpeningResults(false);
  }

  function openIssueDialog(eyebrow: string, title: string, nextError: ValidationError) {
    const details = [nextError.message || 'Request failed.'];
    if (nextError.code) details.unshift(`Code: ${nextError.code}`);
    if (nextError.correlationId) details.push(`Correlation ID: ${nextError.correlationId}`);
    if (nextError.cooldownUntilUtc) {
      details.push(`Cooldown until: ${new Date(nextError.cooldownUntilUtc).toUTCString()}`);
    }
    if (typeof nextError.comparisonsUsed === 'number') {
      details.push(`Comparisons used: ${nextError.comparisonsUsed}`);
    }
    if (typeof nextError.unrestrictedComparisonsRemaining === 'number') {
      details.push(`Remaining unrestricted comparisons: ${nextError.unrestrictedComparisonsRemaining}`);
    }
    setFeedbackDialog({ eyebrow, title, details });
  }

  async function discoverWorkbookMetadata(file: File, slot: RevisionSlot): Promise<SheetSelectorState> {
    const form = new FormData();
    form.append('file', file);
    const response = await fetch('/api/uploads/workbook-metadata', {
      method: 'POST',
      body: form
    });
    const payload = (await response.json()) as ValidationError | WorkbookMetadataSuccess;
    if (!response.ok) {
      throw payload;
    }
    const parsed = payload as WorkbookMetadataSuccess;
    return {
      fileKind: parsed.fileKind,
      options: parsed.visibleSheets.length ? parsed.visibleSheets : [{ name: 'No visible sheets', preferred: true }],
      selectedSheetName: parsed.selectedSheetName,
      dropdownDisabled: parsed.dropdownDisabled,
      isLoading: false
    };
  }

  function applyDroppedFiles(dropped: FileList | null) {
    const droppedFiles = Array.from(dropped || []);
    if (droppedFiles.length === 0) return;
    if (droppedFiles.length > 2) {
      const nextError = {
        code: 'UPLOAD_FILE_COUNT_INVALID',
        message: 'Drop one or two files only.'
      };
      setError(nextError);
      openIssueDialog('Upload intake', 'Dropzone issue', nextError);
      return;
    }

    if (droppedFiles.length === 2) {
      applyPickedFiles(droppedFiles[0], droppedFiles[1]);
      return;
    }

    const one = droppedFiles[0];
    if (!fileA) {
      applyPickedFiles(one, fileB);
      return;
    }
    if (!fileB) {
      applyPickedFiles(fileA, one);
      return;
    }
    applyPickedFiles(fileA, one);
  }

  function applyDroppedFileToSlot(slot: RevisionSlot, dropped: FileList | null) {
    const droppedFiles = Array.from(dropped || []);
    if (droppedFiles.length === 0) return;
    applyFileToSlot(slot, droppedFiles[0]);
  }

  async function validateFiles(): Promise<{ ok: boolean; warnings: ValidationWarning[] }> {
    setError(null);
    setSuccess(null);
    setIntakeSuccess(null);
    setValidationWarnings([]);
    setWarningDialogOpen(false);

    if (!fileA || !fileB) {
      const nextError = {
        code: 'UPLOAD_FILE_COUNT_INVALID',
        message: 'Select exactly two files before validating.'
      };
      setError(nextError);
      openIssueDialog('Compare', 'Comparison blocked', nextError);
      return { ok: false, warnings: [] };
    }

    setIsSubmitting(true);
    const form = new FormData();
    form.append('fileA', fileA);
    form.append('fileB', fileB);
    if (sheetSelectorA.selectedSheetName) form.append('fileASheetName', sheetSelectorA.selectedSheetName);
    if (sheetSelectorB.selectedSheetName) form.append('fileBSheetName', sheetSelectorB.selectedSheetName);

    try {
      const response = await fetch('/api/uploads/validate', {
        method: 'POST',
        body: form
      });
      const payload = (await response.json()) as ValidationError | ValidationSuccess;

      if (!response.ok) {
        const parsedError = payload as ValidationError;
        if (parsedError.code === 'UPLOAD_COOLDOWN_ACTIVE' && parsedError.cooldownUntilUtc) {
          setBlockedUntilUtc(parsedError.cooldownUntilUtc);
        }
        setError(parsedError);
        openIssueDialog('Compare', 'Validation issue', parsedError);
        return { ok: false, warnings: [] };
      }

      const parsedSuccess = payload as ValidationSuccess;
      if (parsedSuccess.policy?.cooldownUntilUtc) {
        setBlockedUntilUtc(parsedSuccess.policy.cooldownUntilUtc);
      }
      setSuccess(parsedSuccess);
      setValidationWarnings(parsedSuccess.warnings || []);
      return { ok: true, warnings: parsedSuccess.warnings || [] };
    } catch {
      const nextError = {
        code: 'UPLOAD_VALIDATE_REQUEST_FAILED',
        message: 'Could not reach upload validation service.'
      };
      setError(nextError);
      openIssueDialog('Compare', 'Validation issue', nextError);
      return { ok: false, warnings: [] };
    } finally {
      setIsSubmitting(false);
    }
  }

  async function queueFiles(): Promise<boolean> {
    setError(null);
    setIntakeSuccess(null);

    if (!fileA || !fileB) {
      const nextError = {
        code: 'UPLOAD_FILE_COUNT_INVALID',
        message: 'Select exactly two files before queueing.'
      };
      setError(nextError);
      openIssueDialog('Comparison', 'Comparison blocked', nextError);
      return false;
    }

    setIsQueueing(true);
    const form = new FormData();
    form.append('fileA', fileA);
    form.append('fileB', fileB);
    if (sheetSelectorA.selectedSheetName) form.append('fileASheetName', sheetSelectorA.selectedSheetName);
    if (sheetSelectorB.selectedSheetName) form.append('fileBSheetName', sheetSelectorB.selectedSheetName);

    try {
      const response = await fetch('/api/uploads/intake', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: form
      });
      const payload = (await response.json()) as ValidationError | IntakeSuccess;
      if (!response.ok) {
        const parsedError = payload as ValidationError;
        if (parsedError.code === 'UPLOAD_COOLDOWN_ACTIVE' && parsedError.cooldownUntilUtc) {
          setBlockedUntilUtc(parsedError.cooldownUntilUtc);
        }
        setError(parsedError);
        openIssueDialog('Comparison', 'Comparison issue', parsedError);
        return false;
      }

      setIntakeSuccess(payload as IntakeSuccess);
      setResultsLinkAcknowledged(false);
      return true;
    } catch {
      const nextError = {
        code: 'UPLOAD_INTAKE_REQUEST_FAILED',
        message: 'Could not reach upload intake service.'
      };
      setError(nextError);
      openIssueDialog('Comparison', 'Comparison issue', nextError);
      return false;
    } finally {
      setIsQueueing(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const validated = await validateFiles();
    if (!validated.ok) return;
    if (validated.warnings.length > 0) {
      setWarningDialogOpen(true);
      return;
    }
    await queueFiles();
  }

  async function continueAfterWarnings() {
    setWarningDialogOpen(false);
    await queueFiles();
  }

  useEffect(() => {
    let cancelled = false;
    if (!fileA) {
      setSheetSelectorA(emptySheetSelectorState());
      return undefined;
    }
    setSheetSelectorA(loadingSheetSelectorState());
    void discoverWorkbookMetadata(fileA, 'a')
      .then((nextState) => {
        if (!cancelled) setSheetSelectorA(nextState);
      })
      .catch((nextError: ValidationError) => {
        if (cancelled) return;
        setSheetSelectorA(emptySheetSelectorState('Unavailable'));
        setError(nextError);
        openIssueDialog('Revision A', 'Sheet inspection issue', nextError);
      });
    return () => {
      cancelled = true;
    };
  }, [fileA]);

  useEffect(() => {
    let cancelled = false;
    if (!fileB) {
      setSheetSelectorB(emptySheetSelectorState());
      return undefined;
    }
    setSheetSelectorB(loadingSheetSelectorState());
    void discoverWorkbookMetadata(fileB, 'b')
      .then((nextState) => {
        if (!cancelled) setSheetSelectorB(nextState);
      })
      .catch((nextError: ValidationError) => {
        if (cancelled) return;
        setSheetSelectorB(emptySheetSelectorState('Unavailable'));
        setError(nextError);
        openIssueDialog('Revision B', 'Sheet inspection issue', nextError);
      });
    return () => {
      cancelled = true;
    };
  }, [fileB]);

  const openResultsHref =
    intakeSuccess?.leftRevisionId && intakeSuccess.rightRevisionId
      ? `/results?sessionId=${encodeURIComponent(intakeSuccess.sessionId)}&leftRevisionId=${encodeURIComponent(
          intakeSuccess.leftRevisionId
        )}&rightRevisionId=${encodeURIComponent(intakeSuccess.rightRevisionId)}`
      : null;
  const isBusy = isSubmitting || isQueueing;
  const isTransitioningToResults = isAutoOpeningResults && Boolean(openResultsHref);
  const shouldHighlightCompare = canSubmit && !isTransitioningToResults && !openResultsHref;
  const hasSelectedFiles = !!fileA || !!fileB;
  const compareTooltip = isSubmitting
    ? 'Validation is running before comparison starts'
    : isQueueing
      ? 'Comparison is starting'
      : isTransitioningToResults
        ? 'Opening results workspace'
        : !fileA || !fileB
          ? 'Select two files to validate and compare'
          : !selectorsReady
            ? 'Wait for sheet selection to load'
            : isBlocked
              ? 'Comparison is blocked during the cooldown window'
              : 'Validate and start comparison';
  const showActionRow =
    isBusy ||
    isTransitioningToResults ||
    shouldHighlightCompare ||
    Boolean(openResultsHref) ||
    (!isBlocked && hasSelectedFiles);

  function renderStatus(slot: RevisionSlot): { label: string; className: string } {
    const file = slot === 'a' ? fileA : fileB;
    if (isBlocked) {
      return {
        label: 'Blocked by policy',
        className: 'missionComparePill missionComparePillWarning'
      };
    }
    if (file) {
      return {
        label: 'Ready for comparison',
        className: 'missionComparePill missionComparePillReady'
      };
    }
    return {
      label: 'Waiting for source',
      className: 'missionComparePill missionComparePillWaiting'
    };
  }

  useEffect(() => {
    if (!openResultsHref || resultsLinkAcknowledged) return;
    setIsAutoOpeningResults(true);
    const timer = window.setTimeout(() => {
      setResultsLinkAcknowledged(true);
      router.push(openResultsHref);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [openResultsHref, resultsLinkAcknowledged, router]);

  return (
    <form onSubmit={onSubmit} className="missionComparePage" data-testid="upload-validation-form">
      <section className="missionCompareTopRail">
        {showActionRow ? (
          <div className="missionCompareTopActionsRow">
            <div className="missionCompareTopActions">
              {isBusy ? (
                <div className="missionCompareStateBadge missionCompareStateBadgeBusy" data-testid="upload-progress-indicator">
                  <span className="missionCompareBusyTrack" aria-hidden="true">
                    <span className="missionCompareBusyFill" />
                  </span>
                  <span>{isSubmitting ? 'Validating' : 'Starting comparison'}</span>
                </div>
              ) : isTransitioningToResults ? (
                <div className="missionCompareStateBadge missionCompareStateBadgeBusy" data-testid="upload-open-results-indicator">
                  <span className="missionCompareBusyTrack" aria-hidden="true">
                    <span className="missionCompareBusyFill" />
                  </span>
                  <span>Opening results...</span>
                </div>
              ) : success ? (
                <div className="missionCompareStateBadge missionCompareStateBadgeReady" data-testid="upload-validation-success-indicator">
                  <CheckCircleIcon />
                  <span>Validated</span>
                </div>
              ) : null}
              <span className="missionCompareActionWrap" title={compareTooltip}>
                <button
                  className={`screenIconAction missionCompareActionButton ${shouldHighlightCompare ? 'missionCompareRunPulse' : ''}`}
                  type="submit"
                  disabled={!canSubmit}
                  aria-label={compareTooltip}
                  data-testid="compare-upload-btn"
                >
                  <RunIcon />
                </button>
              </span>
              {openResultsHref ? (
                <a
                  className={`screenIconAction missionCompareActionButton ${resultsLinkAcknowledged ? '' : 'missionCompareOpenResultsPulse'}`}
                  href={openResultsHref}
                  aria-label="Open results workspace"
                  title="Open results workspace"
                  data-testid="upload-view-results-link"
                  onClick={() => setResultsLinkAcknowledged(true)}
                >
                  <OpenIcon />
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        <section
          className={`dropzone missionCompareDropzone ${isMasterDragActive ? 'dropzoneActive' : ''}`}
          data-testid="upload-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            if (!isBlocked) {
              setIsMasterDragActive(true);
            }
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsMasterDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsMasterDragActive(false);
            if (isBlocked) return;
            applyDroppedFiles(e.dataTransfer.files);
          }}
        >
          <div className="missionCompareDropzoneIcon" aria-hidden="true">
            <UploadTrayIcon />
          </div>
          <div className="missionCompareDropzoneContent">
            <strong>Drag and drop BOM files</strong>
            <span>Drop one or two files here. Two dropped files map to `Revision A` then `Revision B`.</span>
          </div>
        </section>
      </section>

      <section className="missionCompareGrid">
        <article
          className={`missionCompareCard missionCompareCardDropzone ${
            activeRevisionDrop === 'a' ? 'missionCompareCardDropzoneActive' : ''
          }`}
          data-testid="upload-card-a"
          onDragOver={(e) => {
            e.preventDefault();
            if (!isBlocked) {
              setActiveRevisionDrop('a');
            }
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setActiveRevisionDrop((current) => (current === 'a' ? null : current));
          }}
          onDrop={(e) => {
            e.preventDefault();
            setActiveRevisionDrop((current) => (current === 'a' ? null : current));
            if (isBlocked) return;
            applyDroppedFileToSlot('a', e.dataTransfer.files);
          }}
        >
          <div className="missionCompareCardHeader">
            <div>
              <p className="missionCompareEyebrow">Revision A</p>
              <h2 className="h2">Primary source revision</h2>
            </div>
            <label className="btn missionCompareSelectButton" htmlFor="fileA">
              Select file
            </label>
            <input
              id="fileA"
              name="fileA"
              type="file"
              className="missionCompareInput"
              disabled={isBlocked}
              onChange={(e) => applyFileToSlot('a', e.currentTarget.files?.[0] || null)}
              data-testid="file-input-a"
            />
          </div>

          <div className="missionCompareMetaGrid">
            <div>
              <span className="missionCompareMetaLabel">Source A</span>
              <strong className="missionCompareMetaValue" data-testid="upload-source-a">
                {fileA ? fileA.name : 'Drag file here or select'}
              </strong>
            </div>
            <div>
              <span className="missionCompareMetaLabel">Sheet</span>
              <select
                className="missionCompareSheetSelect"
                value={sheetSelectorA.selectedSheetName}
                disabled={isBlocked || sheetSelectorA.dropdownDisabled || sheetSelectorA.isLoading}
                onChange={(event) =>
                  setSheetSelectorA((current) => ({
                    ...current,
                    selectedSheetName: event.target.value
                  }))
                }
                data-testid="upload-sheet-select-a"
              >
                {sheetSelectorA.options.map((option) => (
                  <option key={option.name} value={option.name}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="missionCompareMetaLabel">Size</span>
              <strong className="missionCompareMetaValue" data-testid="upload-size-a">
                {fileA ? formatFileSize(fileA.size) : 'Pending'}
              </strong>
            </div>
            <div>
              <span className="missionCompareMetaLabel">Status</span>
              <strong className="missionCompareMetaValue" data-testid="upload-status-a">
                <span className={renderStatus('a').className}>{renderStatus('a').label}</span>
              </strong>
            </div>
            <div>
              <span className="missionCompareMetaLabel">Role</span>
              <strong className="missionCompareMetaValue">
                <span className="missionComparePill missionComparePillBaseline">Baseline BOM</span>
              </strong>
            </div>
          </div>
        </article>

        <article
          className={`missionCompareCard missionCompareCardDropzone ${
            activeRevisionDrop === 'b' ? 'missionCompareCardDropzoneActive' : ''
          }`}
          data-testid="upload-card-b"
          onDragOver={(e) => {
            e.preventDefault();
            if (!isBlocked) {
              setActiveRevisionDrop('b');
            }
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setActiveRevisionDrop((current) => (current === 'b' ? null : current));
          }}
          onDrop={(e) => {
            e.preventDefault();
            setActiveRevisionDrop((current) => (current === 'b' ? null : current));
            if (isBlocked) return;
            applyDroppedFileToSlot('b', e.dataTransfer.files);
          }}
        >
          <div className="missionCompareCardHeader">
            <div>
              <p className="missionCompareEyebrow">Revision B</p>
              <h2 className="h2">Candidate comparison revision</h2>
            </div>
            <label className="btn missionCompareSelectButton" htmlFor="fileB">
              Select file
            </label>
            <input
              id="fileB"
              name="fileB"
              type="file"
              className="missionCompareInput"
              disabled={isBlocked}
              onChange={(e) => applyFileToSlot('b', e.currentTarget.files?.[0] || null)}
              data-testid="file-input-b"
            />
          </div>

          <div className="missionCompareMetaGrid">
            <div>
              <span className="missionCompareMetaLabel">Source B</span>
              <strong className="missionCompareMetaValue" data-testid="upload-source-b">
                {fileB ? fileB.name : 'Drag file here or select'}
              </strong>
            </div>
            <div>
              <span className="missionCompareMetaLabel">Sheet</span>
              <select
                className="missionCompareSheetSelect"
                value={sheetSelectorB.selectedSheetName}
                disabled={isBlocked || sheetSelectorB.dropdownDisabled || sheetSelectorB.isLoading}
                onChange={(event) =>
                  setSheetSelectorB((current) => ({
                    ...current,
                    selectedSheetName: event.target.value
                  }))
                }
                data-testid="upload-sheet-select-b"
              >
                {sheetSelectorB.options.map((option) => (
                  <option key={option.name} value={option.name}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="missionCompareMetaLabel">Size</span>
              <strong className="missionCompareMetaValue" data-testid="upload-size-b">
                {fileB ? formatFileSize(fileB.size) : 'Pending'}
              </strong>
            </div>
            <div>
              <span className="missionCompareMetaLabel">Status</span>
              <strong className="missionCompareMetaValue" data-testid="upload-status-b">
                <span className={renderStatus('b').className}>{renderStatus('b').label}</span>
              </strong>
            </div>
            <div>
              <span className="missionCompareMetaLabel">Role</span>
              <strong className="missionCompareMetaValue">
                <span className="missionComparePill missionComparePillCandidate">Candidate BOM</span>
              </strong>
            </div>
          </div>
        </article>
      </section>

      {warningDialogOpen && displayValidationWarnings.length > 0 && (
        <div className="screenModalLayer" role="presentation">
          <button
            type="button"
            className="screenModalBackdrop"
            aria-label="Close upload warning dialog"
            onClick={() => setWarningDialogOpen(false)}
          />
          <section
            className="screenModalCard screenModalCardCompact panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-warning-dialog-title"
            data-testid="upload-warning-dialog"
          >
            <div className="screenModalHeader">
              <div>
                <p className="missionShellEyebrow">Validation warning</p>
                <h2 className="h2" id="upload-warning-dialog-title">
                  We found extra content in one of the files
                </h2>
              </div>
              <button
                className="screenIconAction"
                type="button"
                aria-label="Close upload warning dialog"
                title="Close"
                onClick={() => setWarningDialogOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="missionCompareDialogDetails" data-testid="upload-warning-details">
              {displayValidationWarnings.map((warning) => (
                <p
                  className="p"
                  key={`${warning.message}-${warning.selectedSheetName || 'none'}-${warning.files.join('-') || 'all'}`}
                >
                  {warning.message}
                  {warning.selectedSheetName ? ` Sheet: ${warning.selectedSheetName}.` : ''}
                  {warning.files.length > 0
                    ? ` Applies to: ${warning.files.map((file) => fileLabel(file)).join(' and ')}.`
                    : ''}
                </p>
              ))}
            </div>
            <div className="screenDialogActions">
              <button className="btn" type="button" onClick={() => setWarningDialogOpen(false)}>
                Cancel
              </button>
              <button className="btn btnPrimary" type="button" onClick={() => void continueAfterWarnings()} data-testid="upload-warning-continue">
                Continue
              </button>
            </div>
          </section>
        </div>
      )}

      {feedbackDialog && (
        <div className="screenModalLayer" role="presentation">
          <button
            type="button"
            className="screenModalBackdrop"
            aria-label="Close upload feedback dialog"
            onClick={() => setFeedbackDialog(null)}
          />
          <section
            className="screenModalCard screenModalCardCompact panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-feedback-dialog-title"
            data-testid="upload-feedback-dialog"
          >
            <div className="screenModalHeader">
              <div>
                <p className="missionShellEyebrow">{feedbackDialog.eyebrow}</p>
                <h2 className="h2" id="upload-feedback-dialog-title">
                  {feedbackDialog.title}
                </h2>
              </div>
              <button
                className="screenIconAction"
                type="button"
                aria-label="Close upload feedback dialog"
                title="Close"
                onClick={() => setFeedbackDialog(null)}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="missionCompareDialogDetails" data-testid="upload-feedback-details">
              {feedbackDialog.details.map((detail) => (
                <p className="p" key={detail}>
                  {detail}
                </p>
              ))}
            </div>
          </section>
        </div>
      )}
    </form>
  );
}
