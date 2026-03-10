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

interface ValidationSuccess {
  accepted: true;
  correlationId: string;
  files: {
    fileA: { name: string; size: number };
    fileB: { name: string; size: number };
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

function bytesToMb(value: number): string {
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

export function UploadValidationForm() {
  const router = useRouter();
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
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
  const canSubmit = useMemo(
    () => !!fileA && !!fileB && !isSubmitting && !isQueueing && !isBlocked,
    [fileA, fileB, isSubmitting, isQueueing, isBlocked]
  );

  function applyPickedFiles(nextFileA: File | null, nextFileB: File | null) {
    setFileA(nextFileA);
    setFileB(nextFileB);
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

  async function validateFiles(): Promise<boolean> {
    setError(null);
    setSuccess(null);
    setIntakeSuccess(null);

    if (!fileA || !fileB) {
      const nextError = {
        code: 'UPLOAD_FILE_COUNT_INVALID',
        message: 'Select exactly two files before validating.'
      };
      setError(nextError);
      openIssueDialog('Compare', 'Comparison blocked', nextError);
      return false;
    }

    setIsSubmitting(true);
    const form = new FormData();
    form.append('fileA', fileA);
    form.append('fileB', fileB);

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
        return false;
      }

      const parsedSuccess = payload as ValidationSuccess;
      if (parsedSuccess.policy?.cooldownUntilUtc) {
        setBlockedUntilUtc(parsedSuccess.policy.cooldownUntilUtc);
      }
      setSuccess(parsedSuccess);
      return true;
    } catch {
      const nextError = {
        code: 'UPLOAD_VALIDATE_REQUEST_FAILED',
        message: 'Could not reach upload validation service.'
      };
      setError(nextError);
      openIssueDialog('Compare', 'Validation issue', nextError);
      return false;
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
    if (!validated) return;
    await queueFiles();
  }

  const openResultsHref =
    intakeSuccess?.leftRevisionId && intakeSuccess.rightRevisionId
      ? `/results?sessionId=${encodeURIComponent(intakeSuccess.sessionId)}&leftRevisionId=${encodeURIComponent(
          intakeSuccess.leftRevisionId
        )}&rightRevisionId=${encodeURIComponent(intakeSuccess.rightRevisionId)}`
      : null;
  const isBusy = isSubmitting || isQueueing;
  const isTransitioningToResults = isAutoOpeningResults && Boolean(openResultsHref);
  const compareTooltip = isSubmitting
    ? 'Validation is running before comparison starts'
    : isQueueing
      ? 'Comparison is starting'
      : isTransitioningToResults
        ? 'Opening results workspace'
      : !fileA || !fileB
        ? 'Select two files to validate and compare'
        : isBlocked
          ? 'Comparison is blocked during the cooldown window'
          : 'Validate and start comparison';

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
              <div className="missionCompareStateBadge" data-testid="upload-validation-success-indicator">
                <CheckCircleIcon />
                <span>Validated</span>
              </div>
            ) : null}
            <span className="missionCompareActionWrap" title={compareTooltip}>
              <button
                className="screenIconAction"
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
                className={`screenIconAction ${resultsLinkAcknowledged ? '' : 'missionCompareOpenResultsPulse'}`}
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

        <section
          className={`dropzone missionCompareDropzone ${isDragActive ? 'dropzoneActive' : ''}`}
          data-testid="upload-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            if (!isBlocked) {
              setIsDragActive(true);
            }
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragActive(false);
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
        <article className="missionCompareCard">
          <div className="missionCompareCardHeader">
            <div>
              <p className="missionCompareEyebrow">Revision A</p>
              <h2 className="h2">Primary source revision</h2>
            </div>
            <label className="btn" htmlFor="fileA">
              Select file
            </label>
            <input
              id="fileA"
              name="fileA"
              type="file"
              className="missionCompareInput"
              disabled={isBlocked}
              onChange={(e) => applyPickedFiles(e.currentTarget.files?.[0] || null, fileB)}
              data-testid="file-input-a"
            />
          </div>

          <div className="missionCompareMetaGrid">
            <div>
              <span>Source A</span>
              <strong>{fileA ? fileA.name : 'No file selected'}</strong>
            </div>
            <div>
              <span>Size</span>
              <strong>{fileA ? bytesToMb(fileA.size) : 'Pending'}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{fileA ? 'Ready for validation' : 'Waiting for source'}</strong>
            </div>
            <div>
              <span>Role</span>
              <strong>Baseline BOM</strong>
            </div>
          </div>
        </article>

        <article className="missionCompareCard">
          <div className="missionCompareCardHeader">
            <div>
              <p className="missionCompareEyebrow">Revision B</p>
              <h2 className="h2">Candidate comparison revision</h2>
            </div>
            <label className="btn" htmlFor="fileB">
              Select file
            </label>
            <input
              id="fileB"
              name="fileB"
              type="file"
              className="missionCompareInput"
              disabled={isBlocked}
              onChange={(e) => applyPickedFiles(fileA, e.currentTarget.files?.[0] || null)}
              data-testid="file-input-b"
            />
          </div>

          <div className="missionCompareMetaGrid">
            <div>
              <span>Source B</span>
              <strong>{fileB ? fileB.name : 'No file selected'}</strong>
            </div>
            <div>
              <span>Size</span>
              <strong>{fileB ? bytesToMb(fileB.size) : 'Pending'}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{fileB ? 'Ready for validation' : 'Waiting for source'}</strong>
            </div>
            <div>
              <span>Role</span>
              <strong>Candidate BOM</strong>
            </div>
          </div>
        </article>
      </section>

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
            <div className="missionCompareDialogDetails">
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
