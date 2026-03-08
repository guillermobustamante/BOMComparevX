'use client';

import { useMemo, useState } from 'react';
import { UploadTrayIcon } from '@/components/mission-icons';

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

function bytesToMb(value: number): string {
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

export function UploadValidationForm() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQueueing, setIsQueueing] = useState(false);
  const [error, setError] = useState<ValidationError | null>(null);
  const [success, setSuccess] = useState<ValidationSuccess | null>(null);
  const [intakeSuccess, setIntakeSuccess] = useState<IntakeSuccess | null>(null);
  const [blockedUntilUtc, setBlockedUntilUtc] = useState<string | null>(null);

  const isBlocked = useMemo(() => !!blockedUntilUtc, [blockedUntilUtc]);
  const canSubmit = useMemo(
    () => !!fileA && !!fileB && !isSubmitting && !isQueueing && !isBlocked,
    [fileA, fileB, isSubmitting, isQueueing, isBlocked]
  );

  function applyPickedFiles(nextFileA: File | null, nextFileB: File | null) {
    setFileA(nextFileA);
    setFileB(nextFileB);
    setError(null);
  }

  function applyDroppedFiles(dropped: FileList | null) {
    const droppedFiles = Array.from(dropped || []);
    if (droppedFiles.length === 0) return;
    if (droppedFiles.length > 2) {
      setError({
        code: 'UPLOAD_FILE_COUNT_INVALID',
        message: 'Drop one or two files only.'
      });
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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIntakeSuccess(null);

    if (!fileA || !fileB) {
      setError({
        code: 'UPLOAD_FILE_COUNT_INVALID',
        message: 'Select exactly two files before validating.'
      });
      return;
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
        return;
      }

      const parsedSuccess = payload as ValidationSuccess;
      if (parsedSuccess.policy?.cooldownUntilUtc) {
        setBlockedUntilUtc(parsedSuccess.policy.cooldownUntilUtc);
      }
      setSuccess(parsedSuccess);
    } catch {
      setError({
        code: 'UPLOAD_VALIDATE_REQUEST_FAILED',
        message: 'Could not reach upload validation service.'
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onQueue() {
    setError(null);
    setIntakeSuccess(null);

    if (!fileA || !fileB) {
      setError({
        code: 'UPLOAD_FILE_COUNT_INVALID',
        message: 'Select exactly two files before queueing.'
      });
      return;
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
        return;
      }

      setIntakeSuccess(payload as IntakeSuccess);
    } catch {
      setError({
        code: 'UPLOAD_INTAKE_REQUEST_FAILED',
        message: 'Could not reach upload intake service.'
      });
    } finally {
      setIsQueueing(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="missionComparePage" data-testid="upload-validation-form">
      <section className="missionCompareStepStrip" aria-label="Compare workflow">
        <span className="chip chipMissionActive">Select revisions</span>
        <span className="chip">Validate</span>
        <span className="chip">Compare</span>
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

      <section className="missionCompareLaunchCard">
        <div className="missionCompareCardHeader">
          <div>
            <p className="missionCompareEyebrow">Validation rail</p>
            <h2 className="h2">Comparison launch readiness</h2>
          </div>
          <div className="actions missionCompareActionRow">
            <button className="btn btnPrimary" type="submit" disabled={!canSubmit} data-testid="validate-upload-btn">
              {isSubmitting ? 'Validating...' : 'Validate revisions'}
            </button>
            <button
              className="btn"
              type="button"
              disabled={!canSubmit}
              data-testid="queue-upload-btn"
              onClick={onQueue}
            >
              {isQueueing ? 'Queueing...' : 'Start comparison'}
            </button>
          </div>
        </div>

        <p className="p">Validate exactly two revisions before queueing the comparison job. Queue intake stays disabled during cooldown windows.</p>

        {isBlocked && (
          <div className="alertWarning" data-testid="upload-policy-blocked-banner">
            <strong>Uploads temporarily blocked</strong>
            <div>
              Cooldown active until {blockedUntilUtc ? new Date(blockedUntilUtc).toUTCString() : 'unknown time'}.
            </div>
            <a className="linkInline" href="/billing" data-testid="more-credits-link">
              More credits
            </a>
          </div>
        )}

        {error && (
          <div className="alertError" data-testid="upload-validation-error">
            <strong>{error.code || 'VALIDATION_ERROR'}</strong>
            <div>{error.message || 'Upload validation failed.'}</div>
            {error.correlationId && <div>Correlation ID: {error.correlationId}</div>}
          </div>
        )}

        {success && (
          <div className="alertSuccess" data-testid="upload-validation-success">
            <strong>UPLOAD_VALIDATED</strong>
            <div>fileA: {success.files.fileA.name}</div>
            <div>fileB: {success.files.fileB.name}</div>
            {success.policy && (
              <div>
                Policy:{' '}
                {success.policy.isUnlimited
                  ? 'unlimited override active'
                  : `used ${success.policy.comparisonsUsed}, remaining ${success.policy.unrestrictedComparisonsRemaining}`}
              </div>
            )}
            <div>Correlation ID: {success.correlationId}</div>
          </div>
        )}

        {intakeSuccess && (
          <div className="alertSuccess" data-testid="upload-intake-success">
            <strong>UPLOAD_ACCEPTED</strong>
            <div>Status: {intakeSuccess.status}</div>
            <div>Job ID: {intakeSuccess.jobId}</div>
            <div>History ID: {intakeSuccess.historyId || 'n/a'}</div>
            <div>Left Revision: {intakeSuccess.leftRevisionId || 'n/a'}</div>
            <div>Right Revision: {intakeSuccess.rightRevisionId || 'n/a'}</div>
            <div>Correlation ID: {intakeSuccess.correlationId}</div>
            {intakeSuccess.leftRevisionId && intakeSuccess.rightRevisionId && (
              <a
                className="linkInline"
                href={`/results?sessionId=${encodeURIComponent(intakeSuccess.sessionId)}&leftRevisionId=${encodeURIComponent(intakeSuccess.leftRevisionId)}&rightRevisionId=${encodeURIComponent(intakeSuccess.rightRevisionId)}`}
                data-testid="upload-view-results-link"
              >
                Open results workspace
              </a>
            )}
          </div>
        )}
      </section>
    </form>
  );
}
