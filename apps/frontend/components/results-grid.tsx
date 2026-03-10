'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DeleteIcon,
  EditIcon,
  ExportIcon,
  FlatViewIcon,
  HistoryIcon,
  OpenIcon,
  RunIcon,
  ShareIcon,
  TreeViewIcon,
  UploadTrayIcon
} from '@/components/mission-icons';

type ChangeType = 'added' | 'removed' | 'replaced' | 'modified' | 'moved' | 'quantity_change' | 'no_change';
type PageSize = 50 | 100 | 200;
type ResultsViewMode = 'flat' | 'tree';

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
  errorCode?: string;
  errorMessage?: string;
}

interface ShareRecipient {
  invitedEmail: string;
  permission: 'view';
  createdAtUtc: string;
  updatedAtUtc: string;
}

interface DiffTreeNode {
  nodeId: string;
  parentNodeId: string | null;
  depth: number;
  hasChildren: boolean;
  rowId: string;
  changeType: ChangeType;
  keyFields: {
    partNumber: string | null;
    revision: string | null;
    description: string | null;
  };
  changedFields: string[];
  fromParent?: string | null;
  toParent?: string | null;
}

interface SessionComparisonEntry {
  historyId: string;
  jobId: string;
  sessionId: string;
  sessionName: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  status: string;
  initiatorEmail: string;
  leftRevisionId: string | null;
  rightRevisionId: string | null;
  comparisonLabel: string;
  latest: boolean;
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

const PAGE_SIZE_OPTIONS: PageSize[] = [50, 100, 200];

export function ResultsGrid() {
  const resultsGridEnabled =
    (process.env.NEXT_PUBLIC_RESULTS_GRID_STAGE4_V1 || 'true').trim().toLowerCase() !== 'false';
  const resultsTreeViewEnabled =
    (process.env.NEXT_PUBLIC_RESULTS_TREE_VIEW_V1 || 'true').trim().toLowerCase() !== 'false';
  const resultsDynamicFiltersEnabled =
    (process.env.NEXT_PUBLIC_RESULTS_DYNAMIC_FILTERS_V1 || 'true').trim().toLowerCase() !== 'false';
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const comparisonIdParam = searchParams.get('comparisonId');
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
  const [viewMode, setViewMode] = useState<ResultsViewMode>('flat');
  const [isStarting, setIsStarting] = useState(false);
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [currentCursor, setCurrentCursor] = useState('0');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [filteredTotalRows, setFilteredTotalRows] = useState(0);
  const [treeNodes, setTreeNodes] = useState<DiffTreeNode[]>([]);
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([]);

  const rowsCountRef = useRef(0);
  const treeRowsCountRef = useRef(0);
  const lastStatusLoadedRowsRef = useRef(0);
  const statusPollInFlightRef = useRef(false);
  const latestStatusRef = useRef<DiffStatus | null>(null);

  const activeComparisonId = jobId || comparisonIdParam;
  const [shareInput, setShareInput] = useState('');
  const [shareRecipients, setShareRecipients] = useState<ShareRecipient[]>([]);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [chainUploadDialogOpen, setChainUploadDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historySessions, setHistorySessions] = useState<SessionComparisonEntry[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyFeedback, setHistoryFeedback] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});
  const [nextRevisionFile, setNextRevisionFile] = useState<File | null>(null);
  const [chainUploadError, setChainUploadError] = useState<string | null>(null);
  const [chainUploadBusy, setChainUploadBusy] = useState(false);
  const [chainUploadDragActive, setChainUploadDragActive] = useState(false);
  const nextRevisionInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    rowsCountRef.current = rows.length;
  }, [rows.length]);

  useEffect(() => {
    treeRowsCountRef.current = treeNodes.length;
  }, [treeNodes.length]);

  useEffect(() => {
    latestStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!resultsTreeViewEnabled && viewMode === 'tree') {
      setViewMode('flat');
    }
  }, [resultsTreeViewEnabled, viewMode]);

  function resetPagination(): void {
    setCurrentCursor('0');
    setNextCursor(null);
    setCursorHistory([]);
    setFilteredTotalRows(0);
  }

  async function loadShareRecipients(comparisonId: string) {
    setShareError(null);
    try {
      const response = await fetch(`/api/shares/${encodeURIComponent(comparisonId)}`, {
        method: 'GET',
        cache: 'no-store'
      });
      const payload = (await response.json()) as
        | { recipients?: ShareRecipient[] }
        | { code?: string; message?: string };
      if (!response.ok) {
        const err = payload as { code?: string; message?: string };
        setShareError(`${err.code || 'SHARE_LIST_FAILED'}: ${err.message || 'Could not load recipients.'}`);
        setShareRecipients([]);
        return;
      }
      setShareRecipients((payload as { recipients?: ShareRecipient[] }).recipients || []);
    } catch {
      setShareError('SHARE_LIST_FAILED: Could not load recipients.');
      setShareRecipients([]);
    }
  }

  async function inviteRecipients() {
    if (!activeComparisonId) return;
    const invitedEmails = shareInput
      .split(/[,\n;]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    if (invitedEmails.length === 0) {
      setShareError('SHARE_INVITE_INVALID: Enter at least one email.');
      return;
    }

    setShareError(null);
    setShareFeedback(null);
    try {
      const response = await fetch('/api/shares/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comparisonId: activeComparisonId,
          invitedEmails
        })
      });
      const payload = (await response.json()) as
        | { invited?: Array<{ invitedEmail: string }> }
        | { code?: string; message?: string };
      if (!response.ok) {
        const err = payload as { code?: string; message?: string };
        setShareError(`${err.code || 'SHARE_INVITE_FAILED'}: ${err.message || 'Invite failed.'}`);
        return;
      }
      const invited = (payload as { invited?: Array<{ invitedEmail: string }> }).invited || [];
      setShareFeedback(`Invited ${invited.length} recipient(s).`);
      setShareInput('');
      await loadShareRecipients(activeComparisonId);
    } catch {
      setShareError('SHARE_INVITE_FAILED: Invite failed.');
    }
  }

  async function revokeRecipient(invitedEmail: string) {
    if (!activeComparisonId) return;
    setShareError(null);
    setShareFeedback(null);
    try {
      const response = await fetch('/api/shares/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comparisonId: activeComparisonId,
          invitedEmails: [invitedEmail]
        })
      });
      const payload = (await response.json()) as { code?: string; message?: string };
      if (!response.ok) {
        setShareError(`${payload.code || 'SHARE_REVOKE_FAILED'}: ${payload.message || 'Revoke failed.'}`);
        return;
      }
      setShareFeedback(`Revoked ${invitedEmail}.`);
      await loadShareRecipients(activeComparisonId);
    } catch {
      setShareError('SHARE_REVOKE_FAILED: Revoke failed.');
    }
  }

  async function loadSessionHistory(activeSessionId: string) {
    setHistoryError(null);
    try {
      const response = await fetch(`/api/history/sessions?sessionId=${encodeURIComponent(activeSessionId)}`, {
        method: 'GET',
        cache: 'no-store'
      });
      const payload = (await response.json()) as
        | { sessions?: SessionComparisonEntry[] }
        | { code?: string; message?: string };
      if (!response.ok) {
        const err = payload as { code?: string; message?: string };
        setHistoryError(`${err.code || 'SESSION_HISTORY_FAILED'}: ${err.message || 'Could not load comparisons.'}`);
        setHistorySessions([]);
        return;
      }
      const sessions = (payload as { sessions?: SessionComparisonEntry[] }).sessions || [];
      setHistorySessions(sessions);
      setRenameDraft((current) => {
        const next = { ...current };
        for (const entry of sessions) {
          if (next[entry.historyId] === undefined) {
            next[entry.historyId] = entry.sessionName || entry.comparisonLabel;
          }
        }
        return next;
      });
    } catch {
      setHistoryError('SESSION_HISTORY_FAILED: Could not load comparisons.');
      setHistorySessions([]);
    }
  }

  async function renameComparison(historyId: string) {
    const sessionName = (renameDraft[historyId] || '').trim();
    setHistoryError(null);
    setHistoryFeedback(null);
    try {
      const response = await fetch(`/api/history/sessions/${encodeURIComponent(historyId)}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionName })
      });
      const payload = (await response.json()) as { code?: string; message?: string };
      if (!response.ok) {
        setHistoryError(`${payload.code || 'HISTORY_RENAME_FAILED'}: ${payload.message || 'Rename failed.'}`);
        return;
      }
      setHistoryFeedback('Comparison label updated.');
      if (sessionId) {
        await loadSessionHistory(sessionId);
      }
    } catch {
      setHistoryError('HISTORY_RENAME_FAILED: Rename failed.');
    }
  }

  async function deleteComparison(historyId: string) {
    setHistoryError(null);
    setHistoryFeedback(null);
    try {
      const response = await fetch(`/api/history/sessions/${encodeURIComponent(historyId)}/delete`, {
        method: 'POST'
      });
      const payload = (await response.json()) as { code?: string; message?: string };
      if (!response.ok) {
        setHistoryError(`${payload.code || 'HISTORY_DELETE_FAILED'}: ${payload.message || 'Delete failed.'}`);
        return;
      }
      setHistoryFeedback('Comparison deleted.');
      if (sessionId) {
        await loadSessionHistory(sessionId);
      }
    } catch {
      setHistoryError('HISTORY_DELETE_FAILED: Delete failed.');
    }
  }

  function applyNextRevisionFile(file: File | null) {
    setNextRevisionFile(file);
    setChainUploadError(null);
  }

  function applyDroppedNextRevision(files: FileList | null) {
    const droppedFiles = Array.from(files || []);
    if (droppedFiles.length !== 1) {
      setChainUploadError('UPLOAD_FILE_COUNT_INVALID: Drop exactly one new file.');
      return;
    }
    applyNextRevisionFile(droppedFiles[0]);
  }

  async function submitNextRevision() {
    if (!sessionId) {
      setChainUploadError('UPLOAD_SESSION_NOT_FOUND: Current session is unavailable.');
      return;
    }
    if (!nextRevisionFile) {
      setChainUploadError('UPLOAD_FILE_COUNT_INVALID: Select one new file.');
      return;
    }

    setChainUploadBusy(true);
    setChainUploadError(null);
    try {
      const validationForm = new FormData();
      validationForm.append('sessionId', sessionId);
      validationForm.append('fileB', nextRevisionFile);

      const validateResponse = await fetch('/api/uploads/validate', {
        method: 'POST',
        body: validationForm
      });
      const validatePayload = (await validateResponse.json()) as { code?: string; message?: string };
      if (!validateResponse.ok) {
        setChainUploadError(
          `${validatePayload.code || 'UPLOAD_VALIDATE_FAILED'}: ${validatePayload.message || 'Validation failed.'}`
        );
        return;
      }

      const intakeForm = new FormData();
      intakeForm.append('sessionId', sessionId);
      intakeForm.append('fileB', nextRevisionFile);
      const intakeResponse = await fetch('/api/uploads/intake', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: intakeForm
      });
      const intakePayload = (await intakeResponse.json()) as
        | { code?: string; message?: string }
        | { sessionId: string; leftRevisionId: string | null; rightRevisionId: string | null };
      if (!intakeResponse.ok) {
        const err = intakePayload as { code?: string; message?: string };
        setChainUploadError(`${err.code || 'UPLOAD_INTAKE_FAILED'}: ${err.message || 'Comparison intake failed.'}`);
        return;
      }

      const accepted = intakePayload as {
        sessionId: string;
        leftRevisionId: string | null;
        rightRevisionId: string | null;
      };
      setChainUploadDialogOpen(false);
      setNextRevisionFile(null);
      router.push(
        `/results?sessionId=${encodeURIComponent(accepted.sessionId)}&leftRevisionId=${encodeURIComponent(
          accepted.leftRevisionId || ''
        )}&rightRevisionId=${encodeURIComponent(accepted.rightRevisionId || '')}`
      );
    } catch {
      setChainUploadError('UPLOAD_INTAKE_FAILED: Comparison intake failed.');
    } finally {
      setChainUploadBusy(false);
    }
  }

  function buildRowsQuery(cursor: string, limit: number): string {
    const params = new URLSearchParams();
    params.set('cursor', cursor);
    params.set('limit', String(limit));
    if (search.trim()) {
      params.set('searchText', search.trim());
    }

    const filters: Array<{ field: string; op: 'eq' | 'contains'; value: string }> = [];
    if (partFilter.trim()) {
      filters.push({
        field: 'keyFields.partNumber',
        op: 'contains',
        value: partFilter.trim()
      });
    }
    if (changeFilter !== 'all') {
      filters.push({
        field: 'changeType',
        op: 'eq',
        value: changeFilter
      });
    }
    if (filters.length > 0) {
      params.set('filters', JSON.stringify(filters));
    }

    if (sortMode === 'part') {
      params.set('sortBy', 'keyFields.partNumber');
    } else if (sortMode === 'change') {
      params.set('sortBy', 'changeType');
    } else {
      params.set('sortBy', 'sourceIndex');
    }
    params.set('sortDir', 'asc');
    return params.toString();
  }

  function buildTreeQuery(cursor: string, limit: number, expanded: string[] = expandedNodeIds): string {
    const params = new URLSearchParams();
    params.set('cursor', cursor);
    params.set('limit', String(limit));
    if (expanded.length > 0) {
      params.set('expandedNodeIds', expanded.join(','));
    }
    if (search.trim()) {
      params.set('searchText', search.trim());
    }

    const filters: Array<{ field: string; op: 'eq' | 'contains'; value: string }> = [];
    if (partFilter.trim()) {
      filters.push({
        field: 'keyFields.partNumber',
        op: 'contains',
        value: partFilter.trim()
      });
    }
    if (changeFilter !== 'all') {
      filters.push({
        field: 'changeType',
        op: 'eq',
        value: changeFilter
      });
    }
    if (filters.length > 0) {
      params.set('filters', JSON.stringify(filters));
    }

    if (sortMode === 'part') {
      params.set('sortBy', 'keyFields.partNumber');
    } else if (sortMode === 'change') {
      params.set('sortBy', 'changeType');
    } else {
      params.set('sortBy', 'sourceIndex');
    }
    params.set('sortDir', 'asc');
    return params.toString();
  }

  async function loadPage(nextJobId: string, cursor: string): Promise<boolean> {
    try {
      const response = await fetch(
        `/api/diff-jobs/${encodeURIComponent(nextJobId)}/rows?${buildRowsQuery(cursor, pageSize)}`,
        {
          method: 'GET',
          cache: 'no-store'
        }
      );
      const payload = (await response.json()) as {
        rows?: DiffRow[];
        nextCursor?: string | null;
        loadedRows?: number;
        totalRows?: number;
        code?: string;
        message?: string;
      };
      if (!response.ok) {
        setError(`${payload.code || 'DIFF_ROWS_FAILED'}: ${payload.message || 'Could not load diff rows.'}`);
        return false;
      }
      setRows(payload.rows || []);
      setCurrentCursor(cursor);
      setNextCursor(payload.nextCursor || null);
      setFilteredTotalRows(payload.totalRows || 0);
      return true;
    } catch {
      setError('DIFF_ROWS_FAILED: Could not load diff rows.');
      return false;
    }
  }

  async function loadTreePage(nextJobId: string, cursor: string, expanded: string[] = expandedNodeIds): Promise<boolean> {
    try {
      const response = await fetch(
        `/api/diff-jobs/${encodeURIComponent(nextJobId)}/tree?${buildTreeQuery(cursor, pageSize, expanded)}`,
        {
          method: 'GET',
          cache: 'no-store'
        }
      );
      const payload = (await response.json()) as {
        nodes?: DiffTreeNode[];
        nextCursor?: string | null;
        totalRows?: number;
        code?: string;
        message?: string;
      };
      if (!response.ok) {
        setError(`${payload.code || 'DIFF_TREE_FAILED'}: ${payload.message || 'Could not load hierarchy view.'}`);
        return false;
      }
      setTreeNodes(payload.nodes || []);
      setCurrentCursor(cursor);
      setNextCursor(payload.nextCursor || null);
      setFilteredTotalRows(payload.totalRows || 0);
      return true;
    } catch {
      setError('DIFF_TREE_FAILED: Could not load hierarchy view.');
      return false;
    }
  }

  async function startDiffJob() {
    setIsStarting(true);
    setError(null);
    setRows([]);
    setTreeNodes([]);
    setExpandedNodeIds([]);
    setStatus(null);
    setJobId(null);
    resetPagination();
    lastStatusLoadedRowsRef.current = 0;

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
      lastStatusLoadedRowsRef.current = started.loadedRows;
      const params = new URLSearchParams(searchParams.toString());
      params.set('comparisonId', started.jobId);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      if (viewMode === 'tree') {
        await loadTreePage(started.jobId, '0');
      } else {
        await loadPage(started.jobId, '0');
      }
    } catch {
      setError('DIFF_START_FAILED: Could not start diff job.');
    } finally {
      setIsStarting(false);
    }
  }

  async function goToNextPage() {
    if (!jobId || !nextCursor) return;
    const previousCursor = currentCursor;
    const loaded =
      viewMode === 'tree' ? await loadTreePage(jobId, nextCursor) : await loadPage(jobId, nextCursor);
    if (loaded) {
      setCursorHistory((current) => [...current, previousCursor]);
    }
  }

  async function goToPreviousPage() {
    if (!jobId || cursorHistory.length === 0) return;
    const previousCursor = cursorHistory[cursorHistory.length - 1];
    const loaded =
      viewMode === 'tree' ? await loadTreePage(jobId, previousCursor) : await loadPage(jobId, previousCursor);
    if (loaded) {
      setCursorHistory((current) => current.slice(0, current.length - 1));
    }
  }

  async function toggleView(nextMode: ResultsViewMode) {
    if (nextMode === viewMode) return;
    setViewMode(nextMode);
    setCurrentCursor('0');
    setNextCursor(null);
    setCursorHistory([]);
    if (!jobId) return;
    if (nextMode === 'tree') {
      await loadTreePage(jobId, '0');
      return;
    }
    await loadPage(jobId, '0');
  }

  async function toggleTreeNode(nodeId: string) {
    if (!jobId) return;
    const nextExpanded = expandedNodeIds.includes(nodeId)
      ? expandedNodeIds.filter((entry) => entry !== nodeId)
      : [...expandedNodeIds, nodeId];
    setExpandedNodeIds(nextExpanded);
    setCurrentCursor('0');
    setNextCursor(null);
    setCursorHistory([]);
    await loadTreePage(jobId, '0', nextExpanded);
  }

  useEffect(() => {
    if (comparisonIdParam) {
      setJobId((current) => (current === comparisonIdParam ? current : comparisonIdParam));
      setRows([]);
      setTreeNodes([]);
      setExpandedNodeIds([]);
      setStatus(null);
      setError(null);
      resetPagination();
      lastStatusLoadedRowsRef.current = 0;
      return;
    }
    void startDiffJob();
  }, [comparisonIdParam, sessionId, leftRevisionId, rightRevisionId]);

  useEffect(() => {
    if (!jobId) return;
    if (status?.status === 'completed' && !status.errorCode && !status.errorMessage) return;
    const timer = setInterval(async () => {
      if (statusPollInFlightRef.current) return;
      statusPollInFlightRef.current = true;
      try {
        const response = await fetch(`/api/diff-jobs/${encodeURIComponent(jobId)}`, {
          method: 'GET',
          cache: 'no-store'
        });
        const payload = (await response.json()) as DiffStatus | { code?: string; message?: string };
        if (!response.ok) {
          const err = payload as { code?: string; message?: string };
          setError((current) => {
            const latestStatus = latestStatusRef.current;
            if (
              latestStatus?.status === 'completed' &&
              !latestStatus.errorCode &&
              !latestStatus.errorMessage
            ) {
              return current;
            }
            return `${err.code || 'DIFF_STATUS_FAILED'}: ${err.message || 'Could not load status.'}`;
          });
          return;
        }
        const currentStatus = payload as DiffStatus;
        setStatus(currentStatus);

        if (currentStatus.errorCode || currentStatus.errorMessage) {
          setError(
            `${currentStatus.errorCode || 'DIFF_STATUS_FAILED'}: ${
              currentStatus.errorMessage || 'Diff job failed.'
            }`
          );
          return;
        }
        setError((current) => (current?.startsWith('DIFF_STATUS_') ? null : current));

        const statusAdvanced = currentStatus.loadedRows !== lastStatusLoadedRowsRef.current;
        const currentViewCount =
          viewMode === 'tree' ? treeRowsCountRef.current : rowsCountRef.current;
        const needsHydration = currentStatus.status === 'completed' && currentViewCount === 0;
        if (statusAdvanced || needsHydration) {
          lastStatusLoadedRowsRef.current = currentStatus.loadedRows;
          if (viewMode === 'tree') {
            await loadTreePage(currentStatus.jobId, currentCursor);
          } else {
            await loadPage(currentStatus.jobId, currentCursor);
          }
        }
      } catch {
        setError((current) => {
          const latestStatus = latestStatusRef.current;
          if (
            latestStatus?.status === 'completed' &&
            !latestStatus.errorCode &&
            !latestStatus.errorMessage
          ) {
            return current;
          }
          return 'DIFF_STATUS_FAILED: Could not load status.';
        });
      } finally {
        statusPollInFlightRef.current = false;
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [jobId, currentCursor, pageSize, search, partFilter, changeFilter, sortMode, status, viewMode, expandedNodeIds]);

  useEffect(() => {
    if (!jobId) return;
    setRows([]);
    setTreeNodes([]);
    setCurrentCursor('0');
    setNextCursor(null);
    setCursorHistory([]);
    if (viewMode === 'tree') {
      void loadTreePage(jobId, '0');
    } else {
      void loadPage(jobId, '0');
    }
  }, [jobId, search, partFilter, changeFilter, sortMode, pageSize, viewMode, expandedNodeIds]);

  useEffect(() => {
    if (!activeComparisonId) {
      setShareRecipients([]);
      setShareError(null);
      return;
    }
    void loadShareRecipients(activeComparisonId);
  }, [activeComparisonId]);

  useEffect(() => {
    if (!historyDialogOpen || !sessionId) return;
    void loadSessionHistory(sessionId);
  }, [historyDialogOpen, sessionId]);

  const visibleRows = rows;
  const visibleTreeNodes = treeNodes;
  const currentOffset = Number(currentCursor) || 0;
  const pageStart = filteredTotalRows === 0 ? 0 : currentOffset + 1;
  const pageEnd =
    filteredTotalRows === 0
      ? 0
      : Math.min(
          currentOffset + (viewMode === 'tree' ? visibleTreeNodes.length : visibleRows.length),
          filteredTotalRows
        );

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
      <div className="screenToolbar" data-testid="results-toolbar">
        <div className="screenToolbarActions resultsToolbarActionsDense resultsToolbarInline">
          {status && status.status === 'running' && (
            <div className="resultsProgressBadge" data-testid="results-partial-badge">
              <span className="resultsProgressLabel">Running</span>
              <div className="resultsProgressTrack" aria-hidden="true">
                <span className="resultsProgressFill" style={{ width: `${status.percentComplete}%` }} />
              </div>
              <span className="resultsProgressMeta">
                {status.phase} {status.percentComplete}%
              </span>
            </div>
          )}
          {status && status.status === 'completed' && !status.errorCode && !status.errorMessage && (
            <div className="resultsProgressBadge resultsProgressBadgeComplete" data-testid="results-complete-badge">
              <CheckCircleIcon />
              <div className="resultsProgressTrack" aria-hidden="true">
                <span className="resultsProgressFill" style={{ width: '100%' }} />
              </div>
              <span className="resultsProgressMeta">{status.loadedRows}/{status.totalRows}</span>
            </div>
          )}
          <div className="resultsInlineFilters resultsFilters resultsFiltersMain">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search text..."
              disabled={!resultsDynamicFiltersEnabled}
              data-testid="results-search-input"
            />
            <input
              value={partFilter}
              onChange={(event) => setPartFilter(event.target.value)}
              placeholder="Part number filter..."
              disabled={!resultsDynamicFiltersEnabled}
              data-testid="results-part-filter-input"
            />
            <select
              value={changeFilter}
              onChange={(event) => setChangeFilter(event.target.value as 'all' | ChangeType)}
              disabled={!resultsDynamicFiltersEnabled}
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
              onChange={(event) => setSortMode(event.target.value as 'source' | 'part' | 'change')}
              disabled={!resultsDynamicFiltersEnabled}
              data-testid="results-sort-select"
            >
              <option value="source">Sort: Source Order</option>
              <option value="part">Sort: Part Number</option>
              <option value="change">Sort: Change Type</option>
            </select>
          </div>
          <button
            className="screenIconAction"
            type="button"
            onClick={() => {
              setChainUploadError(null);
              setChainUploadDialogOpen(true);
            }}
            disabled={!sessionId || chainUploadBusy}
            aria-label="Upload next revision"
            title={!sessionId ? 'Current session is unavailable' : chainUploadBusy ? 'Uploading next revision' : 'Upload next revision'}
            data-testid="results-upload-next-btn"
          >
            <UploadTrayIcon />
          </button>
          <button
            className="screenIconAction"
            type="button"
            onClick={() => {
              setHistoryError(null);
              setHistoryFeedback(null);
              setHistoryDialogOpen(true);
            }}
            disabled={!sessionId}
            aria-label="Previous comparisons"
            title={!sessionId ? 'Current session is unavailable' : 'Previous comparisons'}
            data-testid="results-session-history-btn"
          >
            <HistoryIcon />
          </button>
          <button
            className={`screenIconAction ${viewMode === 'flat' ? 'screenIconActionActive' : ''}`}
            type="button"
            onClick={() => void toggleView('flat')}
            disabled={viewMode === 'flat'}
            aria-label="Flat view"
            title="Flat view"
            data-testid="results-view-flat-btn"
          >
            <FlatViewIcon />
          </button>
          <button
            className={`screenIconAction ${viewMode === 'tree' ? 'screenIconActionActive' : ''}`}
            type="button"
            onClick={() => void toggleView('tree')}
            disabled={!resultsTreeViewEnabled || viewMode === 'tree'}
            aria-label="Tree view"
            title="Tree view"
            data-testid="results-view-tree-btn"
          >
            <TreeViewIcon />
          </button>
          <button
            className="screenIconAction"
            type="button"
            onClick={() => setShareDialogOpen(true)}
            disabled={!activeComparisonId}
            aria-label="Share"
            title="Share"
            data-testid="results-share-btn"
          >
            <ShareIcon />
          </button>
          <button
            className="screenIconAction"
            type="button"
            onClick={() => setExportDialogOpen(true)}
            disabled={!activeComparisonId}
            aria-label="Export"
            title="Export"
            data-testid="results-export-menu-btn"
          >
            <ExportIcon />
          </button>
          <button
            className="screenIconAction"
            type="button"
            onClick={() => void startDiffJob()}
            disabled={isStarting}
            aria-label={isStarting ? 'Starting diff' : 'Run diff'}
            title={isStarting ? 'Starting diff' : 'Run diff'}
            data-testid="results-run-btn"
          >
            <RunIcon />
          </button>
        </div>
      </div>

      {error && (
        <div className="alertError" data-testid="results-error">
          {error}
        </div>
      )}

      {!resultsTreeViewEnabled && (
        <div className="alertWarning" data-testid="results-tree-feature-disabled">
          RESULTS_TREE_VIEW_DISABLED: Tree view is currently disabled by feature flag.
        </div>
      )}
      {!resultsDynamicFiltersEnabled && (
        <div className="alertWarning" data-testid="results-dynamic-filters-disabled">
          RESULTS_DYNAMIC_FILTERS_DISABLED: Dynamic search/sort/filter controls are disabled by feature flag.
        </div>
      )}

      <div className="resultsPagination" data-testid="results-pagination-controls">
        <div className="resultsPaginationGroup">
          <span className="resultsPaginationSummary">
            Showing {pageStart}-{pageEnd} of {filteredTotalRows}
          </span>
          <select
            className="resultsPaginationPageSize"
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value) as PageSize)}
            data-testid="results-page-size-select"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} rows
              </option>
            ))}
          </select>
          <button
            className="screenIconAction screenIconActionCompact"
            type="button"
            onClick={() => void goToPreviousPage()}
            disabled={cursorHistory.length === 0 || !jobId}
            aria-label="Previous page"
            title="Previous page"
            data-testid="results-page-prev"
          >
            <ChevronLeftIcon />
          </button>
          <button
            className="screenIconAction screenIconActionCompact"
            type="button"
            onClick={() => void goToNextPage()}
            disabled={!nextCursor || !jobId}
            aria-label="Next page"
            title="Next page"
            data-testid="results-page-next"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      {viewMode === 'flat' && (
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
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={6}>No rows for the current page/filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'tree' && (
        <div className="mappingTableWrap">
          {status?.status === 'running' && (
            <div className="alertWarning" data-testid="results-tree-loading-badge">
              Loading hierarchy...
            </div>
          )}
          <table className="mappingTable" data-testid="results-tree-table">
            <thead>
              <tr>
                <th>Hierarchy</th>
                <th>Change</th>
                <th>Part Number</th>
                <th>Revision</th>
                <th>Description</th>
                <th>Changed Fields</th>
              </tr>
            </thead>
            <tbody>
              {visibleTreeNodes.map((node) => {
                const expanded = expandedNodeIds.includes(node.nodeId);
                return (
                  <tr
                    key={node.nodeId}
                    className={`diffRow diffRow-${node.changeType}`}
                    data-testid={`tree-node-${node.nodeId}`}
                  >
                    <td>
                      <div style={{ paddingLeft: `${Math.max(0, node.depth) * 16}px`, display: 'flex', gap: '8px' }}>
                        {node.hasChildren ? (
                          <button
                            className="btn"
                            type="button"
                            onClick={() => void toggleTreeNode(node.nodeId)}
                            data-testid={`tree-toggle-${node.nodeId}`}
                          >
                            {expanded ? '-' : '+'}
                          </button>
                        ) : (
                          <span style={{ width: '36px', display: 'inline-block' }} />
                        )}
                        <span>{node.rowId}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`chip chip-${node.changeType}`}>{node.changeType}</span>
                    </td>
                    <td>{node.keyFields.partNumber || '-'}</td>
                    <td>{node.keyFields.revision || '-'}</td>
                    <td>
                      {node.keyFields.description || '-'}
                      {node.fromParent && node.toParent && (
                        <div data-testid={`tree-moved-context-${node.nodeId}`}>
                          {node.fromParent}
                          {' -> '}
                          {node.toParent}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="cellChips">
                        {node.changedFields.length === 0 && <span className="chip">none</span>}
                        {node.changedFields.map((field) => (
                          <span className="chip" key={`${node.nodeId}-${field}`}>
                            {field}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleTreeNodes.length === 0 && (
                <tr>
                  <td colSpan={6}>No hierarchy nodes for the current page/filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {chainUploadDialogOpen && (
        <div className="screenModalLayer" role="presentation">
          <button
            type="button"
            className="screenModalBackdrop"
            aria-label="Close upload next revision dialog"
            onClick={() => {
              if (chainUploadBusy) return;
              setChainUploadDialogOpen(false);
            }}
          />
          <section
            className="screenModalCard panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="results-upload-next-title"
            data-testid="results-upload-next-dialog"
          >
            <div className="screenModalHeader">
              <div>
                <p className="missionShellEyebrow">Upload Next Revision</p>
                <h2 className="h2" id="results-upload-next-title">
                  Compare latest file against a new file
                </h2>
              </div>
              <button
                className="screenIconAction"
                type="button"
                aria-label="Close upload next revision dialog"
                title="Close"
                onClick={() => {
                  if (chainUploadBusy) return;
                  setChainUploadDialogOpen(false);
                }}
              >
                <CloseIcon />
              </button>
            </div>
            <input
              ref={nextRevisionInputRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              hidden
              onChange={(event) => applyNextRevisionFile(event.target.files?.[0] || null)}
            />
            <div
              className={`uploadDropzone uploadDropzoneCompact ${chainUploadDragActive ? 'uploadDropzoneActive' : ''}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setChainUploadDragActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setChainUploadDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setChainUploadDragActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setChainUploadDragActive(false);
                applyDroppedNextRevision(event.dataTransfer.files);
              }}
            >
              <div className="uploadDropzoneIcon">
                <UploadTrayIcon />
              </div>
              <div className="uploadDropzoneText">
                <strong>{nextRevisionFile ? nextRevisionFile.name : 'Drag and drop the next BOM revision'}</strong>
              </div>
              <button
                className="btn"
                type="button"
                onClick={() => nextRevisionInputRef.current?.click()}
                disabled={chainUploadBusy}
                data-testid="results-upload-next-select-btn"
              >
                Select file
              </button>
            </div>
            {chainUploadError && (
              <div className="alertError" data-testid="results-upload-next-error">
                {chainUploadError}
              </div>
            )}
            <div className="screenDialogActions">
              <button
                className="btn"
                type="button"
                onClick={() => {
                  if (chainUploadBusy) return;
                  setChainUploadDialogOpen(false);
                }}
                disabled={chainUploadBusy}
              >
                Cancel
              </button>
              <button
                className="btn btnPrimary"
                type="button"
                onClick={() => void submitNextRevision()}
                disabled={!nextRevisionFile || chainUploadBusy || !sessionId}
                data-testid="results-upload-next-submit"
              >
                {chainUploadBusy ? 'Validating and opening...' : 'Validate and compare'}
              </button>
            </div>
          </section>
        </div>
      )}

      {historyDialogOpen && (
        <div className="screenModalLayer" role="presentation">
          <button
            type="button"
            className="screenModalBackdrop"
            aria-label="Close previous comparisons dialog"
            onClick={() => setHistoryDialogOpen(false)}
          />
          <section
            className="screenModalCard panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="results-history-dialog-title"
            data-testid="results-session-history-dialog"
          >
            <div className="screenModalHeader">
              <div>
                <p className="missionShellEyebrow">Previous Comparisons</p>
                <h2 className="h2" id="results-history-dialog-title">
                  Previous comparisons
                </h2>
              </div>
              <button
                className="screenIconAction"
                type="button"
                aria-label="Close previous comparisons dialog"
                title="Close"
                onClick={() => setHistoryDialogOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            {historyError && (
              <div className="alertError" data-testid="results-session-history-error">
                {historyError}
              </div>
            )}
            {historyFeedback && (
              <div className="alertSuccess" data-testid="results-session-history-feedback">
                {historyFeedback}
              </div>
            )}
            <div className="mappingTableWrap">
              <table className="mappingTable" data-testid="results-session-history-table">
                <thead>
                  <tr>
                    <th>Comparison</th>
                    <th>Uploaded</th>
                    <th>User</th>
                    <th>State</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {historySessions.length === 0 && (
                    <tr>
                      <td colSpan={5}>No previous comparisons in this session.</td>
                    </tr>
                  )}
                  {historySessions.map((entry) => (
                    <tr key={entry.historyId}>
                      <td>
                        <div className="resultsHistoryLabelCell">
                          <input
                            value={renameDraft[entry.historyId] || ''}
                            onChange={(event) =>
                              setRenameDraft((current) => ({
                                ...current,
                                [entry.historyId]: event.target.value
                              }))
                            }
                            placeholder={entry.comparisonLabel}
                            data-testid={`results-session-history-rename-${entry.historyId}`}
                          />
                        </div>
                      </td>
                      <td>{new Date(entry.createdAtUtc).toLocaleString()}</td>
                      <td>{entry.initiatorEmail}</td>
                      <td>{entry.latest ? 'Latest' : new Date(entry.createdAtUtc).toLocaleString()}</td>
                      <td>
                        <div className="screenRowActions">
                          <button
                            className="screenIconAction screenIconActionCompact"
                            type="button"
                            onClick={() => void renameComparison(entry.historyId)}
                            aria-label={`Rename ${entry.comparisonLabel}`}
                            title="Rename"
                            data-testid={`results-session-history-save-${entry.historyId}`}
                          >
                            <EditIcon />
                          </button>
                          <button
                            className="screenIconAction screenIconActionCompact"
                            type="button"
                            onClick={() => {
                              if (!entry.leftRevisionId || !entry.rightRevisionId) return;
                              setHistoryDialogOpen(false);
                              router.push(
                                `/results?sessionId=${encodeURIComponent(entry.sessionId)}&leftRevisionId=${encodeURIComponent(
                                  entry.leftRevisionId
                                )}&rightRevisionId=${encodeURIComponent(entry.rightRevisionId)}`
                              );
                            }}
                            disabled={!entry.leftRevisionId || !entry.rightRevisionId}
                            aria-label={`Open ${entry.comparisonLabel}`}
                            title="Open"
                            data-testid={`results-session-history-open-${entry.historyId}`}
                          >
                            <OpenIcon />
                          </button>
                          <button
                            className="screenIconAction screenIconActionCompact"
                            type="button"
                            onClick={() => void deleteComparison(entry.historyId)}
                            aria-label={`Delete ${entry.comparisonLabel}`}
                            title="Delete"
                            data-testid={`results-session-history-delete-${entry.historyId}`}
                          >
                            <DeleteIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {shareDialogOpen && (
        <div className="screenModalLayer" role="presentation">
          <button
            type="button"
            className="screenModalBackdrop"
            aria-label="Close share dialog"
            onClick={() => setShareDialogOpen(false)}
          />
          <section
            className="screenModalCard panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="results-share-dialog-title"
            data-testid="share-panel"
          >
            <div className="screenModalHeader">
              <div>
                <p className="missionShellEyebrow">Share Results</p>
                <h2 className="h2" id="results-share-dialog-title">
                  Same-tenant recipients
                </h2>
              </div>
              <button
                className="screenIconAction"
                type="button"
                aria-label="Close share dialog"
                title="Close"
                onClick={() => setShareDialogOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            {!activeComparisonId && <p className="p">Run diff first to enable sharing for this comparison.</p>}
            {activeComparisonId && (
              <>
                <p className="p">Invite same-tenant recipients (view-only). Access is bound to exact invited email.</p>
                <div className="screenInlineForm">
                  <input
                    value={shareInput}
                    onChange={(event) => setShareInput(event.target.value)}
                    placeholder="alice@example.com, bob@example.com"
                    data-testid="share-invite-input"
                  />
                  <button className="btn" type="button" onClick={() => void inviteRecipients()} data-testid="share-invite-btn">
                    Invite
                  </button>
                </div>
                {shareError && (
                  <div className="alertError" data-testid="share-error">
                    {shareError}
                  </div>
                )}
                {shareFeedback && (
                  <div className="alertSuccess" data-testid="share-feedback">
                    {shareFeedback}
                  </div>
                )}
                <div className="mappingTableWrap">
                  <table className="mappingTable" data-testid="share-recipients-table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Permission</th>
                        <th>Invited</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shareRecipients.length === 0 && (
                        <tr>
                          <td colSpan={4}>No active recipients.</td>
                        </tr>
                      )}
                      {shareRecipients.map((recipient) => (
                        <tr key={recipient.invitedEmail}>
                          <td>{recipient.invitedEmail}</td>
                          <td>{recipient.permission}</td>
                          <td>{new Date(recipient.createdAtUtc).toLocaleString()}</td>
                          <td>
                            <button
                              className="btn"
                              type="button"
                              onClick={() => void revokeRecipient(recipient.invitedEmail)}
                              data-testid={`share-revoke-${recipient.invitedEmail}`}
                            >
                              Revoke
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {exportDialogOpen && (
        <div className="screenModalLayer" role="presentation">
          <button
            type="button"
            className="screenModalBackdrop"
            aria-label="Close export dialog"
            onClick={() => setExportDialogOpen(false)}
          />
          <section
            className="screenModalCard screenModalCardCompact panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="results-export-dialog-title"
          >
            <div className="screenModalHeader">
              <div>
                <p className="missionShellEyebrow">Export Results</p>
                <h2 className="h2" id="results-export-dialog-title">
                  Download format
                </h2>
              </div>
              <button
                className="screenIconAction"
                type="button"
                aria-label="Close export dialog"
                title="Close"
                onClick={() => setExportDialogOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            {!activeComparisonId ? (
              <p className="p">Run diff first to enable exports for this comparison.</p>
            ) : (
              <div className="screenDialogActions">
                <a
                  className="btn"
                  href={`/api/exports/csv/${encodeURIComponent(activeComparisonId)}`}
                  data-testid="results-export-csv-link"
                >
                  CSV
                </a>
                <a
                  className="btn"
                  href={`/api/exports/excel/${encodeURIComponent(activeComparisonId)}`}
                  data-testid="results-export-excel-link"
                >
                  Excel
                </a>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
