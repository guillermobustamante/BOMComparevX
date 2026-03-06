# UI Generation Skill Examples

These are shape examples only. Do not copy them literally.

## Example 1: Foundation alignment check

The approved UI foundation is sufficient to generate the first wave of screens for the Operations module. The navigation model, information architecture, primary UI direction, and component guidance are clear enough to proceed.

Two gaps remain:
- mobile treatment for dense review tables is only partially defined
- permission-specific action visibility for supervisor versus operator roles is implied but not explicit

Proceeding assumption:
- operators can edit only draft and returned items
- supervisors can reassign, approve, and bulk update where allowed

Confidence level: medium-high

## Example 2: Strong screen spec

### Screen: Intake Queue

**Purpose**
Allow operations users to review newly arrived items, identify issues quickly, and route each item to the next step.

**Users**
- Intake operator
- Intake supervisor

**Workflow stage**
Initial review and triage

**Layout structure**
- standard application shell
- page header with queue title, saved view selector, item count, and primary action
- collapsible filter rail on desktop, filter drawer on tablet and mobile
- main content region with results summary row above a dense data table
- optional right-side detail preview panel on large screens only

**Component breakdown**
- PageHeader
- SavedViewSelect
- FilterPanel
- QueueTable
- StatusBadge
- PriorityBadge
- AssignmentCell
- RowActionMenu
- BulkActionBar
- DetailPreviewPanel

**Actions**
- open item
- assign item
- bulk assign
- apply filters
- save view
- export current filtered view if permissions allow

**States**
- initial loading
- populated
- filtered empty
- permission-limited
- partial data degradation
- server error
- no access

**Accessibility notes**
- keyboard access to all filter controls and row actions
- sortable columns announced correctly
- status not conveyed by color alone
- detail preview updates announced non-intrusively when opened

**Responsive notes**
- detail preview panel removed below large desktop breakpoint
- low-priority columns move behind expandable row details
- filter rail becomes drawer below tablet breakpoint

**Dependencies**
- queue API
- assignment mutation
- saved views store
- current-user permissions

**AI coding-agent prompt seed**
Build an Intake Queue screen using the existing app shell and shared page header patterns. Reuse existing filter, badge, and table primitives where possible. Support loading, populated, filtered-empty, no-access, and partial-degradation states. Implement desktop filter rail and mobile drawer behavior. Add row selection with conditional bulk action bar.

## Example 3: Good delivery sequencing

Recommended build order:
1. shared app shell and page header conventions
2. filter primitives and saved view behavior
3. queue table and state handling
4. detail screen shell
5. review and approval actions
6. secondary analytics or history screens

Parallelizable work:
- shared status and badge primitives
- empty, error, and no-access state components
- permissions utility layer