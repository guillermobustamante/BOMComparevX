# BOM Compare VX - UI Visual Approval Pack

Source of truth:
- [FOUNDATION_GENERATION_UI_PLAN.md](C:\Users\yetro\Evolve Global Solutions\BOM Compare - Documents\Code-BOMComparevX\BOMComparevX\docs\FOUNDATION_GENERATION_UI_PLAN.md)

Purpose:
- Provide the product manager with high-fidelity visual direction before implementation.
- Align all approval screens to the Antigravity-inspired "Mission Control" system.
- Lock dark/light theme behavior, iconography, navigation posture, and screen composition before coding against live routes.

## 1. Visual system summary

Primary aesthetic:
- Mission Control
- dense
- technical
- precise
- tool-like

Required shell behavior:
- collapsible left nav
- collapsed by default
- icon-first entries in collapsed state
- dark/light toggle always available

Required icon-first controls:
- list view
- tree view
- share
- download/export

Approval posture:
- High-fidelity enough for PM visual sign-off.
- Still mock-data driven.
- Not final production code.
- Full PM review scope now includes:
  1. Compare BOMs
  2. Mapping Check
  3. Results
  4. Exports and Sharing
  5. History
  6. Notifications
  7. Admin

## 2. Foundation alignment check

This approval pack is aligned to the updated foundation on:
- workflow-first navigation
- Excel-native operator mentality
- table-first results review
- mapping confidence triage
- export/share lifecycle importance
- Antigravity mission-control visual posture

What changed from the prior approval pack:
- stronger technical visual language
- explicit dark and light versions
- collapsed nav as default shell behavior
- icon-driven control groups
- dedicated Exports and Sharing screen

## 3. Shared shell approval model

### 3.1 Shell rules
- Left nav starts collapsed.
- Collapsed state shows icon-only targets.
- Expanded state reveals icon + label.
- Theme toggle lives in the shell header area, not buried in settings.

### 3.2 Shared visual rules
- Use panelized layouts with restrained linework.
- Use monospaced text for revisions, ids, row metadata, versions, and status-heavy table cells.
- Use short labels and compact spacing.
- Use plain-language copy for actions, with technical precision in metadata.

### 3.3 Shared icon rules
- SVG only.
- Recognizable symbols over custom novelty.
- Icon-only buttons require tooltip and accessible label.
- Keep icon sets visually consistent across nav and toolbar controls.

## 4. Theme requirements

### 4.1 Light theme
- Pale control-surface background.
- Soft teal line accents.
- Dark graphite text.
- Low-glare panel surfaces.

### 4.2 Dark theme
- Blue-black or graphite shell.
- Muted cyan accent lines.
- Elevated panels with crisp edge contrast.
- Table rows remain readable at dense settings.

### 4.3 Approval requirement
- PM approval is required for both themes, not only one.

## 5. Screen-by-screen approval boards

### 5.1 Compare BOMs

Purpose:
- Guided intake and comparison launch in a mission-control shell.

Visual structure:
- page header with workflow title, theme toggle, and shell controls
- compact progress rail or step strip
- two revision panels side by side
- validation panel with precise operational summary
- one dominant launch action

Desktop visual model:

```text
+----------------------------------------------------------------------------------+
| [nav] Compare BOMs                                  [theme] [shell] [profile]    |
|----------------------------------------------------------------------------------|
| Step strip: Select revisions | Validate | Compare                                |
|----------------------------------------------------------------------------------|
| Revision A panel                         | Revision B panel                       |
| file metadata                            | file metadata                          |
| source / timestamp / row count           | source / timestamp / row count         |
|----------------------------------------------------------------------------------|
| Validation state panel                                                        [] |
|----------------------------------------------------------------------------------|
| [Start comparison]                                                     [details] |
+----------------------------------------------------------------------------------+
```

PM approval focus:
- revision-first terminology
- technical but calm panel styling
- no oversized onboarding cards
- dominant compare launch action

### 5.2 Mapping Check

Purpose:
- Review uncertain mappings inside a dense technical review surface.

Visual structure:
- summary counters
- segmented confidence filters
- dense mapping table
- side panel with sample values and review note
- explicit continue action

Desktop visual model:

```text
+----------------------------------------------------------------------------------+
| [nav] Mapping Check                                 [theme] [shell] [profile]    |
|----------------------------------------------------------------------------------|
| Counters: Auto | Review | Unmapped                                              |
|----------------------------------------------------------------------------------|
| [Needs review] [Auto] [All]                                                     |
|----------------------------------------------------------------------------------|
| Source | Field | Confidence | Match rationale | Action                          |
|----------------------------------------------------------------------------------|
| Qty    | qty   | 0.61       | heuristic       | [edit]                          |
| Rev    | rev   | 0.42       | token collision | [edit]                          |
|----------------------------------------------------------------------------------|
| Sample preview panel                                      [Confirm and continue] |
+----------------------------------------------------------------------------------+
```

PM approval focus:
- confidence-based triage is obvious
- table looks like a review tool, not a consumer app
- continue action remains textual because it is workflow-critical

### 5.3 Results

Purpose:
- Main operational review workspace with icon-first controls.

Visual structure:
- dense header with status
- summary metrics row
- preset selector
- list/tree toggle using icon-first recognized symbols
- share and download/export buttons using recognized iconography
- main high-density results grid
- optional hierarchy side panel

Desktop visual model:

```text
+----------------------------------------------------------------------------------+
| [nav] Results                                       [theme] [shell] [profile]    |
|----------------------------------------------------------------------------------|
| Status line / counters / preset selector                                         |
|----------------------------------------------------------------------------------|
| [list icon] [tree icon]                     [share icon] [download icon]         |
|----------------------------------------------------------------------------------|
| Change | Part | Rev | Description | Qty | Cost | Status                          |
|----------------------------------------------------------------------------------|
| ... dense comparison table ...                                                    |
|----------------------------------------------------------------------------------|
| Optional hierarchy panel / technical details                                      |
+----------------------------------------------------------------------------------+
```

PM approval focus:
- icon-first control group
- preserved table density
- optional hierarchy panel
- explicit light and dark theme parity

### 5.4 Exports and Sharing

Purpose:
- Dedicated output and collaboration surface with access-control tone.

Visual structure:
- export control bar
- format cards or compact panel blocks
- invite/share panel
- recipient access table
- technical precision without social-product styling

Desktop visual model:

```text
+----------------------------------------------------------------------------------+
| [nav] Exports and Sharing                        [theme] [shell] [profile]       |
|----------------------------------------------------------------------------------|
| [download icon] Export workbook   [share icon] Share access                      |
|----------------------------------------------------------------------------------|
| Export format panel                     | Invite and access panel                 |
| CSV / Excel-compatible / structure note | email input / permission / action      |
|----------------------------------------------------------------------------------|
| Recipient table with access status and revoke action                             |
+----------------------------------------------------------------------------------+
```

PM approval focus:
- dedicated output screen is useful and justified
- download/share iconography is clear without text-heavy buttons
- sharing reads as controlled access, not casual collaboration

### 5.5 History

Purpose:
- Archive and lifecycle management surface for prior comparisons.

Visual structure:
- dense session index
- compact row-action model
- open as the primary action
- metadata-heavy table, not oversized cards

PM approval focus:
- lifecycle actions are consolidated cleanly
- the screen remains dense and operational
- archive behavior feels related to the same mission-control system

### 5.6 Notifications

Purpose:
- Lightweight event awareness surface.

Visual structure:
- compact counters
- event log table
- direct route-back behavior where relevant

PM approval focus:
- notifications remain secondary to core workflow
- the screen stays useful without becoming a dashboard duplicate

### 5.7 Admin

Purpose:
- Role-gated system policy and override surface.

Visual structure:
- user policy table
- operational action panel
- authoritative but visually separate from end-user workflow

PM approval focus:
- admin feels system-grade
- it does not visually contaminate the primary comparison workflow

## 6. Accessibility and responsive requirements

Accessibility:
- icon-only actions require labels
- collapsed nav is keyboard reachable
- theme toggle announces state
- dark/light contrast remains valid in dense tables

Responsive:
- collapsed nav remains the default on desktop and mobile
- expanded nav becomes overlay on smaller screens
- results grid keeps horizontal scroll instead of lossy card collapse

## 7. Approval checklist

Approve or reject:
1. Antigravity mission-control aesthetic
2. dark/light theme parity
3. collapsed-by-default left nav
4. icon-first list/tree/share/download controls
5. dedicated Exports and Sharing screen
6. dense Antigravity-style table treatment
7. remaining shell-aligned screens: History, Notifications, Admin

## 8. Final verdict

Executive verdict:
- Pass with conditions

Operational verdict:
- Ready for regenerated high-fidelity approval screens

Conditions:
1. PM accepts the mission-control visual direction.
2. PM accepts icon-first action language for low-risk controls.
3. PM accepts collapsed navigation as the default shell behavior.
