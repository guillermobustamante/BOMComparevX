'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type ChangeType = 'added' | 'removed' | 'replaced' | 'modified' | 'moved' | 'quantity_change' | 'no_change';

interface DiffRow {
  rowId: string;
  changeType: ChangeType;
  sourceIndex: number;
  targetIndex: number;
  keyFields: {
    partNumber: string | null;
    revision: string | null;
    description: string | null;
  };
  cells: Array<{
    field: string;
    before: string | number | null;
    after: string | number | null;
    reasonCode: string;
  }>;
  rationale: {
    classificationReason: string;
    matchReason?: string;
    tieBreakTrace?: string[];
    score?: number;
    reviewRequired?: boolean;
    changedFields: string[];
  };
}

interface DiffStatus {
  contractVersion: string;
  jobId: string;
  phase: 'matching' | 'classifying' | 'finalizing' | 'completed';
  percentComplete: number;
  counters: Record<ChangeType | 'total', number>;
  loadedRows: number;
  totalRows: number;
  nextCursor: string | null;
  status: 'running' | 'completed';
}

const CHANGE_FILTERS: Array<{ value: 'all' | ChangeType; label: string }> = [
  { value: 'all', label: 'All changes' },
  { value: 'added', label: 'Added' },
  { value: 'removed', label: 'Removed' },
  { value: 'replaced', label: 'Replaced' },
  { value: 'modified', label: 'Modified' },
  { value: 'moved', label: 'Moved' },
  { value: 'quantity_change', label: 'Quantity Change' },
  { value: 'no_change', label: 'No Change' }
];

export function ResultsGrid() {
  const resultsGridEnabled =
    (process.env.NEXT_PUBLIC_RESULTS_GRID_STAGE4_V1 || 'true').trim().toLowerCase() !== 'false';
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const sessionId = searchParams.get('sessionId');
  const leftRevisionId = searchParams.get('leftRevisionId');
  const rightRevisionId = searchParams.get('rightRevisionId');
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<DiffStatus | null>(null);
  const [rows, setRows] = useState<DiffRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [partFilter, setPartFilter] = useState('');
  const [changeFilter, setChangeFilter] = useState<'all' | ChangeType>('all');
  const [sortMode, setSortMode] = useState<'source' | 'part' | 'change'>('source');
  const [isStarting, setIsStarting] = useState(false);
  const rowsCountRef = useRef(0);

  useEffect(() => {
    rowsCountRef.current = rows.length;
  }, [rows.length]);

  async function startDiffJob() {
    setIsStarting(true);
    setError(null);
    setRows([]);
    setStatus(null);
    setJobId(null);

    try {
      const response = await fetch('/api/diff-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(sessionId ? { sessionId } : {}),
          ...(leftRevisionId ? { leftRevisionId } : {}),
          ...(rightRevisionId ? { rightRevisionId } : {})
        })
      });
      const payload = (await response.json()) as DiffStatus | { code?: string; message?: string };
      if (!response.ok) {
        const err = payload as { code?: string; message?: string };
        setError(`${err.code || 'DIFF_START_FAILED'}: ${err.message || 'Could not start diff job.'}`);
        return;
      }

      const started = payload as DiffStatus;
      setJobId(started.jobId);
      setStatus(started);
      const params = new URLSearchParams(searchParams.toString());
      params.set('comparisonId', started.jobId);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      await pullRows(started.jobId, '0', started.loadedRows);
    } catch {
      setError('DIFF_START_FAILED: Could not start diff job.');
    } finally {
      setIsStarting(false);
    }
  }

  async function pullRows(nextJobId: string, startCursor: string, loadedRows: number) {
    let cursor = startCursor;
    while (Number(cursor) < loadedRows) {
      const response = await fetch(`/api/diff-jobs/${encodeURIComponent(nextJobId)}/rows?cursor=${cursor}&limit=50`, {
        method: 'GET',
        cache: 'no-store'
      });
      const payload = (await response.json()) as {
        rows?: DiffRow[];
        nextCursor?: string | null;
        code?: string;
        message?: string;
      };
      if (!response.ok) {
        setError(`${payload.code || 'DIFF_ROWS_FAILED'}: ${payload.message || 'Could not load diff rows.'}`);
        return;
      }
      const incoming = payload.rows || [];
      if (incoming.length) {
        setRows((current) => {
          const known = new Set(current.map((row) => row.rowId));
          const appended = incoming.filter((row) => !known.has(row.rowId));
          return [...current, ...appended];
        });
      }
      if (!payload.nextCursor) break;
      cursor = payload.nextCursor;
    }
  }

  useEffect(() => {
    void startDiffJob();
  }, [sessionId, leftRevisionId, rightRevisionId]);

  useEffect(() => {
    if (!jobId) return;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/diff-jobs/${encodeURIComponent(jobId)}`, {
          method: 'GET',
          cache: 'no-store'
        });
        const payload = (await response.json()) as DiffStatus | { code?: string; message?: string };
        if (!response.ok) {
          const err = payload as { code?: string; message?: string };
          setError(`${err.code || 'DIFF_STATUS_FAILED'}: ${err.message || 'Could not load status.'}`);
          return;
        }
        const currentStatus = payload as DiffStatus;
        setStatus(currentStatus);
        if (currentStatus.loadedRows > rowsCountRef.current) {
          await pullRows(currentStatus.jobId, String(rowsCountRef.current), currentStatus.loadedRows);
        }
      } catch {
        setError('DIFF_STATUS_FAILED: Could not load status.');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [jobId]);

  const visibleRows = useMemo(() => {
    let filtered = rows;
    if (changeFilter !== 'all') {
      filtered = filtered.filter((row) => row.changeType === changeFilter);
    }
    const query = search.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((row) => {
        const text = [
          row.keyFields.partNumber,
          row.keyFields.revision,
          row.keyFields.description,
          row.changeType,
          row.rationale.classificationReason
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return text.includes(query);
      });
    }
    const partQuery = partFilter.trim().toLowerCase();
    if (partQuery) {
      filtered = filtered.filter((row) => (row.keyFields.partNumber || '').toLowerCase().includes(partQuery));
    }

    const sorted = [...filtered];
    if (sortMode === 'part') {
      sorted.sort((a, b) => (a.keyFields.partNumber || '').localeCompare(b.keyFields.partNumber || ''));
    } else if (sortMode === 'change') {
      sorted.sort((a, b) => a.changeType.localeCompare(b.changeType) || a.sourceIndex - b.sourceIndex);
    } else {
      sorted.sort((a, b) => a.sourceIndex - b.sourceIndex || a.targetIndex - b.targetIndex);
    }
    return sorted;
  }, [rows, changeFilter, search, partFilter, sortMode]);

  if (!resultsGridEnabled) {
    return (
      <section className="panel" data-testid="results-panel">
        <h1 className="h1">Results</h1>
        <div className="alertWarning" data-testid="results-feature-disabled">
          STAGE4_RESULTS_GRID_DISABLED: Results grid is currently disabled by feature flag.
        </div>
      </section>
    );
  }

  return (
    <section className="panel" data-testid="results-panel">
      <div className="resultsHeader">
        <h1 className="h1">Results</h1>
        <button className="btn" type="button" onClick={() => void startDiffJob()} disabled={isStarting} data-testid="results-run-btn">
          {isStarting ? 'Starting...' : 'Run Diff'}
        </button>
      </div>

      {status && status.status === 'running' && (
        <div className="alertWarning" data-testid="results-partial-badge">
          Partial results ({rows.length}/{status.totalRows}) - {status.phase} {status.percentComplete}%
        </div>
      )}
      {status && status.status === 'completed' && (
        <div className="alertSuccess" data-testid="results-complete-badge">
          Completed ({rows.length}/{status.totalRows}) - {status.percentComplete}%
        </div>
      )}
      {error && (
        <div className="alertError" data-testid="results-error">
          {error}
        </div>
      )}

      <div className="resultsFilters">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search text..."
          data-testid="results-search-input"
        />
        <input
          value={partFilter}
          onChange={(e) => setPartFilter(e.target.value)}
          placeholder="Part number filter..."
          data-testid="results-part-filter-input"
        />
        <select
          value={changeFilter}
          onChange={(e) => setChangeFilter(e.target.value as 'all' | ChangeType)}
          data-testid="results-change-filter"
        >
          {CHANGE_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as 'source' | 'part' | 'change')}
          data-testid="results-sort-select"
        >
          <option value="source">Sort: Source Order</option>
          <option value="part">Sort: Part Number</option>
          <option value="change">Sort: Change Type</option>
        </select>
      </div>

      <div className="mappingTableWrap">
        <table className="mappingTable" data-testid="results-grid-table">
          <thead>
            <tr>
              <th>Change</th>
              <th>Part Number</th>
              <th>Revision</th>
              <th>Description</th>
              <th>Rationale</th>
              <th>Changed Fields</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.rowId} className={`diffRow diffRow-${row.changeType}`} data-testid={`results-row-${row.rowId}`}>
                <td>
                  <span className={`chip chip-${row.changeType}`}>{row.changeType}</span>
                </td>
                <td>{row.keyFields.partNumber || '-'}</td>
                <td>{row.keyFields.revision || '-'}</td>
                <td>{row.keyFields.description || '-'}</td>
                <td>{row.rationale.classificationReason}</td>
                <td>
                  <div className="cellChips">
                    {row.rationale.changedFields.length === 0 && <span className="chip">none</span>}
                    {row.rationale.changedFields.map((field) => (
                      <span className="chip" key={`${row.rowId}-${field}`}>
                        {field}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
