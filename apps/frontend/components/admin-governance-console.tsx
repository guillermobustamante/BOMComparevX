'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  DeleteIcon,
  ExportIcon,
  PlusIcon,
  RefreshIcon,
  RunIcon,
  SearchIcon
} from '@/components/mission-icons';

interface AdminContextPayload {
  isAdmin?: boolean;
  canBootstrapAdmin?: boolean;
  code?: string;
  message?: string;
}

interface AdminUserEntry {
  email: string;
  isAdmin: boolean;
  policy: {
    comparisonsUsed: number;
    unrestrictedComparisonsRemaining: number;
    cooldownUntilUtc: string | null;
    isUnlimited: boolean;
  };
}

interface AuditArchiveRun {
  archiveId: string;
  archiveDateUtc: string;
  triggeredAtUtc: string;
  triggeredBy: string;
  storageTarget: 'local' | 'azure_blob_grs';
  artifactUri: string;
  recordCount: number;
  retentionYears: number;
}

interface LearnedAlias {
  normalizedSourceColumn: string;
  canonicalField: string;
  confirmations: number;
  isEnabled: boolean;
  confidenceBand: 'emerging' | 'trusted' | 'established';
}

interface RetentionResult {
  deletedExportArtifacts: number;
  deletedNotifications: number;
  deletedRevokedShares: number;
  sweptAtUtc: string;
}

type ImpactCriticality = 'High' | 'Medium' | 'Low';

interface TaxonomyCategory {
  industry: string;
  category: string;
  changeDescription: string;
  impactClass: string;
  impactCriticality: ImpactCriticality;
  triggerProperties: string[];
  internalApprovingRoles: string[];
  externalApprovingRoles: string[];
  controlPath: string;
  complianceTrigger: string;
}

interface TaxonomyDocument {
  industry: string;
  categories: TaxonomyCategory[];
}

type TaxonomyListField =
  | 'triggerProperties'
  | 'internalApprovingRoles'
  | 'externalApprovingRoles';

type ActiveTokenEditor = {
  index: number;
  field: TaxonomyListField;
} | null;

const IMPACT_CLASS_OPTIONS = [
  { value: 'A', label: 'A - Critical / Major' },
  { value: 'B', label: 'B - Significant / Controlled' },
  { value: 'C', label: 'C - Minor' }
] as const;

const TAXONOMY_FIELD_META: Record<
  TaxonomyListField,
  {
    label: string;
    placeholder: string;
    emptyMessage: string;
    tone: 'blue' | 'green' | 'amber';
  }
> = {
  triggerProperties: {
    label: 'Trigger properties',
    placeholder: 'Add BOM property',
    emptyMessage: 'No trigger properties yet.',
    tone: 'blue'
  },
  internalApprovingRoles: {
    label: 'Internal approving roles',
    placeholder: 'Add internal role',
    emptyMessage: 'No internal roles yet.',
    tone: 'green'
  },
  externalApprovingRoles: {
    label: 'External approving roles',
    placeholder: 'Add external role',
    emptyMessage: 'No external roles yet.',
    tone: 'amber'
  }
};

const EMPTY_CATEGORY: TaxonomyCategory = {
  industry: 'General discrete manufacturing',
  category: '',
  changeDescription: '',
  impactClass: 'C',
  impactCriticality: 'Low',
  triggerProperties: [],
  internalApprovingRoles: [],
  externalApprovingRoles: [],
  controlPath: '',
  complianceTrigger: ''
};

export function AdminGovernanceConsole() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [canBootstrapAdmin, setCanBootstrapAdmin] = useState(false);
  const [users, setUsers] = useState<AdminUserEntry[]>([]);
  const [archiveRuns, setArchiveRuns] = useState<AuditArchiveRun[]>([]);
  const [aliases, setAliases] = useState<LearnedAlias[]>([]);
  const [query, setQuery] = useState('');
  const [aliasQuery, setAliasQuery] = useState('');
  const [retentionNowUtcIso, setRetentionNowUtcIso] = useState('');
  const [retentionResult, setRetentionResult] = useState<RetentionResult | null>(null);
  const [auditFormat, setAuditFormat] = useState<'csv' | 'ndjson'>('csv');
  const [auditLimit, setAuditLimit] = useState('250');
  const [auditActionType, setAuditActionType] = useState('');
  const [auditActorEmail, setAuditActorEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [defaultIndustry, setDefaultIndustry] = useState('General discrete manufacturing');
  const [availableIndustries, setAvailableIndustries] = useState<string[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState('General discrete manufacturing');
  const [taxonomyDraft, setTaxonomyDraft] = useState<TaxonomyDocument | null>(null);
  const [taxonomyDirty, setTaxonomyDirty] = useState(false);
  const [taxonomyLoading, setTaxonomyLoading] = useState(false);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const [taxonomyFeedback, setTaxonomyFeedback] = useState<string | null>(null);
  const [listDrafts, setListDrafts] = useState<Record<string, string>>({});
  const [activeTokenEditor, setActiveTokenEditor] = useState<ActiveTokenEditor>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<boolean[]>([]);

  const activeAdminCount = useMemo(() => users.filter((user) => user.isAdmin).length, [users]);
  const taxonomyCategoryCount = taxonomyDraft?.categories.length || 0;
  const enabledAliasCount = useMemo(() => aliases.filter((alias) => alias.isEnabled).length, [aliases]);

  async function loadTaxonomy(industry?: string) {
    setTaxonomyLoading(true);
    setTaxonomyError(null);
    try {
      const suffix = industry?.trim() ? `?industry=${encodeURIComponent(industry.trim())}` : '';
      const response = await fetch(`/api/admin/mapping-governance/taxonomy${suffix}`, {
        method: 'GET',
        cache: 'no-store'
      });
      const payload = (await response.json()) as
        | {
            defaultIndustry?: string;
            availableIndustries?: string[];
            taxonomy?: TaxonomyDocument;
            code?: string;
            message?: string;
          }
        | { code?: string; message?: string };
      if (!response.ok) {
        const err = payload as { code?: string; message?: string };
        setTaxonomyError(`${err.code || 'ADMIN_TAXONOMY_LOAD_FAILED'}: ${err.message || 'Could not load taxonomy.'}`);
        return;
      }

      const resolved = payload as {
        defaultIndustry?: string;
        availableIndustries?: string[];
        taxonomy?: TaxonomyDocument;
      };
      const resolvedDefault = resolved.defaultIndustry || 'General discrete manufacturing';
      const resolvedDocument = resolved.taxonomy || {
        industry: resolvedDefault,
        categories: []
      };

      setDefaultIndustry(resolvedDefault);
      setAvailableIndustries(resolved.availableIndustries || []);
      setSelectedIndustry(resolvedDocument.industry || resolvedDefault);
      setTaxonomyDraft({
        industry: resolvedDocument.industry || resolvedDefault,
        categories: (resolvedDocument.categories || []).map((category) => ({
          ...category,
          industry: resolvedDocument.industry || resolvedDefault
        }))
      });
      setCollapsedCategories((resolvedDocument.categories || []).map(() => true));
      setActiveTokenEditor(null);
      setTaxonomyDirty(false);
      setTaxonomyFeedback(null);
    } catch {
      setTaxonomyError('ADMIN_TAXONOMY_LOAD_FAILED: Could not load taxonomy.');
    } finally {
      setTaxonomyLoading(false);
    }
  }

  async function loadAdminContext(searchQuery = query, aliasSearch = aliasQuery) {
    setError(null);
    const meResponse = await fetch('/api/admin/me', { method: 'GET', cache: 'no-store' });
    const mePayload = (await meResponse.json()) as AdminContextPayload;
    if (!meResponse.ok) {
      setError(`${mePayload.code || 'ADMIN_CONTEXT_FAILED'}: ${mePayload.message || 'Could not load admin context.'}`);
      setIsAdmin(false);
      setCanBootstrapAdmin(false);
      setUsers([]);
      setArchiveRuns([]);
      setAliases([]);
      setTaxonomyDraft(null);
      return;
    }

    const hasAdminRole = Boolean(mePayload.isAdmin);
    const bootstrapAllowed = Boolean(mePayload.canBootstrapAdmin);
    setIsAdmin(hasAdminRole);
    setCanBootstrapAdmin(bootstrapAllowed);
    if (!hasAdminRole) {
      setUsers([]);
      setArchiveRuns([]);
      setAliases([]);
      setTaxonomyDraft(null);
      return;
    }

    const usersSuffix = searchQuery.trim() ? `?query=${encodeURIComponent(searchQuery.trim())}` : '';
    const aliasesSuffix = aliasSearch.trim() ? `?query=${encodeURIComponent(aliasSearch.trim())}` : '';

    const [usersResponse, archiveResponse, aliasesResponse] = await Promise.all([
      fetch(`/api/admin/users${usersSuffix}`, { method: 'GET', cache: 'no-store' }),
      fetch('/api/admin/audit/archive/runs?limit=20', { method: 'GET', cache: 'no-store' }),
      fetch(`/api/admin/mapping-governance/aliases${aliasesSuffix}`, { method: 'GET', cache: 'no-store' })
    ]);

    const usersPayload = (await usersResponse.json()) as
      | { users?: AdminUserEntry[]; code?: string; message?: string };
    if (!usersResponse.ok) {
      setError(`${usersPayload.code || 'ADMIN_USERS_FAILED'}: ${usersPayload.message || 'Could not load users.'}`);
      setUsers([]);
    } else {
      setUsers(usersPayload.users || []);
    }

    const archivePayload = (await archiveResponse.json()) as
      | { runs?: AuditArchiveRun[]; code?: string; message?: string };
    if (archiveResponse.ok) {
      setArchiveRuns(archivePayload.runs || []);
    }

    const aliasesPayload = (await aliasesResponse.json()) as
      | { aliases?: LearnedAlias[]; code?: string; message?: string };
    if (aliasesResponse.ok) {
      setAliases(aliasesPayload.aliases || []);
    }
  }

  useEffect(() => {
    void loadAdminContext();
  }, []);

  useEffect(() => {
    if (!isAdmin || taxonomyDraft || taxonomyLoading) {
      return;
    }
    void loadTaxonomy();
  }, [isAdmin, taxonomyDraft, taxonomyLoading]);

  useEffect(() => {
    if (!isAdmin || !taxonomyDraft || !taxonomyDirty) {
      return;
    }

    const timeout = window.setTimeout(async () => {
      setTaxonomyError(null);
      setTaxonomyFeedback('Saving taxonomy...');
      try {
        const response = await fetch('/api/admin/mapping-governance/taxonomy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            industry: taxonomyDraft.industry,
            categories: taxonomyDraft.categories
          })
        });
        const payload = (await response.json()) as
          | { taxonomy?: TaxonomyDocument; code?: string; message?: string }
          | { code?: string; message?: string };
        if (!response.ok) {
          const err = payload as { code?: string; message?: string };
          setTaxonomyError(`${err.code || 'ADMIN_TAXONOMY_SAVE_FAILED'}: ${err.message || 'Could not save taxonomy.'}`);
          setTaxonomyFeedback(null);
          return;
        }
        const saved = (payload as { taxonomy?: TaxonomyDocument }).taxonomy || taxonomyDraft;
        setTaxonomyDraft({
          industry: saved.industry,
          categories: saved.categories.map((category) => ({
            ...category,
            industry: saved.industry
          }))
        });
        setTaxonomyDirty(false);
        setTaxonomyFeedback(`Auto-saved ${saved.categories.length} categories for ${saved.industry}.`);
      } catch {
        setTaxonomyError('ADMIN_TAXONOMY_SAVE_FAILED: Could not save taxonomy.');
        setTaxonomyFeedback(null);
      }
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [isAdmin, taxonomyDraft, taxonomyDirty]);

  function updateTaxonomy(mutator: (current: TaxonomyDocument) => TaxonomyDocument) {
    setTaxonomyDraft((current) => {
      if (!current) return current;
      const next = mutator(current);
      return {
        industry: next.industry,
        categories: next.categories.map((category) => ({
          ...category,
          industry: next.industry
        }))
      };
    });
    setTaxonomyDirty(true);
    setTaxonomyFeedback('Pending auto-save...');
  }

  function updateCategory(index: number, patch: Partial<TaxonomyCategory>) {
    updateTaxonomy((current) => ({
      ...current,
      categories: current.categories.map((category, categoryIndex) =>
        categoryIndex === index
          ? {
              ...category,
              ...patch,
              industry: current.industry
            }
          : category
      )
    }));
  }

  function addCategory() {
    setActiveTokenEditor(null);
    setCollapsedCategories((current) => [...current, false]);
    updateTaxonomy((current) => ({
      ...current,
      categories: [
        ...current.categories,
        {
          ...EMPTY_CATEGORY,
          industry: current.industry
        }
      ]
    }));
  }

  function removeCategory(index: number) {
    setActiveTokenEditor(null);
    setCollapsedCategories((current) => current.filter((_, categoryIndex) => categoryIndex !== index));
    updateTaxonomy((current) => ({
      ...current,
      categories: current.categories.filter((_, categoryIndex) => categoryIndex !== index)
    }));
  }

  function moveCategory(index: number, direction: -1 | 1) {
    setActiveTokenEditor(null);
    setCollapsedCategories((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
    updateTaxonomy((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.categories.length) return current;
      const categories = [...current.categories];
      const [moved] = categories.splice(index, 1);
      categories.splice(nextIndex, 0, moved);
      return {
        ...current,
        categories
      };
    });
  }

  function tokenDraftKey(index: number, field: TaxonomyListField): string {
    return `${index}:${field}`;
  }

  function setTokenDraft(index: number, field: TaxonomyListField, value: string) {
    const key = tokenDraftKey(index, field);
    setListDrafts((current) => ({
      ...current,
      [key]: value
    }));
  }

  function addToken(index: number, field: TaxonomyListField) {
    const key = tokenDraftKey(index, field);
    const value = (listDrafts[key] || '').trim();
    if (!value) return;

    updateTaxonomy((current) => ({
      ...current,
      categories: current.categories.map((category, categoryIndex) => {
        if (categoryIndex !== index) return category;
        const nextValues = [...new Set([...(category[field] || []), value])];
        return {
          ...category,
          [field]: nextValues
        };
      })
    }));

    setListDrafts((current) => ({
      ...current,
      [key]: ''
    }));
    setActiveTokenEditor((current) =>
      current && current.index === index && current.field === field ? null : current
    );
  }

  function removeToken(index: number, field: TaxonomyListField, value: string) {
    updateTaxonomy((current) => ({
      ...current,
      categories: current.categories.map((category, categoryIndex) =>
        categoryIndex === index
          ? {
              ...category,
              [field]: category[field].filter((entry) => entry !== value)
            }
          : category
      )
    }));
  }

  function openTokenEditor(index: number, field: TaxonomyListField) {
    setActiveTokenEditor({ index, field });
  }

  function closeTokenEditor(index?: number, field?: TaxonomyListField) {
    setActiveTokenEditor((current) => {
      if (!current) return null;
      if (typeof index === 'number' && typeof field === 'string') {
        return current.index === index && current.field === field ? null : current;
      }
      return null;
    });
  }

  function isTokenEditorOpen(index: number, field: TaxonomyListField) {
    return activeTokenEditor?.index === index && activeTokenEditor.field === field;
  }

  function toggleCategoryCollapse(index: number) {
    setCollapsedCategories((current) =>
      current.map((isCollapsed, categoryIndex) => (categoryIndex === index ? !isCollapsed : isCollapsed))
    );
  }

  async function claimBootstrapAdmin() {
    setError(null);
    setFeedback(null);
    const response = await fetch('/api/admin/roles/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const payload = (await response.json()) as { code?: string; message?: string; userEmail?: string };
    if (!response.ok) {
      setError(`${payload.code || 'ADMIN_BOOTSTRAP_FAILED'}: ${payload.message || 'Could not claim admin.'}`);
      return;
    }
    setFeedback(`Admin access granted to ${payload.userEmail || 'current user'}.`);
    await loadAdminContext();
    await loadTaxonomy();
  }

  async function grantAdmin(userEmail: string) {
    setError(null);
    setFeedback(null);
    const response = await fetch('/api/admin/roles/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail })
    });
    const payload = (await response.json()) as { code?: string; message?: string };
    if (!response.ok) {
      setError(`${payload.code || 'ADMIN_ROLE_GRANT_FAILED'}: ${payload.message || 'Grant failed.'}`);
      return;
    }
    setFeedback(`Granted admin to ${userEmail}.`);
    await loadAdminContext();
  }

  async function revokeAdmin(userEmail: string) {
    setError(null);
    setFeedback(null);
    const response = await fetch('/api/admin/roles/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail })
    });
    const payload = (await response.json()) as { code?: string; message?: string };
    if (!response.ok) {
      setError(`${payload.code || 'ADMIN_ROLE_REVOKE_FAILED'}: ${payload.message || 'Revoke failed.'}`);
      return;
    }
    setFeedback(`Revoked admin from ${userEmail}.`);
    await loadAdminContext();
  }

  async function resetPolicy(userEmail: string) {
    setError(null);
    setFeedback(null);
    const response = await fetch('/api/admin/upload-policy/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail })
    });
    const payload = (await response.json()) as { code?: string; message?: string };
    if (!response.ok) {
      setError(`${payload.code || 'ADMIN_POLICY_RESET_FAILED'}: ${payload.message || 'Reset failed.'}`);
      return;
    }
    setFeedback(`Reset policy for ${userEmail}.`);
    await loadAdminContext();
  }

  async function toggleUnlimited(userEmail: string, nextUnlimited: boolean) {
    setError(null);
    setFeedback(null);
    const response = await fetch('/api/admin/upload-policy/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail, isUnlimited: nextUnlimited, reason: 'admin-ui' })
    });
    const payload = (await response.json()) as { code?: string; message?: string };
    if (!response.ok) {
      setError(`${payload.code || 'ADMIN_POLICY_OVERRIDE_FAILED'}: ${payload.message || 'Override failed.'}`);
      return;
    }
    setFeedback(`${nextUnlimited ? 'Enabled' : 'Disabled'} unlimited for ${userEmail}.`);
    await loadAdminContext();
  }

  async function runRetentionSweep() {
    setError(null);
    setFeedback(null);
    const response = await fetch('/api/admin/retention/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nowUtcIso: retentionNowUtcIso || undefined })
    });
    const payload = (await response.json()) as
      | ({ ok?: boolean } & RetentionResult)
      | { code?: string; message?: string };
    if (!response.ok) {
      const err = payload as { code?: string; message?: string };
      setError(`${err.code || 'ADMIN_RETENTION_FAILED'}: ${err.message || 'Retention sweep failed.'}`);
      return;
    }
    setRetentionResult(payload as RetentionResult);
    setFeedback('Retention sweep completed.');
  }

  async function runArchive() {
    setError(null);
    setFeedback(null);
    const response = await fetch('/api/admin/audit/archive/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const payload = (await response.json()) as { code?: string; message?: string };
    if (!response.ok) {
      setError(`${payload.code || 'ADMIN_AUDIT_ARCHIVE_FAILED'}: ${payload.message || 'Archive failed.'}`);
      return;
    }
    setFeedback('Audit archive run completed.');
    await loadAdminContext();
  }

  async function toggleAlias(alias: LearnedAlias, nextEnabled: boolean) {
    setError(null);
    setFeedback(null);
    const response = await fetch('/api/admin/mapping-governance/aliases/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        normalizedSourceColumn: alias.normalizedSourceColumn,
        canonicalField: alias.canonicalField,
        isEnabled: nextEnabled
      })
    });
    const payload = (await response.json()) as { code?: string; message?: string };
    if (!response.ok) {
      setError(`${payload.code || 'ADMIN_ALIAS_UPDATE_FAILED'}: ${payload.message || 'Alias update failed.'}`);
      return;
    }
    setFeedback(`${nextEnabled ? 'Enabled' : 'Disabled'} tenant alias ${alias.normalizedSourceColumn} -> ${alias.canonicalField}.`);
    await loadAdminContext();
  }

  async function updateDefaultIndustry(nextIndustry: string) {
    setTaxonomyError(null);
    setTaxonomyFeedback('Updating tenant default industry...');
    try {
      const response = await fetch('/api/admin/mapping-governance/taxonomy/default-industry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultIndustry: nextIndustry })
      });
      const payload = (await response.json()) as
        | { defaultIndustry?: string; code?: string; message?: string }
        | { code?: string; message?: string };
      if (!response.ok) {
        const err = payload as { code?: string; message?: string };
        setTaxonomyError(`${err.code || 'ADMIN_DEFAULT_INDUSTRY_FAILED'}: ${err.message || 'Could not update default industry.'}`);
        setTaxonomyFeedback(null);
        return;
      }
      const resolvedDefault = (payload as { defaultIndustry?: string }).defaultIndustry || nextIndustry;
      setDefaultIndustry(resolvedDefault);
      await loadTaxonomy(resolvedDefault);
      setTaxonomyFeedback(`Default industry set to ${resolvedDefault}.`);
    } catch {
      setTaxonomyError('ADMIN_DEFAULT_INDUSTRY_FAILED: Could not update default industry.');
      setTaxonomyFeedback(null);
    }
  }

  async function changeWorkingIndustry(nextIndustry: string) {
    setSelectedIndustry(nextIndustry);
    await loadTaxonomy(nextIndustry);
  }

  function downloadAuditExport() {
    const params = new URLSearchParams();
    params.set('format', auditFormat);
    if (auditLimit.trim()) params.set('limit', auditLimit.trim());
    if (auditActionType.trim()) params.set('actionType', auditActionType.trim());
    if (auditActorEmail.trim()) params.set('actorEmail', auditActorEmail.trim());
    window.open(`/api/admin/audit/export?${params.toString()}`, '_blank', 'noopener,noreferrer');
  }

  function renderImpactClassOptions(currentValue: string) {
    const isKnownOption = IMPACT_CLASS_OPTIONS.some((option) => option.value === currentValue);

    return (
      <>
        {IMPACT_CLASS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {!isKnownOption && currentValue ? <option value={currentValue}>{currentValue}</option> : null}
      </>
    );
  }

  function impactCriticalityBadgeLabel(value: ImpactCriticality) {
    return `${value} Impact`;
  }

  function impactCriticalityBadgeClass(value: ImpactCriticality) {
    return `taxonomyCriticalityBadge taxonomyCriticalityBadge${value}`;
  }

  function renderTokenSwimlane(index: number, field: TaxonomyListField, values: string[]) {
    const meta = TAXONOMY_FIELD_META[field];
    const draftKey = tokenDraftKey(index, field);
    const editorOpen = isTokenEditorOpen(index, field);
    const toneClass = `${meta.tone[0].toUpperCase()}${meta.tone.slice(1)}`;

    return (
      <div className={`taxonomySwimlane taxonomySwimlane${toneClass}`}>
        <span className="taxonomyTokenLabel">{meta.label}</span>
        <div className="taxonomyTokenList">
          {values.map((value) => (
            <button
              className={`taxonomyToken taxonomyToken${toneClass}`}
              key={`${index}-${field}-${value}`}
              type="button"
              onClick={() => removeToken(index, field, value)}
              title={`Remove ${meta.label}`}
            >
              {value}
              <span>x</span>
            </button>
          ))}
          <button
            className="taxonomyAddButton"
            type="button"
            onClick={() => openTokenEditor(index, field)}
            data-testid={`taxonomy-add-${field}-${index}`}
          >
            <PlusIcon />
            Add Tag
          </button>
          {values.length === 0 ? <span className="missionSubtle">{meta.emptyMessage}</span> : null}
        </div>
        {editorOpen ? (
          <div className="taxonomyPopover" data-testid={`taxonomy-popover-${field}-${index}`}>
            <input
              value={listDrafts[draftKey] || ''}
              onChange={(event) => setTokenDraft(index, field, event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                addToken(index, field);
              }}
              placeholder={meta.placeholder}
              data-testid={`taxonomy-popover-input-${field}-${index}`}
            />
            <div className="taxonomyPopoverActions">
              <button className="btn" type="button" onClick={() => closeTokenEditor(index, field)}>
                Cancel
              </button>
              <button
                className="btn btnPrimary"
                type="button"
                onClick={() => addToken(index, field)}
                data-testid={`taxonomy-popover-submit-${field}-${index}`}
              >
                Insert
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section className="panel adminConsole" data-testid="admin-governance-console">
      {error ? <div className="alertError">{error}</div> : null}
      {feedback ? <div className="alertSuccess" data-testid="admin-feedback">{feedback}</div> : null}

      {isAdmin === false && canBootstrapAdmin && (
        <section className="panel adminSectionCard adminSectionCardCompact">
          <div className="adminSectionHeader">
            <div className="adminSectionTitleGroup">
              <span className="missionShellEyebrow">Admin &gt; Access &amp; Roles</span>
              <h2 className="adminSectionTitle">Bootstrap the first tenant administrator</h2>
            </div>
          </div>
          <p className="p">This tenant has no active admin. Claim the first admin role to unlock the governance workspace.</p>
          <div className="adminButtonRow">
            <button className="btn btnPrimary" type="button" onClick={() => void claimBootstrapAdmin()}>
              Claim Tenant Admin
            </button>
          </div>
        </section>
      )}

      {isAdmin === false && !canBootstrapAdmin && (
        <div className="alertWarning" data-testid="admin-not-authorized">
          ADMIN_REQUIRED: You do not have admin access.
        </div>
      )}

      {isAdmin && (
        <div className="screenStack adminSectionStack">
          <section className="panel adminSectionCard">
            <div className="adminSectionHeader">
              <div className="adminSectionTitleGroup">
                <span className="missionShellEyebrow">Admin &gt; Access &amp; Roles</span>
                <h2 className="adminSectionTitle">Access and user policy controls</h2>
                <p className="p">Grant or revoke tenant admin access while keeping upload policy controls in the same operating view.</p>
              </div>
            </div>
            <div className="screenInlineForm adminFormRow adminFormRowDense">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search users..."
                data-testid="admin-user-search-input"
              />
              <button
                className="btn"
                type="button"
                onClick={() => void loadAdminContext(query, aliasQuery)}
                data-testid="admin-user-search-btn"
              >
                <SearchIcon />
                Refresh Users
              </button>
            </div>
            <p className="missionSubtle">Active admins: {activeAdminCount}</p>
            <div className="mappingTableWrap adminTableWrap">
              <table className="mappingTable adminTable" data-testid="admin-users-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Comparisons Used</th>
                    <th>Unlimited</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.email}>
                      <td>{user.email}</td>
                      <td>{user.isAdmin ? 'admin' : 'user'}</td>
                      <td>{user.policy.comparisonsUsed}</td>
                      <td>{user.policy.isUnlimited ? 'yes' : 'no'}</td>
                      <td>
                        <div className="cellChips adminActionCluster">
                          <button
                            className="btn"
                            type="button"
                            onClick={() => void (user.isAdmin ? revokeAdmin(user.email) : grantAdmin(user.email))}
                          >
                            {user.isAdmin ? 'Revoke Admin' : 'Grant Admin'}
                          </button>
                          <button
                            className="btn"
                            type="button"
                            onClick={() => void resetPolicy(user.email)}
                            data-testid={`admin-reset-${user.email}`}
                          >
                            Reset Policy
                          </button>
                          <button
                            className="btn"
                            type="button"
                            onClick={() => void toggleUnlimited(user.email, !user.policy.isUnlimited)}
                            data-testid={`admin-toggle-unlimited-${user.email}`}
                          >
                            {user.policy.isUnlimited ? 'Disable Unlimited' : 'Enable Unlimited'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No users found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel adminSectionCard">
            <div className="adminSectionHeader">
              <div className="adminSectionTitleGroup">
                <span className="missionShellEyebrow">Admin &gt; Audit &amp; Compliance</span>
                <h2 className="adminSectionTitle">Audit export and archive runway</h2>
                <p className="p">Export tenant audit evidence and manage append-only archive runs from one place.</p>
              </div>
              <div className="adminChipCluster">
                <span className="chip">{archiveRuns.length} archive runs</span>
                <span className="chip">Format: {auditFormat.toUpperCase()}</span>
              </div>
            </div>
            <div className="screenInlineForm adminFormRow">
              <select value={auditFormat} onChange={(event) => setAuditFormat(event.target.value as 'csv' | 'ndjson')}>
                <option value="csv">CSV</option>
                <option value="ndjson">NDJSON</option>
              </select>
              <input value={auditLimit} onChange={(event) => setAuditLimit(event.target.value)} placeholder="Limit" />
              <input value={auditActionType} onChange={(event) => setAuditActionType(event.target.value)} placeholder="Action type" />
              <input value={auditActorEmail} onChange={(event) => setAuditActorEmail(event.target.value)} placeholder="Actor email" />
              <button className="btn" type="button" onClick={downloadAuditExport}>
                <ExportIcon />
                Export Audit
              </button>
              <button className="btn btnPrimary" type="button" onClick={() => void runArchive()}>
                <RunIcon />
                Run Archive
              </button>
            </div>
            <div className="mappingTableWrap adminTableWrap">
              <table className="mappingTable adminTable">
                <thead>
                  <tr>
                    <th>Archive Date</th>
                    <th>Triggered</th>
                    <th>By</th>
                    <th>Records</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {archiveRuns.map((run) => (
                    <tr key={run.archiveId}>
                      <td>{run.archiveDateUtc}</td>
                      <td>{new Date(run.triggeredAtUtc).toLocaleString()}</td>
                      <td>{run.triggeredBy}</td>
                      <td>{run.recordCount}</td>
                      <td>{run.storageTarget}</td>
                    </tr>
                  ))}
                  {archiveRuns.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No archive runs yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel adminSectionCard">
            <div className="adminSectionHeader">
              <div className="adminSectionTitleGroup">
                <span className="missionShellEyebrow">Admin &gt; Data Retention</span>
                <h2 className="adminSectionTitle">Retention sweep control</h2>
                <p className="p">Run a manual retention sweep and review what was removed.</p>
              </div>
            </div>
            <div className="screenInlineForm adminFormRow adminFormRowDense">
              <input
                value={retentionNowUtcIso}
                onChange={(event) => setRetentionNowUtcIso(event.target.value)}
                placeholder="Optional nowUtcIso"
              />
              <button className="btn btnPrimary" type="button" onClick={() => void runRetentionSweep()}>
                <RunIcon />
                Run Retention Sweep
              </button>
            </div>
            {retentionResult ? (
              <div className="adminRetentionGrid">
                <div className="adminRetentionMetric">
                  <span>Deleted export artifacts</span>
                  <strong>{retentionResult.deletedExportArtifacts}</strong>
                </div>
                <div className="adminRetentionMetric">
                  <span>Deleted notifications</span>
                  <strong>{retentionResult.deletedNotifications}</strong>
                </div>
                <div className="adminRetentionMetric">
                  <span>Deleted revoked shares</span>
                  <strong>{retentionResult.deletedRevokedShares}</strong>
                </div>
                <div className="adminRetentionMetric">
                  <span>Swept at</span>
                  <strong>{new Date(retentionResult.sweptAtUtc).toLocaleString()}</strong>
                </div>
              </div>
            ) : (
              <div className="adminEmptyState">No retention sweep has been run in this session yet.</div>
            )}
          </section>

          <section className="panel adminSectionCard adminTaxonomySection">
            <div className="screenToolbar adminSectionHeader">
              <div className="screenToolbarMeta adminSectionTitleGroup">
                <span className="missionShellEyebrow">Admin &gt; Mapping Governance &gt; Taxonomy</span>
                <h2 className="adminSectionTitle">Tenant change taxonomy editor</h2>
                <p className="p">All changed BOM properties roll into this tenant-owned taxonomy. Exact property matches win, high-confidence fuzzy matches are accepted automatically for now, and edits save without explicit save buttons.</p>
              </div>
              <div className="taxonomySummaryStrip adminChipCluster">
                <span className="chip">{taxonomyCategoryCount} categories</span>
                <span className="chip">Default: {defaultIndustry}</span>
                {taxonomyDirty ? <span className="chip chipReview">Pending</span> : null}
              </div>
            </div>

            {taxonomyError ? <div className="alertError">{taxonomyError}</div> : null}
            {taxonomyFeedback ? <div className="alertSuccess">{taxonomyFeedback}</div> : null}

            <div className="taxonomyControls adminFormRow">
              <label className="taxonomyControl adminFormField">
                <span>Tenant default industry</span>
                <select
                  value={defaultIndustry}
                  onChange={(event) => void updateDefaultIndustry(event.target.value)}
                  disabled={taxonomyLoading}
                  data-testid="taxonomy-default-industry-select"
                >
                  {availableIndustries.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                  ))}
                </select>
              </label>

              <label className="taxonomyControl adminFormField">
                <span>Working taxonomy</span>
                <select
                  value={selectedIndustry}
                  onChange={(event) => void changeWorkingIndustry(event.target.value)}
                  disabled={taxonomyLoading}
                  data-testid="taxonomy-working-industry-select"
                >
                  {availableIndustries.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                  ))}
                </select>
              </label>

              <button className="btn" type="button" onClick={() => void loadTaxonomy(selectedIndustry)} disabled={taxonomyLoading}>
                <RefreshIcon />
                {taxonomyLoading ? 'Loading...' : 'Reload'}
              </button>

              <button className="btn btnPrimary" type="button" onClick={() => addCategory()} disabled={!taxonomyDraft}>
                <PlusIcon />
                Add Category
              </button>
            </div>

            {!taxonomyDraft ? (
              <div className="alertWarning">Taxonomy is not available yet.</div>
            ) : (
              <div className="taxonomyCardGrid" data-testid="taxonomy-editor">
                {taxonomyDraft.categories.map((category, index) => (
                  <article
                    className={`taxonomyCard ${(collapsedCategories[index] ?? true) ? 'taxonomyCardCollapsed' : ''}`}
                    key={`${category.category || 'new'}-${index}`}
                  >
                    <div className="taxonomyCardHeader">
                      <div className="taxonomyCardTitleRow">
                        <button
                          className="adminIconButton taxonomyCollapseButton"
                          type="button"
                          onClick={() => toggleCategoryCollapse(index)}
                          aria-label={`${(collapsedCategories[index] ?? true) ? 'Expand' : 'Collapse'} category`}
                          title={(collapsedCategories[index] ?? true) ? 'Expand' : 'Collapse'}
                          data-testid={`taxonomy-toggle-${index}`}
                        >
                          <ChevronDownIcon />
                        </button>
                        <div className="taxonomyCardTitleGroup">
                          <div className="taxonomyCardTitleLine">
                            <input
                              className="taxonomyTitleInput"
                              value={category.category}
                              onChange={(event) => updateCategory(index, { category: event.target.value })}
                              placeholder="Category name"
                              data-testid={`taxonomy-category-title-${index}`}
                            />
                            <span
                              className={impactCriticalityBadgeClass(category.impactCriticality)}
                              data-testid={`taxonomy-criticality-badge-${index}`}
                            >
                              {impactCriticalityBadgeLabel(category.impactCriticality)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="taxonomyCardActions">
                        <button
                          className="adminIconButton"
                          type="button"
                          onClick={() => moveCategory(index, -1)}
                          disabled={index === 0}
                          aria-label="Move category up"
                          title="Move Up"
                        >
                          <ChevronUpIcon />
                        </button>
                        <button
                          className="adminIconButton"
                          type="button"
                          onClick={() => moveCategory(index, 1)}
                          disabled={index === taxonomyDraft.categories.length - 1}
                          aria-label="Move category down"
                          title="Move Down"
                        >
                          <ChevronDownIcon />
                        </button>
                        <button
                          className="adminIconButton adminIconButtonDanger"
                          type="button"
                          onClick={() => removeCategory(index)}
                          aria-label="Remove category"
                          title="Remove"
                        >
                          <DeleteIcon />
                        </button>
                      </div>
                    </div>
                    <div className="taxonomyPanelContent" data-testid={`taxonomy-panel-content-${index}`}>
                      <div className="taxonomyPanelContentInner">
                        <div className="taxonomySectionBlock">
                          <h3 className="taxonomySectionTitle">Core Definition</h3>
                          <label className="taxonomyField taxonomyFieldFull">
                            <span>Description</span>
                            <textarea
                              value={category.changeDescription}
                              onChange={(event) => updateCategory(index, { changeDescription: event.target.value })}
                              placeholder="Change description"
                              rows={4}
                            />
                          </label>

                          <div className="taxonomyFieldGrid">
                            <label className="taxonomyField">
                              <span>Impact class</span>
                              <select
                                value={category.impactClass}
                                onChange={(event) => updateCategory(index, { impactClass: event.target.value })}
                              >
                                {renderImpactClassOptions(category.impactClass)}
                              </select>
                            </label>
                            <label className="taxonomyField">
                              <span>Impact criticality</span>
                              <select
                                value={category.impactCriticality}
                                onChange={(event) =>
                                  updateCategory(index, { impactCriticality: event.target.value as ImpactCriticality })
                                }
                                data-testid={`taxonomy-impact-criticality-${index}`}
                              >
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                              </select>
                            </label>
                            <label className="taxonomyField">
                              <span>Control path</span>
                              <input
                                value={category.controlPath}
                                onChange={(event) => updateCategory(index, { controlPath: event.target.value })}
                                placeholder="ECR -> ECO -> validation"
                              />
                            </label>
                            <label className="taxonomyField">
                              <span>Compliance trigger</span>
                              <input
                                value={category.complianceTrigger}
                                onChange={(event) => updateCategory(index, { complianceTrigger: event.target.value })}
                                placeholder="ISO 9001:2015 Clause 8.5.6"
                              />
                            </label>
                          </div>
                        </div>

                        <div className="taxonomySectionBlock">
                          <h3 className="taxonomySectionTitle">Classification Tags</h3>
                          <div className="taxonomySwimlaneStack">
                            {renderTokenSwimlane(index, 'triggerProperties', category.triggerProperties)}
                            {renderTokenSwimlane(index, 'internalApprovingRoles', category.internalApprovingRoles)}
                            {renderTokenSwimlane(index, 'externalApprovingRoles', category.externalApprovingRoles)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
                {taxonomyDraft.categories.length === 0 ? (
                  <div className="alertWarning">No categories are configured for this industry yet. Add one to create the tenant fork.</div>
                ) : null}
              </div>
            )}
          </section>

          <section className="panel adminSectionCard">
            <div className="adminSectionHeader">
              <div className="adminSectionTitleGroup">
                <span className="missionShellEyebrow">Admin &gt; Mapping Governance &gt; Learned Aliases</span>
                <h2 className="adminSectionTitle">Learned alias moderation</h2>
                <p className="p">Review tenant-learned aliases, keep the good ones enabled, and suppress noisy ones.</p>
              </div>
              <div className="adminChipCluster">
                <span className="chip">{enabledAliasCount} enabled</span>
                <span className="chip">{aliases.length} total</span>
              </div>
            </div>
            <div className="screenInlineForm adminFormRow adminFormRowDense">
              <input
                value={aliasQuery}
                onChange={(event) => setAliasQuery(event.target.value)}
                placeholder="Search learned aliases..."
              />
              <button className="btn" type="button" onClick={() => void loadAdminContext(query, aliasQuery)}>
                <RefreshIcon />
                Refresh Aliases
              </button>
            </div>
            <div className="mappingTableWrap adminTableWrap">
              <table className="mappingTable adminTable">
                <thead>
                  <tr>
                    <th>Source Header</th>
                    <th>Canonical Field</th>
                    <th>Confirmations</th>
                    <th>Confidence Band</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {aliases.map((alias) => (
                    <tr key={`${alias.normalizedSourceColumn}-${alias.canonicalField}`}>
                      <td>{alias.normalizedSourceColumn}</td>
                      <td>{alias.canonicalField}</td>
                      <td>{alias.confirmations}</td>
                      <td>{alias.confidenceBand}</td>
                      <td>{alias.isEnabled ? 'enabled' : 'disabled'}</td>
                      <td>
                        <button className="btn" type="button" onClick={() => void toggleAlias(alias, !alias.isEnabled)}>
                          {alias.isEnabled ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {aliases.length === 0 ? (
                    <tr>
                      <td colSpan={6}>No tenant-learned aliases yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
