# BOM Compare VX - FOUNDATION + GENERATION UI PLAN

## Skill usage
Used `ui-foundation` first for workflow, architecture, user mentality, and information architecture.
Used `ui-generation` second for screen-level output, state handling, and approval-ready screen direction.

## A. Foundation summary

### A1. Current architecture map
- Frontend: Next.js 14 App Router with authenticated shell and table-heavy workspace routes.
- Backend: NestJS modules for uploads, mapping, diff jobs, exports, sharing, notifications, and admin controls.
- Persistence: Prisma on Azure SQL.
- Constraints remain unchanged: deterministic comparison, tenant isolation, Azure SQL Graph, CSV/XLSX-first scope.

### A2. User and workflow reality
- Primary users are operational and Excel-native.
- They value speed, trust, scan efficiency, and technical precision over decorative marketing UI.
- The UI must feel like a reliable operator console, not a consumer dashboard.

### A3. New visual direction
- Primary aesthetic: Antigravity-inspired "Mission Control".
- Design posture: high-density, developer-centric, utilitarian, calm, precise.
- Visual tone: instrument panel, structured control surface, low ornament, explicit states.
- Information posture: dense but readable, with strong hierarchy and restrained accents.
- Typography direction: technical sans with monospaced support for tables, revisions, ids, and operational metadata.

Inference note:
- This direction is based on the Antigravity "Mission Control" framing and the attached icon/table references supplied for this project.

### A4. Theme requirement
- Both light and dark themes are required.
- The approval and implementation direction must include a visible theme toggle.
- The dark theme is not optional decoration; it is part of the approved product direction.

### A5. Shell and navigation requirement
- The left navigation must be collapsible.
- Default state: collapsed.
- Collapsed nav shows icon-only entries for major sections.
- Expanded nav shows icon + label.
- Navigation icons must use internationally recognized symbols rendered as clean SVG.

### A6. Iconography requirement
- Use icon-first controls where meaning remains clear internationally.
- Priority icon replacements:
  1. List View
  2. Tree View
  3. Share
  4. Download / Export
- Icon-only controls must still have accessible labels and visible hover/focus treatment.
- Text labels remain required where icon clarity is not universal or where risk is higher.

## B. Delta analysis

### B1. What remains valid from the prior plan
- Workflow-first navigation remains correct.
- Results remains the primary decision workspace.
- Mapping confidence review remains necessary.
- Export and sharing remain central lifecycle actions.
- Backend contracts remain stable.

### B2. What changes with the new direction
- The visual baseline shifts from calm enterprise workflow to mission-control utility.
- The shell becomes denser and more technical in tone.
- The nav becomes collapsed-first instead of label-first.
- Results controls move further toward icon-first action language.
- Theme parity becomes a first-class requirement.
- Exports and Sharing becomes an explicit screen in the visual pack, not just a subsection treatment.

## C. Updated UX direction

### C1. Primary UI direction
- Mission-control operations console.
- Compact left rail.
- Dense horizontal toolbars.
- Strong panel boundaries.
- Technical precision with plain-language primary copy.
- Monospaced operational metadata where useful.

### C2. Fallback direction
- Softer enterprise console using the same IA and control model.
- Lower density, more whitespace, but still icon-led and shell-consistent.

### C3. Language rules
- Primary copy remains operational and plain language.
- Technical identifiers are visible but secondary.
- Error codes and traces live behind expandable detail treatment.

## D. Updated IA and shell

### D1. Navigation
1. Compare BOMs
2. Mapping Check
3. Results
4. Exports and Sharing
5. History
6. Notifications
7. Admin

### D2. Shell behavior
- Nav collapsed by default.
- Expanded state available from a top-left shell toggle.
- Theme toggle remains visible from the shell header.
- Current screen context remains visible in the page header, not only in the nav.

### D3. Screen grouping
- Compare BOMs: intake and comparison start
- Mapping Check: field validation and review
- Results: operational scan workspace
- Exports and Sharing: output and collaboration
- History: comparison lifecycle archive
- Notifications: passive status awareness
- Admin: role-gated operational control

## E. Screen generation changes

### E1. Compare BOMs
- Use a mission-control intake surface with revision panels, validation state rail, and one dominant launch action.
- Button labels may remain textual here because the workflow is higher risk.
- Upload and validation states must support both light and dark theme contrast cleanly.

### E2. Mapping Check
- Use confidence-banded review table with dense metadata and technical precision.
- Tabs or segmented controls should feel tool-like, not card-like.
- Continue action remains explicit and textual.

### E3. Results
- Use a control-bar pattern with icon-first list/tree/share/export actions.
- Default view remains table/list.
- Tree view remains available through a recognized hierarchy icon.
- Persona presets remain, but the layout should feel like filter presets in an engineering console.

### E4. Exports and Sharing
- Must be treated as a first-class approval screen.
- Export buttons may use icon-first treatment with supporting tooltip/label.
- Sharing should feel like access control, not social collaboration.

## F. Component and visual system requirements

### F1. Component categories
- collapsible mission-control nav
- theme toggle
- icon toolbar group
- panel header with operational metadata
- dense data table
- status pill system
- segmented view toggle
- export/share action group
- technical detail disclosure

### F2. Table guidance
- Use the attached Antigravity-style grid as the visual reference for density and precision.
- Header cells should feel like system metadata headers.
- Active or selected row treatment may use restrained highlight bands.
- Status pills should resemble validation or review tokens, not marketing badges.

### F3. Theme tokens
Light theme:
- pale control-surface background
- subtle teal/cyan accent
- neutral graphite text
- restrained validation greens and review ambers

Dark theme:
- graphite or blue-black shell
- desaturated cyan accent
- soft linework
- readable elevated panels with clear contrast

## G. Accessibility and responsive rules

### G1. Accessibility
- Icon-only buttons require accessible names.
- Theme toggle must expose current mode to assistive tech.
- Collapsed nav must preserve keyboard and screen-reader navigation.
- Dark and light theme contrast must both meet the project baseline.

### G2. Responsive behavior
- Collapsed nav remains the default even on desktop.
- On smaller widths, the expanded nav becomes an overlay.
- Dense table remains table-first; horizontal scroll is preferred over destructive cardification for Results.

## H. Updated execution backlog

### H1. Foundation/generation artifacts
1. Update foundation direction to Antigravity mission-control visual posture.
2. Update approval pack with dark/light variants and collapsed-nav shell rules.
3. Add explicit Exports and Sharing approval screen.

### H2. High-fidelity approval prototype
1. Regenerate Compare BOMs in mission-control style.
2. Regenerate Mapping Check in mission-control style.
3. Regenerate Results in mission-control style with icon-first view/share/export controls.
4. Regenerate Exports and Sharing as a dedicated high-fidelity screen.
5. Add theme toggle and collapsed nav behavior to the approval route.

## I. Final verdict

Executive verdict:
- Pass with updated conditions

Operational verdict:
- Ready for regenerated visual approval work

Conditions:
1. Product manager must approve the Antigravity mission-control direction itself.
2. Product manager must approve icon-first controls for list/tree/share/export.
3. Product manager must approve collapsed-by-default navigation.
