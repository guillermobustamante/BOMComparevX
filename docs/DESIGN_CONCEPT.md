
# Design Concept: BOMComparevX - "Project Gravity Control"

## 1. Vision & Core Principles

This document outlines the design language for the redesign of the BOMComparevX frontend. Our vision is to create an interface that is powerful, intuitive, and visually stunning, enabling users to perform complex tasks with precision and speed.

We will achieve this by fusing two core principles:

*   **Mission Control Aesthetics:** Emphasizing technical precision, high-density data visualization, and immediate access to critical information. The UI will feel like a professional command center for supply chain operations.
*   **Google Antigravity Principles:** Creating a sense of depth, order, and weightlessness. The interface will be clean, fast, and reactive, using subtle layering and clean geometry to guide the user's focus.

## 2. Visual Language

### Color Palette

Colors are chosen for clarity, contrast, and function. The dark theme is the primary experience, while the light theme provides accessibility and user choice.

#### Dark Theme (Primary)
*   **Base (Elevation 0):** `#121212` (Almost Black) - The deepest layer, providing a backdrop for the main content.
*   **Surface (Elevation 1):** `#1E1E1E` (Dark Grey) - The primary content surface for grids and forms.
*   **Raised (Elevation 2):** `#2A2A2A` (Charcoal) - For side panels, dialogs, and elevated controls.
*   **Text (Primary):** `#EAEAEA` (Light Grey)
*   **Text (Secondary):** `#9E9E9E` (Medium Grey)
*   **Borders/Accents:** `#424242` (Dark-Mid Grey)

#### Light Theme
*   **Base (Elevation 0):** `#F7F9FC` (Very Light Blue-Grey)
*   **Surface (Elevation 1):** `#FFFFFF` (White)
*   **Raised (Elevation 2):** `#FFFFFF` with increased shadow - Panels and dialogs will be distinguished primarily by elevation.
*   **Text (Primary):** `#1E1E1E` (Dark Grey)
*   **Text (Secondary):** `#5F6368` (Google's Grey)
*   **Borders/Accents:** `#DADCE0` (Light Grey)

#### Accent & Status Colors
These high-contrast colors are used for status indicators, alerts, selections, and calls to action.
*   **Primary Action / Focus:** `Cyan` - `#00BCD4`
*   **Success / Match:** `Lime` - `#76FF03`
*   **Warning / Change:** `Amber` - `#FFC107`
*   **Error / Conflict:** `Red` - `#FF5252`
*   **Info / Neutral:** `Blue` - `#448AFF`

### Typography

*   **Primary Font:** `Inter` - A clean, highly legible sans-serif font that works beautifully for UI text and scales well.
*   **Monospace Font:** `Roboto Mono` - For all part numbers, quantities, and other tabular data where alignment and distinction of characters (like `0` vs `O`, `1` vs `l`) are critical.

### Iconography

*   We will use a custom set of minimalist, line-art icons (based on the existing `mission-icons.tsx`) to represent actions and objects. Icons will be `20x20` and use the primary text color, with active/focused states using the `Cyan` accent.

## 3. Layout & Structure (Antigravity)

### Elevation & Layering

The UI will be built on a system of "elevations" to create depth and guide focus.
*   **Elevation 0:** The main application background.
*   **Elevation 1:** The primary content plane (e.g., the `results-grid`).
*   **Elevation 2:** Side panels (`history-panel`), navigation bars.
*   **Elevation 3:** Modal dialogs (`results-impact-dialog`).

Elevation is communicated through a combination of background color (in dark mode) and soft, subtle `box-shadow`.

### Navigation

*   A persistent, top-level `App-Shell` will contain the main navigation, user profile/logout, and a global search/command bar.
*   Sub-navigation for specific contexts (e.g., within the `mapping-control-center`) will be placed in a secondary header bar just below the main shell.

## 4. Component Design (Mission Control)

### Data Grids (`results-grid`)

This is the core of the experience.
*   **Density:** Optimize padding and font size for high information density without sacrificing legibility.
*   **Clarity:** Use zebra-striping on rows for easier horizontal tracking. A `Cyan` highlight will indicate the currently selected row.
*   **Status:** A dedicated "Status" column will use colored icons/tags (`Lime`, `Amber`, `Red`) to show the comparison result for each line item instantly.
*   **Headers:** Sticky headers will remain visible on scroll.

### Buttons & Controls

*   **Primary Button (CTA):** Solid `Cyan` background, white text. Has a subtle glow/shadow on hover.
*   **Secondary Button:** Outlined in `Cyan`, with `Cyan` text. Fills with a transparent cyan on hover.
*   **Tertiary/Ghost Button:** Plain text (`EAEAEA` or `#1E1E1E`) that brightens on hover.

### Forms (`upload-validation-form`)

*   Clean, minimalist text inputs with a bottom border that turns `Cyan` on focus.
*   Labels are placed above the input field.
*   Validation errors are shown below the field with `Red` text and an icon.

## 5. User Focus: The 'Next Best Action'

The design will proactively guide the user.
*   **Mission Control Dashboard:** The main `/` page will be a dashboard that summarizes key information:
    *   "Open Approvals" needing attention.
    *   "Recent Uploads" with their validation status.
    *   A "Bottleneck Summary" highlighting the most critical discrepancies in recent comparisons.
*   **Contextual Actions:** Within the `results-grid`, the selected row will populate a contextual action panel, showing the user what they can do with that specific item (e.g., "Approve Change," "Investigate Discrepancy," "View History"). This keeps the user focused and reduces cognitive load.
*   **Impact Highlighting:** When viewing a change, the `results-impact-dialog` will use the `Amber` and `Red` status colors prominently to draw immediate attention to the most significant consequences of a proposed change.
