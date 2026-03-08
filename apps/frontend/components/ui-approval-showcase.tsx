'use client';

import { useMemo, useState } from 'react';

type ThemeMode = 'dark' | 'light';
type ScreenId =
  | 'compare'
  | 'mapping'
  | 'results'
  | 'exports'
  | 'history'
  | 'notifications'
  | 'admin';
type ResultsMode = 'list' | 'tree';

type CompareState = 'ready' | 'loading' | 'error' | 'restricted';
type MappingState = 'populated' | 'warning' | 'empty' | 'error';
type ResultsState = 'populated' | 'loading' | 'empty' | 'error' | 'partial';
type ExportState = 'ready' | 'empty' | 'restricted';
type HistoryState = 'populated' | 'empty';
type NotificationsState = 'populated' | 'empty';
type AdminState = 'authorized' | 'unauthorized';

type Screen = {
  id: ScreenId;
  label: string;
  shortLabel: string;
  eyebrow: string;
  icon: JSX.Element;
};

const screens: Screen[] = [
  {
    id: 'compare',
    label: 'Compare BOMs',
    shortLabel: 'Compare',
    eyebrow: 'Revision intake',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6.5h16M4 12h16M4 17.5h16M6 4v16" />
      </svg>
    )
  },
  {
    id: 'mapping',
    label: 'Mapping Check',
    shortLabel: 'Mapping',
    eyebrow: 'Confidence review',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 7h14M5 12h8M5 17h10M17 11l2 2 4-4" />
      </svg>
    )
  },
  {
    id: 'results',
    label: 'Results',
    shortLabel: 'Results',
    eyebrow: 'Diff workspace',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h16v14H4zM9 5v14M4 10h16" />
      </svg>
    )
  },
  {
    id: 'exports',
    label: 'Exports and Sharing',
    shortLabel: 'Exports',
    eyebrow: 'Output control',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v10M8 10l4 4 4-4M5 18h14" />
      </svg>
    )
  },
  {
    id: 'history',
    label: 'History',
    shortLabel: 'History',
    eyebrow: 'Session archive',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 7v5l3 2M5 4v4h4M6.5 17.5A7 7 0 1 0 5 8" />
      </svg>
    )
  },
  {
    id: 'notifications',
    label: 'Notifications',
    shortLabel: 'Notices',
    eyebrow: 'Event log',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4a4 4 0 0 1 4 4v3.5l1.5 3H6.5l1.5-3V8a4 4 0 0 1 4-4zM10 18a2 2 0 0 0 4 0" />
      </svg>
    )
  },
  {
    id: 'admin',
    label: 'Admin',
    shortLabel: 'Admin',
    eyebrow: 'Policy controls',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4zM9.5 12l1.5 1.5 3.5-3.5" />
      </svg>
    )
  }
];

const compareRows = [
  ['Source A', 'ERP_WEST__2026_02_11.csv'],
  ['Revision', 'STABLE_BUILD__4.1.8'],
  ['Rows', '12,440'],
  ['Validation', 'Checksum aligned']
] as const;

const mappingRows = [
  ['Qty', 'quantity', '0.61', 'Token similarity', 'Needs review'],
  ['Rev', 'revision', '0.42', 'Value collision', 'Needs review'],
  ['Description', 'description', '0.97', 'Alias library', 'Auto accepted']
] as const;

const resultRows = [
  ['Modified', 'P-104-AX', 'B', 'Agent housing', '+2', '$1,230', 'Review'],
  ['Added', 'P-117-NC', 'A', 'Cooling manifold', '+1', '$840', 'Added'],
  ['Qty delta', 'P-204-RQ', 'C', 'Harness assembly', '-3', '$420', 'Impact']
] as const;

const historyRows = [
  ['CMP-2041', 'West plant weekly compare', '2026-03-05 13:22', 'Validated'],
  ['CMP-2037', 'Supplier recovery audit', '2026-03-04 09:18', 'Shared'],
  ['CMP-2030', 'March gate readiness', '2026-03-02 16:40', 'Archived']
] as const;

const notificationRows = [
  ['Export ready', 'Workbook for CMP-2041 generated and secured.', '2 min ago'],
  ['Share accepted', 'Supplier PM received review access.', '18 min ago'],
  ['Policy update', 'Read-only reviewers can now open hierarchy mode.', '1 hr ago']
] as const;

const adminRows = [
  ['Operator', 'Results and exports', 'Inherited', 'Active'],
  ['Reviewer', 'Mapping and history', 'Manual override', 'Active'],
  ['Supplier PM', 'Shared sessions only', 'Restricted', 'Pending']
] as const;

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  return mode === 'dark' ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.5 3.5A8 8 0 1 0 20.5 15 7 7 0 0 1 14.5 3.5z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1L7 17M17 7l2.1-2.1M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6h12M7 12h12M7 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  );
}

function TreeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 5h4v4H7zM13 15h4v4h-4zM13 5h4v4h-4zM11 7h2M15 9v6M9 9v6h4" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 7a3 3 0 1 0-2.8-4 3 3 0 0 0 2.8 4zM6 15a3 3 0 1 0-2.8-4A3 3 0 0 0 6 15zm10 6a3 3 0 1 0-2.8-4A3 3 0 0 0 16 21zM8.6 12.4l4.8 2.2M13.4 9.4 8.6 11.6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v10M8 10l4 4 4-4M5 18h14" />
    </svg>
  );
}

function RailToggleIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {expanded ? (
        <path d="M4 6.5h16v11H4zM9 6.5v11M14 12h-4M12 10l-2 2 2 2" />
      ) : (
        <path d="M4 6.5h16v11H4zM9 6.5v11M11 12h4M13 10l2 2-2 2" />
      )}
    </svg>
  );
}

function StateStrip<T extends string>({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: readonly T[];
}) {
  return (
    <div className="missionStateStrip" aria-label={label}>
      <span>{label}</span>
      <div className="missionStateStripGroup">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={cn('missionStateButton', value === option && 'missionStateButtonActive')}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function DataList({ rows }: { rows: ReadonlyArray<readonly [string, string]> }) {
  return (
    <dl className="missionDetailList">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function UiApprovalShowcase() {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [navExpanded, setNavExpanded] = useState(false);
  const [screen, setScreen] = useState<ScreenId>('compare');
  const [resultsMode, setResultsMode] = useState<ResultsMode>('list');
  const [compareState, setCompareState] = useState<CompareState>('ready');
  const [mappingState, setMappingState] = useState<MappingState>('populated');
  const [resultsState, setResultsState] = useState<ResultsState>('populated');
  const [exportState, setExportState] = useState<ExportState>('ready');
  const [historyState, setHistoryState] = useState<HistoryState>('populated');
  const [notificationsState, setNotificationsState] = useState<NotificationsState>('populated');
  const [adminState, setAdminState] = useState<AdminState>('authorized');

  const currentScreen = useMemo(() => screens.find((item) => item.id === screen) ?? screens[0], [screen]);

  return (
    <div className={cn('missionApprovalRoot', theme === 'light' && 'missionApprovalRootLight')}>
      <div className="missionAppShell">
        {navExpanded ? (
          <button
            type="button"
            className="missionRailBackdrop"
            aria-label="Close navigation"
            onClick={() => setNavExpanded(false)}
          />
        ) : null}

        <aside className={cn('missionRail', navExpanded && 'missionRailExpanded')}>
          <div className="missionRailTop">
            <button
              type="button"
              className="missionGhostButton missionIconControl"
              aria-label={navExpanded ? 'Collapse navigation' : 'Expand navigation'}
              onClick={() => setNavExpanded((value) => !value)}
            >
              <RailToggleIcon expanded={navExpanded} />
            </button>
            <div className="missionRailBrand">
              <span className="missionEyebrow">Mission Control</span>
              <strong>BOM Compare VX</strong>
            </div>
          </div>

          <nav className="missionRailNav" aria-label="Approval screens">
            {screens.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn('missionRailItem', item.id === screen && 'missionRailItemActive')}
                aria-current={item.id === screen ? 'page' : undefined}
                aria-label={item.label}
                onClick={() => {
                  setScreen(item.id);
                  setNavExpanded(false);
                }}
              >
                <span className="missionRailItemIcon">{item.icon}</span>
                <span className="missionRailItemText">
                  <strong>{item.shortLabel}</strong>
                  <small>{item.eyebrow}</small>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="missionWorkspace">
          <header className="missionTopbar">
            <div>
              <p className="missionEyebrow">Approval prototype</p>
              <h1>{currentScreen.label}</h1>
              <p className="missionSubtle">Antigravity-inspired high-density review surfaces with switchable approval states.</p>
            </div>

            <div className="missionTopbarActions">
              <div className="missionThemeToggle" role="group" aria-label="Theme mode">
                <button
                  type="button"
                  className={cn('missionThemeButton', theme === 'dark' && 'missionThemeButtonActive')}
                  aria-pressed={theme === 'dark'}
                  onClick={() => setTheme('dark')}
                >
                  <ThemeIcon mode="dark" />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  className={cn('missionThemeButton', theme === 'light' && 'missionThemeButtonActive')}
                  aria-pressed={theme === 'light'}
                  onClick={() => setTheme('light')}
                >
                  <ThemeIcon mode="light" />
                  <span>Light</span>
                </button>
              </div>
              <button
                type="button"
                className="missionGhostButton missionTopbarMenu"
                aria-label="Toggle navigation"
                onClick={() => setNavExpanded((value) => !value)}
              >
                <RailToggleIcon expanded={navExpanded} />
                <span>Nav</span>
              </button>
            </div>
          </header>

          <section className="missionHeroBand">
            <div className="missionHeroMeta">
              <span className="missionStatusTag missionStatusTagGood">Approval scope active</span>
              <span className="missionSearchToken">Collapsed navigation default preserved across breakpoints</span>
            </div>
            <div className="missionHeroMeta">
              <span className="missionSearchToken">Theme parity: {theme}</span>
              <span className="missionSearchToken">Current screen: {currentScreen.shortLabel}</span>
            </div>
          </section>

          {screen === 'compare' ? (
            <CompareScreen state={compareState} onStateChange={setCompareState} />
          ) : null}
          {screen === 'mapping' ? (
            <MappingScreen state={mappingState} onStateChange={setMappingState} />
          ) : null}
          {screen === 'results' ? (
            <ResultsScreen
              state={resultsState}
              onStateChange={setResultsState}
              mode={resultsMode}
              onModeChange={setResultsMode}
            />
          ) : null}
          {screen === 'exports' ? (
            <ExportsScreen state={exportState} onStateChange={setExportState} />
          ) : null}
          {screen === 'history' ? (
            <HistoryScreen state={historyState} onStateChange={setHistoryState} />
          ) : null}
          {screen === 'notifications' ? (
            <NotificationsScreen state={notificationsState} onStateChange={setNotificationsState} />
          ) : null}
          {screen === 'admin' ? <AdminScreen state={adminState} onStateChange={setAdminState} /> : null}
        </main>
      </div>
    </div>
  );
}

function CompareScreen({
  state,
  onStateChange
}: {
  state: CompareState;
  onStateChange: (value: CompareState) => void;
}) {
  return (
    <section className="missionScreenStack">
      <StateStrip
        label="Compare state"
        value={state}
        onChange={onStateChange}
        options={['ready', 'loading', 'error', 'restricted'] as const}
      />

      <div className="missionSectionGrid missionSectionGridTwo">
        <article className="missionCard">
          <div className="missionCardHeader">
            <div>
              <p className="missionEyebrow">Revision A</p>
              <h2>Primary plant manifest</h2>
            </div>
            <span className="missionStatusTag missionStatusTagGood">Validated</span>
          </div>
          <DataList rows={compareRows} />
        </article>

        <article className="missionCard">
          <div className="missionCardHeader">
            <div>
              <p className="missionEyebrow">Revision B</p>
              <h2>Supplier candidate drop</h2>
            </div>
            <span className="missionStatusTag missionStatusTagReview">Pending review</span>
          </div>
          <DataList
            rows={[
              ['Source B', 'SUPPLIER__ALPHA__2026_02_12.csv'],
              ['Revision', 'BUILD_CANDIDATE__4.1.9'],
              ['Rows', '12,437'],
              ['Validation', '3 row mismatches']
            ]}
          />
        </article>
      </div>

      <article className="missionCard">
        <div className="missionCardHeader">
          <div>
            <p className="missionEyebrow">Validation rail</p>
            <h2>Comparison launch readiness</h2>
          </div>
          <button type="button" className="missionGhostButton">
            Details
          </button>
        </div>
        {state === 'ready' ? (
          <div className="missionStatePanel">
            <p>Both revisions are aligned to the approved mapping profile. Three quantity deltas are predicted to require operator review.</p>
            <div className="missionInlineActions">
              <button type="button" className="missionPrimaryButton">
                Start comparison
              </button>
              <button type="button" className="missionGhostButton">
                Replace source B
              </button>
            </div>
          </div>
        ) : null}
        {state === 'loading' ? <div className="missionStatePanel">Validating revisions, computing checksums, and preparing the diff job.</div> : null}
        {state === 'error' ? (
          <div className="missionStatePanel missionInlineAlert">
            Validation failed because the source file uses an unsupported checksum block. Operator action is required before compare can continue.
          </div>
        ) : null}
        {state === 'restricted' ? (
          <div className="missionStatePanel missionInlineAlert">
            This session is locked to reviewers. Only operators with compare permission can launch a new diff job from this screen.
          </div>
        ) : null}
      </article>
    </section>
  );
}

function MappingScreen({
  state,
  onStateChange
}: {
  state: MappingState;
  onStateChange: (value: MappingState) => void;
}) {
  return (
    <section className="missionScreenStack">
      <StateStrip
        label="Mapping state"
        value={state}
        onChange={onStateChange}
        options={['populated', 'warning', 'empty', 'error'] as const}
      />

      <div className="missionSectionGrid missionSectionGridSidebar">
        <article className="missionCard missionTablePanel">
          <div className="missionCardHeader">
            <div>
              <p className="missionEyebrow">Confidence lanes</p>
              <h2>Field mapping review</h2>
            </div>
            <div className="missionToolbarGroup">
              <span className="missionStatusTag missionStatusTagGood">Auto 24</span>
              <span className="missionStatusTag missionStatusTagReview">Review 3</span>
            </div>
          </div>
          {state === 'empty' ? <div className="missionStatePanel">No uncertain fields remain. This mapping profile is ready for confirmation.</div> : null}
          {state === 'error' ? <div className="missionStatePanel missionInlineAlert">Mapping evidence could not be loaded from the validation service.</div> : null}
          {state !== 'empty' && state !== 'error' ? (
            <table className="missionGridTable" role="table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Target</th>
                  <th>Confidence</th>
                  <th>Rationale</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {mappingRows.map(([source, target, confidence, rationale, action]) => (
                  <tr key={source} className={state === 'warning' && source === 'Rev' ? 'missionRowHighlight' : undefined}>
                    <td>{source}</td>
                    <td>{target}</td>
                    <td>{confidence}</td>
                    <td>{rationale}</td>
                    <td>{action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </article>

        <article className="missionCard">
          <div className="missionCardHeader">
            <div>
              <p className="missionEyebrow">Review detail</p>
              <h2>Sample evidence</h2>
            </div>
            <button type="button" className="missionPrimaryButton">
              Confirm and continue
            </button>
          </div>
          <div className="missionStatePanel">
            <p>Highlighted mappings show token drift between supplier feeds and the approved ERP schema.</p>
            <DataList
              rows={[
                ['Incoming sample', 'REVISION_CODE'],
                ['Suggested target', 'revision'],
                ['Fallback profile', 'supplier_alpha_v4'],
                ['Reviewer note', 'Manual confirm recommended']
              ]}
            />
          </div>
        </article>
      </div>
    </section>
  );
}

function ResultsScreen({
  state,
  onStateChange,
  mode,
  onModeChange
}: {
  state: ResultsState;
  onStateChange: (value: ResultsState) => void;
  mode: ResultsMode;
  onModeChange: (value: ResultsMode) => void;
}) {
  return (
    <section className="missionScreenStack">
      <StateStrip
        label="Results state"
        value={state}
        onChange={onStateChange}
        options={['populated', 'loading', 'empty', 'error', 'partial'] as const}
      />

      <article className="missionCard">
        <div className="missionCardHeader">
          <div>
            <p className="missionEyebrow">Diff workspace</p>
            <h2>Approved result review surface</h2>
          </div>
          <div className="missionToolbarGroup">
            <button
              type="button"
              className={cn('missionGhostButton missionIconControl', mode === 'list' && 'missionStateButtonActive')}
              aria-label="List view"
              onClick={() => onModeChange('list')}
            >
              <ListIcon />
            </button>
            <button
              type="button"
              className={cn('missionGhostButton missionIconControl', mode === 'tree' && 'missionStateButtonActive')}
              aria-label="Tree view"
              onClick={() => onModeChange('tree')}
            >
              <TreeIcon />
            </button>
            <button type="button" className="missionGhostButton missionIconControl" aria-label="Share results">
              <ShareIcon />
            </button>
            <button type="button" className="missionGhostButton missionIconControl" aria-label="Download results">
              <DownloadIcon />
            </button>
          </div>
        </div>

        <div className="missionKpiGrid">
          <div className="missionKpiCard">
            <span>Diff rows</span>
            <strong>128</strong>
          </div>
          <div className="missionKpiCard">
            <span>Net cost delta</span>
            <strong>$14,280</strong>
          </div>
          <div className="missionKpiCard">
            <span>Manual review</span>
            <strong>9</strong>
          </div>
        </div>

        {state === 'loading' ? <div className="missionStatePanel">Building the diff table and hierarchy indexes for this session.</div> : null}
        {state === 'empty' ? <div className="missionStatePanel">No BOM differences were detected for the selected revisions.</div> : null}
        {state === 'error' ? <div className="missionStatePanel missionInlineAlert">Results could not be rendered because the diff service returned an invalid payload.</div> : null}
        {state === 'partial' ? (
          <div className="missionStatePanel missionInlineAlert">
            The main diff is available, but supplier metadata enrichment is degraded. Export remains available with core fields only.
          </div>
        ) : null}

        {state === 'populated' || state === 'partial' ? (
          mode === 'list' ? (
            <table className="missionGridTable missionGridTableDense" role="table">
              <thead>
                <tr>
                  <th>Change</th>
                  <th>Part</th>
                  <th>Rev</th>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Cost</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {resultRows.map(([change, part, rev, description, qty, cost, status]) => (
                  <tr key={part} className={change === 'Qty delta' ? 'missionRowHighlight' : undefined}>
                    <td>{change}</td>
                    <td>{part}</td>
                    <td>{rev}</td>
                    <td>{description}</td>
                    <td>{qty}</td>
                    <td>{cost}</td>
                    <td>{status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="missionTreePanel" role="tree" aria-label="Results hierarchy">
              <div className="missionTreeRow missionTreeIndent0">
                <strong>Powertrain assembly</strong>
                <span>12 changed descendants</span>
              </div>
              <div className="missionTreeRow missionTreeIndent1">
                <strong>Cooling subsystem</strong>
                <span>2 added parts</span>
              </div>
              <div className="missionTreeRow missionTreeIndent2">
                <strong>P-117-NC</strong>
                <span>Cooling manifold / added</span>
              </div>
              <div className="missionTreeRow missionTreeIndent1 missionRowHighlight">
                <strong>Harness assembly</strong>
                <span>Qty delta / operator review required</span>
              </div>
            </div>
          )
        ) : null}
      </article>
    </section>
  );
}

function ExportsScreen({
  state,
  onStateChange
}: {
  state: ExportState;
  onStateChange: (value: ExportState) => void;
}) {
  return (
    <section className="missionScreenStack">
      <StateStrip
        label="Export state"
        value={state}
        onChange={onStateChange}
        options={['ready', 'empty', 'restricted'] as const}
      />

      <div className="missionSectionGrid missionSectionGridSidebar">
        <article className="missionCard">
          <div className="missionCardHeader">
            <div>
              <p className="missionEyebrow">Explicit actions</p>
              <h2>Export outputs</h2>
            </div>
          </div>
          <div className="missionExportActionGrid">
            <button type="button" className="missionExportButton">
              <DownloadIcon />
              <span>Export CSV</span>
              <small>Flat diff rows for spreadsheet workflows</small>
            </button>
            <button type="button" className="missionExportButton">
              <DownloadIcon />
              <span>Export Excel-compatible</span>
              <small>Workbook with hierarchy and mapping context</small>
            </button>
          </div>
          {state === 'empty' ? <div className="missionStatePanel">Exports are disabled because the current comparison has no diffs to package.</div> : null}
          {state === 'restricted' ? (
            <div className="missionStatePanel missionInlineAlert">
              This user can review shared exports but cannot generate new files or grant access.
            </div>
          ) : null}
        </article>

        <article className="missionCard missionPanelSpaced">
          <div className="missionCardHeader">
            <div>
              <p className="missionEyebrow">Access control</p>
              <h2>Share session outputs</h2>
            </div>
            <button type="button" className="missionGhostButton missionIconControl" aria-label="Share access">
              <ShareIcon />
            </button>
          </div>
          <DataList
            rows={[
              ['Invite target', 'supplier.pm@vendor.test'],
              ['Permission', 'Read-only review'],
              ['Shared package', 'CMP-2041 workbook + comments'],
              ['Access expiry', '2026-03-21 17:00']
            ]}
          />
        </article>
      </div>
    </section>
  );
}

function HistoryScreen({
  state,
  onStateChange
}: {
  state: HistoryState;
  onStateChange: (value: HistoryState) => void;
}) {
  return (
    <section className="missionScreenStack">
      <StateStrip
        label="History state"
        value={state}
        onChange={onStateChange}
        options={['populated', 'empty'] as const}
      />

      <article className="missionCard missionTablePanel">
        <div className="missionCardHeader">
          <div>
            <p className="missionEyebrow">Archive index</p>
            <h2>Comparison history</h2>
          </div>
        </div>
        {state === 'empty' ? (
          <div className="missionStatePanel">No completed comparison sessions are available in this workspace yet.</div>
        ) : (
          <table className="missionGridTable" role="table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Name</th>
                <th>Created</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map(([sessionId, name, created, status]) => (
                <tr key={sessionId}>
                  <td>{sessionId}</td>
                  <td>{name}</td>
                  <td>{created}</td>
                  <td>{status}</td>
                  <td>
                    <div className="missionInlineActions">
                      <button type="button" className="missionTableAction missionTableActionPrimary">
                        Open
                      </button>
                      <button type="button" className="missionTableAction">
                        More
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </section>
  );
}

function NotificationsScreen({
  state,
  onStateChange
}: {
  state: NotificationsState;
  onStateChange: (value: NotificationsState) => void;
}) {
  return (
    <section className="missionScreenStack">
      <StateStrip
        label="Notifications state"
        value={state}
        onChange={onStateChange}
        options={['populated', 'empty'] as const}
      />

      <article className="missionCard missionTablePanel">
        <div className="missionCardHeader">
          <div>
            <p className="missionEyebrow">Event log</p>
            <h2>Notifications</h2>
          </div>
        </div>
        {state === 'empty' ? (
          <div className="missionStatePanel">No pending system notifications are active for this workspace.</div>
        ) : (
          <table className="missionGridTable" role="table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Detail</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {notificationRows.map(([event, detail, time]) => (
                <tr key={event}>
                  <td>{event}</td>
                  <td>{detail}</td>
                  <td>{time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </section>
  );
}

function AdminScreen({
  state,
  onStateChange
}: {
  state: AdminState;
  onStateChange: (value: AdminState) => void;
}) {
  return (
    <section className="missionScreenStack">
      <StateStrip
        label="Admin state"
        value={state}
        onChange={onStateChange}
        options={['authorized', 'unauthorized'] as const}
      />

      <article className="missionCard missionTablePanel">
        <div className="missionCardHeader">
          <div>
            <p className="missionEyebrow">Policy matrix</p>
            <h2>Admin controls</h2>
          </div>
        </div>
        {state === 'unauthorized' ? (
          <div className="missionStatePanel missionInlineAlert">
            Your role does not include admin policy access. Audit viewing remains available through History and Notifications only.
          </div>
        ) : (
          <table className="missionGridTable" role="table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Surface access</th>
                <th>Grant mode</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {adminRows.map(([role, access, grantMode, status]) => (
                <tr key={role}>
                  <td>{role}</td>
                  <td>{access}</td>
                  <td>{grantMode}</td>
                  <td>{status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </section>
  );
}
