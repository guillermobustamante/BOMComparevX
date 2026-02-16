'use client';

import { useMemo, useState } from 'react';

interface ValidationError {
  code?: string;
  message?: string;
  correlationId?: string;
}

interface ValidationSuccess {
  accepted: true;
  correlationId: string;
  files: {
    fileA: { name: string; size: number };
    fileB: { name: string; size: number };
  };
}

function bytesToMb(value: number): string {
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

export function UploadValidationForm() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ValidationError | null>(null);
  const [success, setSuccess] = useState<ValidationSuccess | null>(null);

  const canSubmit = useMemo(() => !!fileA && !!fileB && !isSubmitting, [fileA, fileB, isSubmitting]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

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
        setError(payload as ValidationError);
        return;
      }

      setSuccess(payload as ValidationSuccess);
    } catch {
      setError({
        code: 'UPLOAD_VALIDATE_REQUEST_FAILED',
        message: 'Could not reach upload validation service.'
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel" data-testid="upload-validation-form">
      <h1 className="h1">Upload</h1>
      <p className="p">Validate exactly two files before starting queue intake.</p>

      <div className="actions">
        <label className="btn" htmlFor="fileA">
          File A
        </label>
        <input
          id="fileA"
          name="fileA"
          type="file"
          onChange={(e) => setFileA(e.currentTarget.files?.[0] || null)}
          data-testid="file-input-a"
        />

        <label className="btn" htmlFor="fileB">
          File B
        </label>
        <input
          id="fileB"
          name="fileB"
          type="file"
          onChange={(e) => setFileB(e.currentTarget.files?.[0] || null)}
          data-testid="file-input-b"
        />
      </div>

      <div className="actions">
        <button className="btn btnPrimary" type="submit" disabled={!canSubmit} data-testid="validate-upload-btn">
          {isSubmitting ? 'Validating...' : 'Validate Upload'}
        </button>
      </div>

      {fileA && <p className="p">File A: {fileA.name} ({bytesToMb(fileA.size)})</p>}
      {fileB && <p className="p">File B: {fileB.name} ({bytesToMb(fileB.size)})</p>}

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
          <div>Correlation ID: {success.correlationId}</div>
        </div>
      )}
    </form>
  );
}
