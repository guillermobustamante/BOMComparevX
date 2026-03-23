'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DeleteIcon,
  ExportIcon,
  FileDetailsIcon,
  FlatViewIcon,
  HistoryIcon,
  OpenIcon,
  RunIcon,
  ShareIcon,
  TreeViewIcon,
  UploadTrayIcon
} from '@/components/mission-icons';
import { ResultsImpactDialog } from './results-impact-dialog';
import { ChangeType, DiffRow, ImpactCriticality } from './results-grid-contract';
import {
  ActiveWorkspaceState,
  buildResultsUrlFromWorkspace,
  clearActiveWorkspace,
  readActiveWorkspace,
  writeActiveWorkspace
} from '@/lib/active-workspace';

type PageSize = 50 | 100 | 200;
type ResultsViewMode = 'flat' | 'tree';

interface DiffStatus {
  contractVersion: string;
  jobId: string;
  sessionId: string | null;
  leftRevisionId: string | null;
  rightRevisionId: string | null;
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
  comparisonId: string | null;
  comparisonLabel: string;
  comparisonDateLabel: string;
  current: boolean;
  latest: boolean;
  canRename: boolean;
  canDelete: boolean;
}

interface ValidationWarning {
  code: string;
  message: string;
  file?: 'fileA' | 'fileB';
  selectedSheetName?: string;
}

interface WorkbookMetadataSuccess {
  fileKind: 'csv' | 'workbook';
  visibleSheets: Array<{ name: string; preferred: boolean }>;
  selectedSheetName: string;
  dropdownDisabled: boolean;
}

interface SheetSelectorState {
  fileKind: 'csv' | 'workbook' | null;
  options: Array<{ name: string; preferred: boolean }>;
  selectedSheetName: string;
  dropdownDisabled: boolean;
  isLoading: boolean;
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
const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  added: 'Added',
  removed: 'Removed',
  replaced: 'Replaced',
  modified: 'Modified',
  moved: 'Moved',
  quantity_change: 'Quantity changed',
  no_change: 'No change'
};

function emptySheetSelectorState(label = 'Select file first'): SheetSelectorState {
  return {
    fileKind: null,
    options: [{ name: label, preferred: true }],
    selectedSheetName: '',
    dropdownDisabled: true,
    isLoading: false
  };
}

function formatComparisonDateHuman(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}) UTC$/.exec((value || '').trim());
  if (!match) return value;
  const [, year, month, day, hours, minutes] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes)));
  const formatted = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC'
  }).format(parsed);
  return `${formatted} UTC`;
}

function formatComparisonLabelHuman(entry: Pick<SessionComparisonEntry, 'comparisonLabel' | 'comparisonDateLabel'>): string {
  const rawLabel = entry.comparisonLabel || '';
  const rawDate = entry.comparisonDateLabel || '';
  const humanDate = formatComparisonDateHuman(rawDate);
  if (!rawLabel || !rawDate || !humanDate) return rawLabel;
  const suffix = ` (${rawDate})`;
  return rawLabel.endsWith(suffix) ? `${rawLabel.slice(0, -suffix.length)} (${humanDate})` : rawLabel;
}

function effectiveSessionName(entry: Pick<SessionComparisonEntry, 'sessionName' | 'comparisonLabel'> | null): string {
  if (!entry) return '';
  const explicitName = (entry.sessionName || '').trim();
  if (explicitName) return explicitName;
  const rawLabel = (entry.comparisonLabel || '').trim();
  const match = /^(.*) \(\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC\)$/.exec(rawLabel);
  return (match?.[1] || rawLabel).trim();
}

function formatChangeTypeLabel(changeType: ChangeType): string {
  return CHANGE_TYPE_LABELS[changeType];
}

function humanizeToken(value: string): string {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  if (!normalized) return '';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatChangedFieldLabel(field: string): string {
  const normalized = field.trim();
  if (!normalized) return '';
  const knownLabels: Record<string, string> = {
    partNumber: 'Part number',
    revision: 'Revision',
    description: 'Description',
    quantity: 'Quantity',
    unitOfMeasure: 'Unit of measure',
    parentPath: 'Parent path',
    position: 'Position',
    level: 'Level'
  };
  return knownLabels[normalized] || humanizeToken(normalized);
}

function formatClassificationReason(reason: string, changeType?: ChangeType): string {
  const normalized = reason.trim();
  if (!normalized) {
    return changeType ? `${formatChangeTypeLabel(changeType)} detected` : 'Review rationale unavailable';
  }

  const knownReasons: Record<string, string> = {
    matched_no_change: 'No material difference detected',
    matched_modified: 'Matched item updated',
    matched_moved: 'Matched item moved within the BOM',
    matched_replaced: 'Matched item replaced',
    matched_quantity_change: 'Quantity changed between revisions',
    unmatched_source_row: 'Present only in the baseline revision',
    unmatched_target_row: 'Present only in the candidate revision',
    unmatched_pair_replacement: 'Baseline and candidate items were paired as a replacement'
  };
  if (knownReasons[normalized]) {
    return knownReasons[normalized];
  }
  if (normalized.startsWith('field_changed_')) {
    return `Field changed: ${formatChangedFieldLabel(normalized.slice('field_changed_'.length))}`;
  }
  if (normalized.startsWith('matched_')) {
    const matchedType = normalized.slice('matched_'.length) as ChangeType;
    if (matchedType in CHANGE_TYPE_LABELS) {
      return `${formatChangeTypeLabel(matchedType)} confirmed`;
    }
  }
  return humanizeToken(normalized);
}

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
  const hasExplicitWorkspaceParams = Boolean(comparisonIdParam || sessionId || leftRevisionId || rightRevisionId);

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
  const currentCursorRef = useRef('0');
  const viewModeRef = useRef<ResultsViewMode>('flat');
  const expandedNodeIdsRef = useRef<string[]>([]);

  const activeComparisonId = comparisonIdParam || jobId;
  const activeSessionId = sessionId || status?.sessionId || null;
  const activeLeftRevisionId = leftRevisionId || status?.leftRevisionId || null;
  const activeRightRevisionId = rightRevisionId || status?.rightRevisionId || null;
  const [shareInput, setShareInput] = useState('');
  const [shareRecipients, setShareRecipients] = useState<ShareRecipient[]>([]);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [shareRecipientsLoaded, setShareRecipientsLoaded] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [chainUploadDialogOpen, setChainUploadDialogOpen] = useState(false);
  const [currentComparisonDialogOpen, setCurrentComparisonDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [impactDialogRow, setImpactDialogRow] = useState<DiffRow | null>(null);
  const [historySessions, setHistorySessions] = useState<SessionComparisonEntry[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyFeedback, setHistoryFeedback] = useState<string | null>(null);
  const [historySessionsLoaded, setHistorySessionsLoaded] = useState(false);
  const [historySessionsLoading, setHistorySessionsLoading] = useState(false);
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});
  const [sessionNameDraft, setSessionNameDraft] = useState('');
  const [sessionRenameBusy, setSessionRenameBusy] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [workspaceRestoreResolved, setWorkspaceRestoreResolved] = useState(false);
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState<ActiveWorkspaceState | null>(null);
  const [nextRevisionFile, setNextRevisionFile] = useState<File | null>(null);
  const [nextRevisionSheetSelector, setNextRevisionSheetSelector] = useState<SheetSelectorState>(() =>
    emptySheetSelectorState()
  );
  const [chainUploadError, setChainUploadError] = useState<string | null>(null);
  const [chainUploadBusy, setChainUploadBusy] = useState(false);
  const [chainUploadDragActive, setChainUploadDragActive] = useState(false);
  const [chainUploadWarnings, setChainUploadWarnings] = useState<ValidationWarning[]>([]);
  const [chainUploadWarningDialogOpen, setChainUploadWarningDialogOpen] = useState(false);
  const nextRevisionInputRef = useRef<HTMLInputElement | null>(null);

  function impactCriticalityClass(value: ImpactCriticality | null | undefined): string {
    if (!value) return 'impactBadgeNone';
    return `impactBadge${value}`;
  }

  function hasImpactCategories(row: DiffRow): boolean {
    return !!row.impactClassification?.categories.length;
  }

  function fallbackImpactLabel(row: DiffRow): string {
    return row.changeType === 'no_change' ? 'No review needed' : 'Review needed';
  }

  function impactCriticalityLabel(row: DiffRow): string {
    return row.impactClassification?.impactCriticality || fallbackImpactLabel(row);
  }

  function primaryImpactCategory(row: DiffRow): string {
    const categories = row.impactClassification?.categories || [];
    if (!categories.length) {
      return fallbackImpactLabel(row);
    }
    return categories[0].category;
  }

  function impactOverflowCount(row: DiffRow): number {
    const categories = row.impactClassification?.categories || [];
    return Math.max(0, categories.length - 1);
  }

  function impactOverflowTooltip(row: DiffRow): string {
    const categories = row.impactClassification?.categories || [];
    if (!categories.length) {
      return fallbackImpactLabel(row);
    }
    return categories.map((category) => `${category.category} (${category.impactCriticality})`).join('\n');
  }

  function summarizeImpact(row: DiffRow): string {
    const primaryCategory = primaryImpactCategory(row);
    const overflowCount = impactOverflowCount(row);
    return overflowCount > 0 ? `${primaryCategory} +${overflowCount}` : primaryCategory;
  }

  function formatStatusPhase(phase: DiffStatus['phase']): string {
    switch (phase) {
      case 'matching':
        return 'Matching';
      case 'classifying':
        return 'Classifying';
      case 'finalizing':
        return 'Finalizing';
      case 'completed':
      default:
        return 'Ready';
    }
  }

  function buildAdminTaxonomyLink(row: DiffRow): string {
    const params = new URLSearchParams({ section: 'taxonomyImpacts' });
    if (row.rationale.changedFields[0]) {
      params.set('field', row.rationale.changedFields[0]);
    }
    if (row.rationale.classificationReason) {
      params.set('rationale', row.rationale.classificationReason);
    }
    return `/admin?${params.toString()}#admin-taxonomy-impacts`;
  }

  function changeTone(changeType: ChangeType): string {
    switch (changeType) {
      case 'added':
        return 'added';
      case 'removed':
        return 'removed';
      case 'modified':
        return 'modified';
      case 'moved':
        return 'moved';
      case 'quantity_change':
        return 'qty';
      case 'replaced':
        return 'replaced';
      case 'no_change':
      default:
        return 'none';
    }
  }

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

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/admin/me', { method: 'GET', cache: 'no-store' });
        const payload = (await response.json()) as { isAdmin?: boolean };
        if (!active) return;
        setIsAdminUser(Boolean(response.ok && payload.isAdmin));
      } catch {
        if (!active) return;
        setIsAdminUser(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setWorkspaceSnapshot(readActiveWorkspace());
  }, []);

  useEffect(() => {
    if (workspaceRestoreResolved) return;
    if (hasExplicitWorkspaceParams) {
      setWorkspaceRestoreResolved(true);
      return;
    }
    const restored = readActiveWorkspace();
    const nextUrl = restored ? buildResultsUrlFromWorkspace(restored) : null;
    if (nextUrl) {
      router.replace(nextUrl, { scroll: false });
      return;
    }
    setWorkspaceRestoreResolved(true);
  }, [workspaceRestoreResolved, hasExplicitWorkspaceParams, router]);

  function resetPagination(): void {
    setCurrentCursor('0');
    setNextCursor(null);
    setCursorHistory([]);
    setFilteredTotalRows(0);
  }

  function buildResultsUrl(input: {
    comparisonId: string | null;
    sessionId: string | null;
    leftRevisionId: string | null;
    rightRevisionId: string | null;
  }): string | null {
    return buildResultsUrlFromWorkspace(input);
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
      setShareRecipientsLoaded(true);
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
    setHistorySessionsLoading(true);
    try {
      const query = new URLSearchParams({ sessionId: activeSessionId });
      if (activeComparisonId) {
        query.set('currentComparisonId', activeComparisonId);
      }
      const response = await fetch(`/api/history/sessions?${query.toString()}`, {
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
      setHistorySessionsLoaded(true);
      setRenameDraft((current) => {
        const next = { ...current };
        for (const entry of sessions) {
          if (next[entry.historyId] === undefined) {
            next[entry.historyId] = effectiveSessionName(entry);
          }
        }
        return next;
      });
    } catch {
      setHistoryError('SESSION_HISTORY_FAILED: Could not load comparisons.');
      setHistorySessions([]);
    } finally {
      setHistorySessionsLoading(false);
    }
  }

  async function ensureSessionHistoryLoaded(force = false) {
    if (!activeSessionId) return;
    if (historySessionsLoading) return;
    if (historySessionsLoaded && !force) return;
    await loadSessionHistory(activeSessionId);
  }

  async function renameComparison(historyId: string, nextSessionName?: string) {
    const sessionName = (nextSessionName ?? renameDraft[historyId] ?? '').trim();
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
      setHistoryFeedback('Session name updated.');
      if (activeSessionId) {
        await loadSessionHistory(activeSessionId);
      }
    } catch {
      setHistoryError('HISTORY_RENAME_FAILED: Rename failed.');
    }
  }

  async function saveSessionName() {
    const currentSessionEntry = historySessions.find((entry) => entry.current) || historySessions[0] || null;
    if (!currentSessionEntry) return;
    const normalizedDraft = sessionNameDraft.trim();
    if (normalizedDraft === effectiveSessionName(currentSessionEntry)) return;

    setSessionRenameBusy(true);
    setHistoryError(null);
    setHistoryFeedback(null);
    try {
      await renameComparison(currentSessionEntry.historyId, sessionNameDraft);
    } finally {
      setSessionRenameBusy(false);
    }
  }

  async function deleteComparison(historyId: string) {
    setHistoryError(null);
    setHistoryFeedback(null);
    try {
      const response = await fetch(`/api/history/sessions/${encodeURIComponent(historyId)}/delete`, {
        method: 'POST'
      });
      const payload = (await response.json()) as {
        code?: string;
        message?: string;
        sessionId?: string;
        nextActiveComparisonId?: string | null;
        nextActiveLeftRevisionId?: string | null;
        nextActiveRightRevisionId?: string | null;
      };
      if (!response.ok) {
        setHistoryError(`${payload.code || 'HISTORY_DELETE_FAILED'}: ${payload.message || 'Delete failed.'}`);
        return;
      }
      const nextUrl = buildResultsUrl({
        comparisonId: payload.nextActiveComparisonId || null,
        sessionId: payload.sessionId || activeSessionId,
        leftRevisionId: payload.nextActiveLeftRevisionId || null,
        rightRevisionId: payload.nextActiveRightRevisionId || null
      });
      setHistoryFeedback('Comparison deleted.');
      if (nextUrl) {
        setHistoryDialogOpen(false);
        router.replace(nextUrl, { scroll: false });
        return;
      }
      clearActiveWorkspace();
      router.replace('/results', { scroll: false });
      if (activeSessionId) {
        await loadSessionHistory(activeSessionId);
      }
    } catch {
      setHistoryError('HISTORY_DELETE_FAILED: Delete failed.');
    }
  }

  function applyNextRevisionFile(file: File | null) {
    setNextRevisionFile(file);
    setNextRevisionSheetSelector(file ? emptySheetSelectorState('Loading sheets...') : emptySheetSelectorState());
    setChainUploadError(null);
    setChainUploadWarnings([]);
    setChainUploadWarningDialogOpen(false);
  }

  function applyDroppedNextRevision(files: FileList | null) {
    const droppedFiles = Array.from(files || []);
    if (droppedFiles.length !== 1) {
      setChainUploadError('UPLOAD_FILE_COUNT_INVALID: Drop exactly one new file.');
      return;
    }
    applyNextRevisionFile(droppedFiles[0]);
  }

  async function discoverWorkbookMetadata(file: File): Promise<SheetSelectorState> {
    const form = new FormData();
    form.append('file', file);
    const response = await fetch('/api/uploads/workbook-metadata', {
      method: 'POST',
      body: form
    });
    const payload = (await response.json()) as { code?: string; message?: string } | WorkbookMetadataSuccess;
    if (!response.ok) {
      const err = payload as { code?: string; message?: string };
      throw new Error(`${err.code || 'UPLOAD_WORKBOOK_METADATA_FAILED'}: ${err.message || 'Sheet discovery failed.'}`);
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

  async function submitNextRevision() {
    if (!activeSessionId) {
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
      validationForm.append('sessionId', activeSessionId);
      validationForm.append('fileB', nextRevisionFile);
      if (nextRevisionSheetSelector.selectedSheetName) {
        validationForm.append('fileBSheetName', nextRevisionSheetSelector.selectedSheetName);
      }

      const validateResponse = await fetch('/api/uploads/validate', {
        method: 'POST',
        body: validationForm
      });
      const validatePayload = (await validateResponse.json()) as
        | { code?: string; message?: string }
        | { warnings?: ValidationWarning[] };
      if (!validateResponse.ok) {
        const err = validatePayload as { code?: string; message?: string };
        setChainUploadError(
          `${err.code || 'UPLOAD_VALIDATE_FAILED'}: ${err.message || 'Validation failed.'}`
        );
        return;
      }

      const validationWarnings = (validatePayload as { warnings?: ValidationWarning[] }).warnings || [];
      if (validationWarnings.length > 0) {
        setChainUploadWarnings(validationWarnings);
        setChainUploadWarningDialogOpen(true);
        return;
      }

      await continueNextRevisionAfterWarnings();
    } catch {
      setChainUploadError('UPLOAD_INTAKE_FAILED: Comparison intake failed.');
    } finally {
      setChainUploadBusy(false);
    }
  }

  async function continueNextRevisionAfterWarnings() {
    if (!activeSessionId || !nextRevisionFile) return;
    setChainUploadWarningDialogOpen(false);
    const intakeForm = new FormData();
    intakeForm.append('sessionId', activeSessionId);
    intakeForm.append('fileB', nextRevisionFile);
    if (nextRevisionSheetSelector.selectedSheetName) {
      intakeForm.append('fileBSheetName', nextRevisionSheetSelector.selectedSheetName);
    }
    try {
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
      setNextRevisionSheetSelector(emptySheetSelectorState());
      setChainUploadWarnings([]);
      router.push(
        `/results?sessionId=${encodeURIComponent(accepted.sessionId)}&leftRevisionId=${encodeURIComponent(
          accepted.leftRevisionId || ''
        )}&rightRevisionId=${encodeURIComponent(accepted.rightRevisionId || '')}`
      );
    } catch {
      setChainUploadError('UPLOAD_INTAKE_FAILED: Comparison intake failed.');
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!nextRevisionFile) {
      setNextRevisionSheetSelector(emptySheetSelectorState());
      return undefined;
    }
    setNextRevisionSheetSelector({
      fileKind: null,
      options: [{ name: 'Loading sheets...', preferred: true }],
      selectedSheetName: '',
      dropdownDisabled: true,
      isLoading: true
    });
    void discoverWorkbookMetadata(nextRevisionFile)
      .then((nextState) => {
        if (!cancelled) setNextRevisionSheetSelector(nextState);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setNextRevisionSheetSelector(emptySheetSelectorState('Unavailable'));
        setChainUploadError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [nextRevisionFile]);

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
    if (!workspaceRestoreResolved) return;
    if (comparisonIdParam) {
      if (comparisonIdParam === jobId) {
        return;
      }
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
  }, [comparisonIdParam, sessionId, leftRevisionId, rightRevisionId, workspaceRestoreResolved]);

  useEffect(() => {
    if (!jobId) return;
    if (status?.status === 'completed' && !status.errorCode && !status.errorMessage) return;
    let cancelled = false;
    let timer: number | undefined;

    const schedule = (delayMs: number) => {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        void pollStatus();
      }, delayMs);
    };

    const pollStatus = async () => {
      if (cancelled) return;
      if (document.visibilityState === 'hidden') {
        schedule(2500);
        return;
      }
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
          viewModeRef.current === 'tree' ? treeRowsCountRef.current : rowsCountRef.current;
        const needsHydration = currentStatus.status === 'completed' && currentViewCount === 0;
        if (statusAdvanced || needsHydration) {
          lastStatusLoadedRowsRef.current = currentStatus.loadedRows;
          if (viewModeRef.current === 'tree') {
            await loadTreePage(currentStatus.jobId, currentCursorRef.current, expandedNodeIdsRef.current);
          } else {
            await loadPage(currentStatus.jobId, currentCursorRef.current);
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
        const latestStatus = latestStatusRef.current;
        if (cancelled) return;
        if (latestStatus?.status === 'completed' && !latestStatus.errorCode && !latestStatus.errorMessage) {
          return;
        }
        schedule(latestStatus?.percentComplete && latestStatus.percentComplete >= 85 ? 2500 : 1500);
      }
    };

    schedule(1500);

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [jobId, status?.status]);

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
    currentCursorRef.current = currentCursor;
  }, [currentCursor]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    expandedNodeIdsRef.current = expandedNodeIds;
  }, [expandedNodeIds]);

  useEffect(() => {
    if (!activeComparisonId) {
      setShareRecipients([]);
      setShareError(null);
      setShareRecipientsLoaded(false);
      return;
    }
    setShareRecipients([]);
    setShareError(null);
    setShareFeedback(null);
    setShareRecipientsLoaded(false);
  }, [activeComparisonId]);

  useEffect(() => {
    if (!activeSessionId) {
      setHistorySessions([]);
      setHistorySessionsLoaded(false);
      setHistorySessionsLoading(false);
      setHistoryError(null);
      return;
    }
    setHistorySessions([]);
    setHistorySessionsLoaded(false);
    setHistorySessionsLoading(false);
    setHistoryError(null);
  }, [activeSessionId, activeComparisonId]);

  useEffect(() => {
    if (shareDialogOpen && activeComparisonId && !shareRecipientsLoaded) {
      void loadShareRecipients(activeComparisonId);
    }
  }, [shareDialogOpen, activeComparisonId, shareRecipientsLoaded]);

  useEffect(() => {
    if ((currentComparisonDialogOpen || historyDialogOpen) && activeSessionId && !historySessionsLoaded) {
      void ensureSessionHistoryLoaded();
    }
  }, [currentComparisonDialogOpen, historyDialogOpen, activeSessionId, historySessionsLoaded]);

  const currentSessionEntry = historySessions.find((entry) => entry.current) || historySessions[0] || null;
  const sessionNameDirty = sessionNameDraft.trim() !== effectiveSessionName(currentSessionEntry);
  const showSessionHeader = Boolean(activeComparisonId || activeSessionId || hasExplicitWorkspaceParams);
  const sessionTitleActionStripVisible = showSessionHeader;
  const sessionHeaderComparisonLabel = currentSessionEntry
    ? formatComparisonLabelHuman(currentSessionEntry)
    : workspaceSnapshot?.comparisonLabel
      ? workspaceSnapshot.comparisonLabel
      : activeComparisonId
        ? 'Comparison details load on demand'
        : 'No comparison loaded yet';

  useEffect(() => {
    setSessionNameDraft(effectiveSessionName(currentSessionEntry));
  }, [currentSessionEntry?.historyId, currentSessionEntry?.sessionName, currentSessionEntry?.comparisonLabel]);

  useEffect(() => {
    if (!activeSessionId || !currentSessionEntry) return;
    writeActiveWorkspace({
      sessionId: activeSessionId,
      comparisonId: activeComparisonId || null,
      historyId: currentSessionEntry.historyId,
      leftRevisionId: currentSessionEntry.leftRevisionId,
      rightRevisionId: currentSessionEntry.rightRevisionId,
      sessionName: effectiveSessionName(currentSessionEntry),
      comparisonLabel: currentSessionEntry.comparisonLabel
    });
    setWorkspaceSnapshot(readActiveWorkspace());
  }, [activeSessionId, activeComparisonId, currentSessionEntry]);

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

  const resultsActionStrip = (
    <div className="missionToggleStrip missionResultsActionStrip missionResultsHeaderActionStrip">
      <button
        className="screenIconAction missionResultsIconButton"
        type="button"
        onClick={() => {
          setCurrentComparisonDialogOpen(true);
          void ensureSessionHistoryLoaded();
        }}
        disabled={!activeSessionId}
        aria-label="Current file comparison"
        title={!activeSessionId ? 'Current session is unavailable' : 'Current file comparison'}
        data-testid="results-current-comparison-btn"
      >
        <FileDetailsIcon />
      </button>
      <button
        className="screenIconAction missionResultsIconButton"
        type="button"
        onClick={() => {
          setChainUploadError(null);
          setChainUploadDialogOpen(true);
        }}
        disabled={!activeSessionId || chainUploadBusy}
        aria-label="Upload next revision"
        title={
          !activeSessionId
            ? 'Current session is unavailable'
            : chainUploadBusy
              ? 'Uploading next revision'
              : 'Upload next revision'
        }
        data-testid="results-upload-next-btn"
      >
        <UploadTrayIcon />
      </button>
      <button
        className="screenIconAction missionResultsIconButton"
        type="button"
        onClick={() => {
          setHistoryError(null);
          setHistoryFeedback(null);
          setHistoryDialogOpen(true);
          void ensureSessionHistoryLoaded();
        }}
        disabled={!activeSessionId}
        aria-label="Previous comparisons"
        title={!activeSessionId ? 'Current session is unavailable' : 'Previous comparisons'}
        data-testid="results-session-history-btn"
      >
        <HistoryIcon />
      </button>
      <button
        className={`screenIconAction missionResultsIconButton ${viewMode === 'flat' ? 'screenIconActionActive' : ''}`}
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
        className={`screenIconAction missionResultsIconButton ${viewMode === 'tree' ? 'screenIconActionActive' : ''}`}
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
        className="screenIconAction missionResultsIconButton"
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
        className="screenIconAction missionResultsIconButton"
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
        className="screenIconAction missionResultsIconButton"
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
  );

  const toolbarProgressBadge =
    status && status.status === 'running' ? (
      <div
        className="resultsProgressBadge resultsProgressBadgeRunning missionResultsProgressBadge"
        data-testid="results-partial-badge"
      >
        <CheckCircleIcon />
        <span className="resultsProgressTrack" aria-hidden="true">
          <span className="resultsProgressFill" style={{ width: `${Math.max(12, status.percentComplete)}%` }} />
        </span>
        <span className="resultsProgressText">
          <strong className="resultsProgressMeta">
            {formatStatusPhase(status.phase)} {status.percentComplete}%
          </strong>
          <span className="resultsProgressHint">Comparison in progress</span>
        </span>
      </div>
    ) : status && status.status === 'completed' && !status.errorCode && !status.errorMessage ? (
      <div
        className="resultsProgressBadge resultsProgressBadgeComplete missionResultsProgressBadge"
        data-testid="results-complete-badge"
      >
        <CheckCircleIcon />
        <span className="resultsProgressTrack" aria-hidden="true">
          <span className="resultsProgressFill" style={{ width: '100%' }} />
        </span>
        <span className="resultsProgressText">
          <strong className="resultsProgressMeta">Ready to review</strong>
          <span className="resultsProgressHint">Diff finished</span>
        </span>
      </div>
    ) : (
      <div
        className="resultsProgressBadge resultsProgressBadgePending missionResultsProgressBadge"
        aria-live="polite"
        data-testid="results-loading-badge"
      >
        <CheckCircleIcon />
        <span className="resultsProgressTrack" aria-hidden="true">
          <span className="resultsProgressFill" style={{ width: '18%' }} />
        </span>
        <span className="resultsProgressText">
          <strong className="resultsProgressMeta">Preparing comparison</strong>
          <span className="resultsProgressHint">Loading workspace</span>
        </span>
      </div>
    );

  return (
    <>
      {showSessionHeader && (
        <section className="resultsSessionTitleBar" data-testid="results-session-title-bar">
          <div className="resultsSessionTitleBarMain">
            <div className="resultsSessionTitleEditor">
              <input
                id="results-session-name-input"
                value={currentSessionEntry ? sessionNameDraft : workspaceSnapshot?.sessionName || ''}
                onChange={(event) => setSessionNameDraft(event.target.value)}
                onFocus={() => {
                  void ensureSessionHistoryLoaded();
                }}
                onBlur={() => {
                  if (!sessionNameDirty || sessionRenameBusy || !currentSessionEntry?.canRename) return;
                  void saveSessionName();
                }}
                placeholder={
                  currentSessionEntry
                    ? effectiveSessionName(currentSessionEntry) || 'Untitled session'
                    : workspaceSnapshot?.sessionName || 'Session details load on demand'
                }
                readOnly={!currentSessionEntry?.canRename}
                aria-busy={!currentSessionEntry}
                data-testid="results-session-name-input"
              />
              {sessionNameDirty && currentSessionEntry?.canRename && (
                <button
                  className="btn btnPrimary"
                  type="button"
                  onClick={() => void saveSessionName()}
                  disabled={sessionRenameBusy}
                  data-testid="results-session-name-save"
                >
                  {sessionRenameBusy ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
            <div className="resultsSessionTitleRail">
              <span
                className="resultsSessionComparisonLabel"
                data-testid="results-session-comparison-label"
              >
                {sessionHeaderComparisonLabel}
              </span>
              <div className="resultsSessionTitleRailRight">
                {resultsActionStrip}
                <div className="cellChips resultsSessionStatusPills">
                  {currentSessionEntry ? (
                    <span
                      className="missionPill missionPillMeta"
                      title="How many saved comparisons are grouped in this revision chain."
                      data-testid="results-session-count-pill"
                    >
                      {historySessions.length} comparisons
                    </span>
                  ) : (
                    <span
                      className="missionPill missionPillMeta"
                      title="Session details load when you open the review details or history."
                      data-testid="results-session-loading-pill"
                    >
                      Session details on demand
                    </span>
                  )}
                  {currentSessionEntry?.current && (
                    <span
                      className="missionPill missionPillMeta"
                      title="The comparison currently open on this page."
                      data-testid="results-session-current-pill"
                    >
                      Current loaded
                    </span>
                  )}
                  {currentSessionEntry?.latest && (
                    <span
                      className="missionPill missionPillMeta"
                      title="The newest comparison already saved in this revision chain."
                      data-testid="results-session-latest-pill"
                    >
                      Latest available
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="panel missionResultsSurface" data-testid="results-panel">
      <div className="missionResultsToolbar" data-testid="results-toolbar">
        {!sessionTitleActionStripVisible && (
          <div className="missionResultsToolbarTop">
            {resultsActionStrip}
          </div>
        )}
        <div className="missionResultsToolbarGridRow">
          <div className="missionResultsToolbarLeft">
            {toolbarProgressBadge}
            <div className="resultsInlineFilters resultsFilters resultsFiltersMain missionResultsFiltersStrip">
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
          </div>
          <div className="resultsPagination missionResultsPagination missionResultsToolbarRight" data-testid="results-pagination-controls">
            <div className="resultsPaginationGroup missionResultsPaginationGroup">
              <span
                className="resultsPaginationSummary missionResultsPaginationSummary"
                data-testid="results-pagination-summary"
              >
                Showing {pageStart}-{pageEnd} of {filteredTotalRows}
              </span>
              <select
                className="resultsPaginationPageSize missionResultsPageSize"
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
                className="screenIconAction screenIconActionCompact missionResultsIconButton"
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
                className="screenIconAction screenIconActionCompact missionResultsIconButton"
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
        </div>
      </div>

      {error && (
        <div className="alertError missionResultsInlineAlert" data-testid="results-error">
          {error}
        </div>
      )}

      {!resultsTreeViewEnabled && (
        <div className="alertWarning missionResultsInlineAlert" data-testid="results-tree-feature-disabled">
          RESULTS_TREE_VIEW_DISABLED: Tree view is currently disabled by feature flag.
        </div>
      )}
      {!resultsDynamicFiltersEnabled && (
        <div className="alertWarning missionResultsInlineAlert" data-testid="results-dynamic-filters-disabled">
          RESULTS_DYNAMIC_FILTERS_DISABLED: Dynamic search/sort/filter controls are disabled by feature flag.
        </div>
      )}

      {viewMode === 'flat' && (
        <div className="mappingTableWrap missionResultsTableWrap">
          <table className="mappingTable missionGridTable missionResultsTable missionGridTableDense" data-testid="results-grid-table">
            <thead>
              <tr>
                <th>Change</th>
                <th>Part Number</th>
                <th>Revision</th>
                <th>Description</th>
                <th>Impact</th>
                <th>Rationale</th>
                <th>Changed Fields</th>
                <th>Classification</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const impactSummary = summarizeImpact(row);
                const primaryImpactSummary = primaryImpactCategory(row);
                const overflowImpactCount = impactOverflowCount(row);
                const unclassifiedAdminHref =
                  isAdminUser && !hasImpactCategories(row) && row.changeType !== 'no_change'
                    ? buildAdminTaxonomyLink(row)
                    : null;
                return (
                  <tr
                    key={row.rowId}
                    className={`diffRow diffRow-${row.changeType} missionResultsRow missionResultsRow-${changeTone(row.changeType)}`}
                    data-testid={`results-row-${row.rowId}`}
                  >
                  <td>
                    <span className={`missionStatusTag missionResultsChangePill missionResultsChangePill-${changeTone(row.changeType)}`}>
                      {formatChangeTypeLabel(row.changeType)}
                    </span>
                  </td>
                  <td className="missionResultsMono">{row.keyFields.partNumber || '-'}</td>
                  <td className="missionResultsMono">{row.keyFields.revision || '-'}</td>
                  <td>{row.keyFields.description || '-'}</td>
                  <td>
                    <div className="resultsImpactCell missionResultsImpactCell">
                      <span
                        className={`missionPill missionResultsImpactPill ${impactCriticalityClass(row.impactClassification?.impactCriticality)}`}
                        data-testid={`results-impact-${row.rowId}`}
                      >
                        {impactCriticalityLabel(row)}
                      </span>
                      {unclassifiedAdminHref ? (
                        <Link
                          className="resultsImpactLabel missionResultsImpactLabel resultsImpactAdminLink"
                          href={unclassifiedAdminHref}
                          title="Open Change Taxonomy & Impacts in Admin"
                          data-testid={`results-unclassified-link-${row.rowId}`}
                        >
                          {impactSummary}
                        </Link>
                      ) : (
                        <div className="missionResultsImpactSummaryRow">
                          <span className="missionPill missionResultsImpactCategory">{primaryImpactSummary}</span>
                          {overflowImpactCount > 0 && (
                            <span
                              className="missionPill missionResultsImpactOverflow"
                              title={impactOverflowTooltip(row)}
                              data-testid={`results-impact-overflow-${row.rowId}`}
                            >
                              +{overflowImpactCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="missionResultsMono">{formatClassificationReason(row.rationale.classificationReason, row.changeType)}</td>
                  <td>
                    <div className="cellChips missionResultsChangedFields">
                      {row.rationale.changedFields.length === 0 && (
                        <span className="missionPill missionResultsFieldChip missionResultsFieldChipMuted">No field changes</span>
                      )}
                      {row.rationale.changedFields.map((field) => (
                        <span className="missionPill missionResultsFieldChip" key={`${row.rowId}-${field}`}>
                          {formatChangedFieldLabel(field)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <button
                      className={`missionTableAction ${hasImpactCategories(row) ? 'missionTableActionActive missionTableActionGlow' : ''}`}
                      type="button"
                      onClick={() => setImpactDialogRow(row)}
                      disabled={!hasImpactCategories(row)}
                      title={
                        hasImpactCategories(row)
                          ? 'Open change impact details'
                          : row.changeType === 'no_change'
                            ? 'No impact review is needed for unchanged rows'
                            : 'Change impact still needs review'
                      }
                      data-testid={`results-impact-detail-${row.rowId}`}
                    >
                      {hasImpactCategories(row) ? 'Open impact' : row.changeType === 'no_change' ? 'No review needed' : 'Review needed'}
                    </button>
                  </td>
                  </tr>
                );
              })}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={8}>No rows for the current page/filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'tree' && (
        <div className="mappingTableWrap missionResultsTableWrap">
          {status?.status === 'running' && (
            <div className="alertWarning missionResultsInlineAlert" data-testid="results-tree-loading-badge">
              Loading hierarchy...
            </div>
          )}
          <table className="mappingTable missionGridTable missionResultsTable missionGridTableDense" data-testid="results-tree-table">
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
                    className={`diffRow diffRow-${node.changeType} missionResultsRow missionResultsRow-${changeTone(node.changeType)}`}
                    data-testid={`tree-node-${node.nodeId}`}
                  >
                    <td>
                      <div className="missionResultsTreeCell" style={{ paddingLeft: `${Math.max(0, node.depth) * 16}px` }}>
                        {node.hasChildren ? (
                          <button
                            className="missionTreeToggle"
                            type="button"
                            onClick={() => void toggleTreeNode(node.nodeId)}
                            data-testid={`tree-toggle-${node.nodeId}`}
                          >
                            {expanded ? '-' : '+'}
                          </button>
                        ) : (
                          <span className="missionTreeTogglePlaceholder" />
                        )}
                        <span className="missionResultsMono">{node.rowId}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`missionStatusTag missionResultsChangePill missionResultsChangePill-${changeTone(node.changeType)}`}>
                        {formatChangeTypeLabel(node.changeType)}
                      </span>
                    </td>
                    <td className="missionResultsMono">{node.keyFields.partNumber || '-'}</td>
                    <td className="missionResultsMono">{node.keyFields.revision || '-'}</td>
                    <td>
                      {node.keyFields.description || '-'}
                      {node.fromParent && node.toParent && (
                        <div className="missionResultsTreeContext" data-testid={`tree-moved-context-${node.nodeId}`}>
                          {node.fromParent}
                          {' -> '}
                          {node.toParent}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="cellChips missionResultsChangedFields">
                        {node.changedFields.length === 0 && (
                          <span className="missionPill missionResultsFieldChip missionResultsFieldChipMuted">No field changes</span>
                        )}
                        {node.changedFields.map((field) => (
                          <span className="missionPill missionResultsFieldChip" key={`${node.nodeId}-${field}`}>
                            {formatChangedFieldLabel(field)}
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

      {currentComparisonDialogOpen && (
        <div className="screenModalLayer" role="presentation">
          <button
            type="button"
            className="screenModalBackdrop"
            aria-label="Close current file comparison dialog"
            onClick={() => setCurrentComparisonDialogOpen(false)}
          />
          <section
            className="screenModalCard screenModalCardCompact panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="results-current-comparison-title"
            data-testid="results-current-comparison-dialog"
          >
            <div className="screenModalHeader">
              <div>
                <p className="missionShellEyebrow">Current file comparison</p>
                <h2 className="h2" id="results-current-comparison-title">
                  Latest loaded revision details
                </h2>
              </div>
              <button
                className="screenIconAction"
                type="button"
                aria-label="Close current file comparison dialog"
                title="Close"
                onClick={() => setCurrentComparisonDialogOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            {currentSessionEntry ? (
              <article className="resultsCurrentComparisonCard" data-testid="results-current-comparison-card">
                <div className="cellChips">
                  <span className="missionPill missionPillMeta">{currentSessionEntry.status}</span>
                  {currentSessionEntry.current && <span className="missionPill missionPillMeta">Current</span>}
                  {currentSessionEntry.latest && <span className="missionPill missionPillMeta">Latest</span>}
                </div>
                <strong>{currentSessionEntry.comparisonLabel}</strong>
                <span>{currentSessionEntry.initiatorEmail}</span>
                <dl className="resultsCurrentComparisonDetails">
                  <div>
                    <dt>Uploaded</dt>
                    <dd>{currentSessionEntry.comparisonDateLabel}</dd>
                  </div>
                  <div>
                    <dt>Session title</dt>
                    <dd>{effectiveSessionName(currentSessionEntry) || 'Untitled session'}</dd>
                  </div>
                </dl>
              </article>
            ) : (
              <article className="resultsCurrentComparisonCard" data-testid="results-current-comparison-card">
                <div className="cellChips">
                  <span className="missionPill missionPillMeta">
                    {historySessionsLoading ? 'Loading details' : 'Details on demand'}
                  </span>
                </div>
                <strong>{workspaceSnapshot?.comparisonLabel || 'Current comparison details'}</strong>
                <span>{historySessionsLoading ? 'Fetching saved session details...' : 'Open previous comparisons to load the saved chain summary.'}</span>
              </article>
            )}
            <div className="screenDialogActions">
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setCurrentComparisonDialogOpen(false);
                  setHistoryError(null);
                  setHistoryFeedback(null);
                  setHistoryDialogOpen(true);
                }}
                disabled={!activeSessionId}
                data-testid="results-current-comparison-history-btn"
              >
                Previous comparisons
              </button>
            </div>
          </section>
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
              data-testid="results-upload-next-file-input"
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
            <div className="screenInlineForm">
              <select
                className="missionCompareSheetSelect"
                value={nextRevisionSheetSelector.selectedSheetName}
                onChange={(event) =>
                  setNextRevisionSheetSelector((current) => ({
                    ...current,
                    selectedSheetName: event.target.value
                  }))
                }
                disabled={chainUploadBusy || nextRevisionSheetSelector.dropdownDisabled || nextRevisionSheetSelector.isLoading}
                data-testid="results-upload-next-sheet-select"
              >
                {nextRevisionSheetSelector.options.map((option) => (
                  <option key={option.name} value={option.name}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
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
                disabled={
                  !nextRevisionFile ||
                  chainUploadBusy ||
                  !activeSessionId ||
                  nextRevisionSheetSelector.isLoading ||
                  !nextRevisionSheetSelector.selectedSheetName
                }
                data-testid="results-upload-next-submit"
              >
                {chainUploadBusy ? 'Validating and opening...' : 'Validate and compare'}
              </button>
            </div>
          </section>
        </div>
      )}

      {chainUploadWarningDialogOpen && chainUploadWarnings.length > 0 && (
        <div className="screenModalLayer" role="presentation">
          <button
            type="button"
            className="screenModalBackdrop"
            aria-label="Close next revision warning dialog"
            onClick={() => setChainUploadWarningDialogOpen(false)}
          />
          <section
            className="screenModalCard screenModalCardCompact panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="results-upload-next-warning-title"
            data-testid="results-upload-next-warning-dialog"
          >
            <div className="screenModalHeader">
              <div>
                <p className="missionShellEyebrow">Validation warning</p>
                <h2 className="h2" id="results-upload-next-warning-title">
                  We found extra content around the BOM
                </h2>
              </div>
              <button
                className="screenIconAction"
                type="button"
                aria-label="Close next revision warning dialog"
                title="Close"
                onClick={() => setChainUploadWarningDialogOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="missionCompareDialogDetails" data-testid="results-upload-next-warning-details">
              {chainUploadWarnings.map((warning) => (
                <p className="p" key={`${warning.code}-${warning.selectedSheetName || 'none'}`}>
                  {warning.message}
                  {warning.selectedSheetName ? ` Sheet: ${warning.selectedSheetName}.` : ''}
                </p>
              ))}
            </div>
            <div className="screenDialogActions">
              <button className="btn" type="button" onClick={() => setChainUploadWarningDialogOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btnPrimary"
                type="button"
                onClick={() => void continueNextRevisionAfterWarnings()}
                data-testid="results-upload-next-warning-continue"
              >
                Continue
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
                  {historySessionsLoading && (
                    <tr>
                      <td colSpan={5}>Loading previous comparisons...</td>
                    </tr>
                  )}
                  {!historySessionsLoading && historySessionsLoaded && historySessions.length === 0 && (
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
                            placeholder="Session title"
                            readOnly={!entry.canRename}
                            data-testid={`results-session-history-rename-${entry.historyId}`}
                          />
                          <span className="resultsProgressMeta">{entry.comparisonLabel}</span>
                        </div>
                      </td>
                      <td>{new Date(entry.createdAtUtc).toLocaleString()}</td>
                      <td>{entry.initiatorEmail}</td>
                      <td>
                        <div className="cellChips">
                          <span className="missionPill missionPillMeta">{entry.status}</span>
                          {entry.current && <span className="missionPill missionPillMeta">Current</span>}
                          {entry.latest && <span className="missionPill missionPillMeta">Latest</span>}
                        </div>
                      </td>
                      <td>
                        <div className="screenRowActions">
                          <button
                            className="screenIconAction screenIconActionCompact"
                            type="button"
                            onClick={() => void renameComparison(entry.historyId)}
                            disabled={!entry.canRename}
                            aria-label={`Rename session for ${entry.comparisonLabel}`}
                            title="Rename"
                            data-testid={`results-session-history-save-${entry.historyId}`}
                          >
                            Save
                          </button>
                          <button
                            className="screenIconAction screenIconActionCompact"
                            type="button"
                            onClick={() => {
                              const nextUrl = buildResultsUrl({
                                comparisonId: entry.comparisonId,
                                sessionId: entry.sessionId,
                                leftRevisionId: entry.leftRevisionId,
                                rightRevisionId: entry.rightRevisionId
                              });
                              if (!nextUrl) return;
                              setHistoryDialogOpen(false);
                              router.push(nextUrl);
                            }}
                            disabled={!entry.comparisonId && (!entry.leftRevisionId || !entry.rightRevisionId)}
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
                            disabled={!entry.canDelete}
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
                      {!shareRecipientsLoaded && !shareError && (
                        <tr>
                          <td colSpan={4}>Loading recipients...</td>
                        </tr>
                      )}
                      {shareRecipientsLoaded && shareRecipients.length === 0 && (
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

      {impactDialogRow && <ResultsImpactDialog row={impactDialogRow} onClose={() => setImpactDialogRow(null)} />}

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
    </>
  );
}
