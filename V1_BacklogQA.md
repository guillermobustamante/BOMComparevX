# BACKLOG_S4QnA

## 1. Tie-break rules for deterministic matching

### 1) Keep your locked primary hierarchy as-is

1. Internal ID
2. Part Number + Revision
3. Part Number only
4. Fuzzy
5. No match

### 2) Add deterministic tie-break inside each level

Recommended secondary order:

1. **Uniqueness first**: if exactly one candidate, auto-select it.
2. **Highest confidence/score** (for fuzzy or weighted exact variants).
3. **Attribute concordance** (description exact, then quantity, then supplier).
4. **Stable deterministic fallback** (lowest target row index / stable UUID lexical order).
5. **Ambiguity rule**: if top two candidates are within a tiny score delta, do not auto-pick; mark review-required/manual.

### 3) Guardrail I strongly recommend

1. **One-to-one matching lock**: once a target row is matched, it cannot be reused by later source rows in the same pass (prevents duplicate over-matching).

> "Matching strategy order is fixed: Internal ID → Part Number + Revision → Part Number → Fuzzy → No Match.  
> Within a strategy, choose unique candidate first; else highest score; else attribute concordance; else stable index order."

## 2. Change classification policy

| **Change Type** | **Definition** |
|---|---|
| **Added** | A new part number or sub-assembly is introduced into the BOM structure that was not present in the previous version. |
| **Removed** | An existing part number or sub-assembly is deleted from the structure. |
| **Replaced** | A part is removed and a different part number is added in its place to perform the same function. |
| **Modified** | The part number remains the same, but its internal attributes (like weight, material, or dimensions) or its revision level has changed. |
| **Moved (Relocated)** | The part remains in the BOM, but its position in the hierarchy or its reference designator has changed. |
| **Quantity Change** | The part number is the same, but the count (e.g., from 2 to 4) has been updated. |

### Part Properties and the Impact of Change

Not all changes are equal. To manage them effectively, we categorize properties based on how they affect the physical or functional nature of the part. This is often dictated by the **Form, Fit, and Function (FFF)** rule.

#### 1. Critical Properties (Revision-Driving)

Changes to these properties usually require a new revision or even a new part number if the change is not backward compatible:

- **Dimensions/Geometry:** Changes to the physical shape or size.
- **Material:** Switching from aluminum to steel, for example.
- **Performance Specifications:** Electrical ratings, load capacities, or tolerance levels.
- **Interface/Mounting:** Where and how the part connects to other components.

#### 2. Metadata Properties (Non-Revision-Driving)

These are "least important" in terms of physical impact and often only require a "minor update" or a "working version" change without incrementing the formal revision:

- **Description:** Clarifying the name of the part.
- **Unit of Measure:** Correcting "EA" to "Each" (though this can be tricky if the math changes).
- **Supplier Info:** Adding an alternative manufacturer without changing the spec.
- **Weight (Minor):** Small corrections that don't affect the overall assembly center of gravity.

#### Compare Revision

- You should **compare** or account for the revision when the classification attributes themselves have changed.
- If Revision B of a part introduces a new attribute that didn't exist in Revision A (like "RoHS Compliance Status"), then the revision becomes critical to the classification data.

This matrix is built on the industry-standard **Form, Fit, and Function (FFF)** principle.

| **Change Category** | **Property / Attribute** | **Impact on FFF?** | **Action Required** |
|---|---|---|---|
| **Physical** | Change in dimensions, tolerances, or weight that affects assembly. | Yes | **New Part Number** |
| **Functional** | Change in power rating, load capacity, or software logic. | Yes | **New Part Number** |
| **Material** | Change in base material (e.g., Plastic to Aluminum). | Yes | **New Part Number** |
| **Compatibility** | New version is NOT backward compatible with the old version. | Yes | **New Part Number** |
| **Refinement** | Tightening a tolerance or improving a finish without changing assembly. | No | **New Revision** |
| **Correction** | Fixing a drafting error or updating a CAD model for clarity. | No | **New Revision** |
| **Metadata** | Changing a description, adding a keyword, or fixing a typo. | No | **Minor Update / No Rev Change** |
| **Commercial** | Adding a new approved manufacturer for the same spec. | No | **New Revision (or AML update)** |

## 3. Normalization rules before comparison

### 1. Case Sensitivity

**Rule: Case-Insensitive Comparison.** In manufacturing data, "BOLT," "Bolt," and "bolt" almost always refer to the same thing.

- **Action:** Convert all string attributes (Description, Manufacturer Name, Material) to **Uppercase** before comparison.
- **Exception:** Part numbers should typically be stored and compared exactly as entered, but for comparison purposes, uppercase is the safest bet to avoid duplicate entries in a database that might treat "part-1" and "PART-1" as different records.

### 2. Whitespace and Punctuation

**Rule: Trim and Single-Space.** Hidden characters are the most common cause of "false positive" changes.

- **Whitespace:** Apply a `Trim()` function to remove leading and trailing spaces. Use a regex to replace multiple internal spaces with a single space (e.g., "Steel   Plate" becomes "Steel Plate").
- **Punctuation:** This is subjective.
  - For **Part Numbers**, I recommend removing hyphens, dots, or slashes *only if* your company has a history of inconsistent entry (e.g., "123-456" vs "123456").
  - For **Descriptions**, keep punctuation but normalize the spacing around it (e.g., "M6,Hex" vs "M6, Hex").

### 3. Numeric Normalization

**Rule: Mathematical Equality, not String Equality.** A computer sees "1" and "1.0" as different strings, but an engineer sees them as the same value.

- **Floating Point:** Cast numeric strings to a high-precision decimal type before comparing.
- **Leading Zeros:** Strip leading zeros for quantities and numeric attributes (e.g., "01" becomes "1") unless the leading zero is a functional part of a codified Part Number.
- **Precision:** Define a "Comparison Tolerance." For example, if a weight changes from 1.0001kg to 1.0002kg, should that trigger a Change Order? Usually, no.

### 4. Unit Normalization

**Rule: Base-Unit Conversion.** This is the most complex layer of normalization. If one BOM lists "1000 mm" and the other lists "1 m," a simple string or number comparison will fail.

- **The Global Standard:** Convert all measurements to a defined "System Base Unit" (typically Metric for modern manufacturing) before the comparison.
- **Mapping Table:** Maintain a conversion table (e.g., 1 inch = 25.4 mm; 1 kg = 1000 g).
- **Example:** If User A enters "50 cm" and User B enters "0.5 m," the normalization engine converts both to "500 mm." The comparison then sees 500 == 500 and reports **No Change**.

## 4. Results grid behavior priorities

- Which filters are mandatory for S4 (change type, text search, column filters)? change type, text search, column filters
- Sort defaults? Use the same defaults as the original file, do not change sorting, and this would be the most recent uploaded file.
- Pagination/virtualization expectations for big BOMs? Recommend a pagination appropriate for a modern browser something that keeps the experience excellent for the end user.

## 5. Visual diff conventions

| **Change Type** | **Color** | **Hex Code** | **Visual Meaning** |
|---|---|---|---|
| **Added** | Green | #28A745 | New growth; a new requirement for the build. |
| **Removed** | Red | #DC3545 | Stop; this part is no longer valid or needed. |
| **Replaced** | Orange | #FD7E14 | Caution; a "swap" occurred. Requires checking compatibility. |
| **Modified** | Blue | #007BFF | Information; the identity is the same, but details changed. |
| **Quantity Change** | Purple | #6F42C1 | Logistic shift; no new parts, just more or fewer of them. |
| **Moved (Relocated)** | Yellow | #FFC107 | Attention; the part is the same, but the location in the tree is new. |
| **No Change** | Grey/White | #F8F9FA | Neutral; standard baseline data. |

- Should unchanged fields be dimmed/hidden? Unchanged fields should not change color.

## 6. Progressive/streaming delivery expectations

### 1) Use job-based polling (primary)

- Client starts diff job (POST /diff-jobs).
- Client polls status (GET /diff-jobs/{id} every 1--2s).
- Response includes:
- phase (matching, classifying, finalizing)
- percent complete
- counters (processed, added, removed, changed, unchanged)
- nextCursor for partial rows.

Why:

- Simple, resilient, easy to retry.
- Works well with your existing staged worker pattern and queueing mindset.

### 2) Return progressive chunks of result rows

- Separate endpoint for rows: GET /diff-jobs/{id}/rows?cursor=\...&limit=\...
- Client appends chunks to grid incrementally.
- Cursor guarantees stable ordering so rows don't jump around.

Why:

- Feels "streaming" to users.
- Keeps payloads small and avoids giant full-result responses.

### 3) Define "minimum useful partial payload"

- For each chunk, include:
- rowId, changeType (added|removed|changed|unchanged)
- key fields (part_number, revision, description)
- per-cell diff summary for highlighted columns.
- This supports Stage 4's requirements for classification + row/cell visualization + filter/sort behavior while data is still arriving.

### 4) Lock these UX SLAs for S4 backlog

Suggested targets:

- First progress response: **< 2s**
- First row chunk visible: **< 5s**
- Subsequent chunk cadence: every **1--3s** (or when batch ready)

These are practical for V1 and easy to test in acceptance criteria.

### 5) "Done" behavior for partial results

- Filters/search/sort apply to **loaded rows** immediately.
- Show badge like "Partial results (x/y processed)".
- When job completes, auto-refresh final totals and enable "complete dataset" actions.

## 7. Scale + performance targets for S4

- Performance: Parse 30 MB Excel in <10 seconds.
- Performance: Parse 30 MB CSV in <5 seconds
- Initial Page load <3 seconds
- UI interactions <500 ms

## 8. Auditability requirements for diff outcomes

- Do we need per-row/per-cell rationale metadata (why classified as changed)? Yes.
- Retention duration for diff artifacts? Yes, Recommend a retention period, minimized that for non-paying customers.

## 9. Out-of-scope confirmations

- Confirm Stage 5 items stay out (export/share/notifications/admin in S4 backlog). Yes, Stage 5 items stay out for this Stage (4)

## 10. Priority + estimate preferences

- Should S4 follow same style as S3 (P0-heavy, story-point sizing)? Yes.
- Any team ownership constraints (BE/FE split)? Execution and testing is done by codex.

## Optional (but very helpful) inputs

- Any **UI references** you want the results grid to resemble.

### 1. The Visual Framework: "Bento-Box" Modular Design

- We are seeing a shift to **Bento-style layouts**. Instead of one giant scrolling table, the UI is broken into functional "tiles" or "cards" that aggregate related data.
- **The Hero Tile:** A 3D view (rendered via **WebGPU**) of the assembly. Hovering over a part in the 3D viewer highlights the corresponding row in the BOM grid.
- **The Grid Tile:** A high-performance, virtualized data grid (handling 100k+ rows) with **Glassmorphism** depth effects to separate the "current" view from "overlay" comparisons.
- **Tactile Affordances:** Using **Light Skeuomorphism** (soft shadows and bevels) on primary action buttons (like "Release" or "Compare") to make them feel physically interactive, reducing "click-hesitation."

### 2. The Comparison Engine: "Ghosting & Diffing"

- The modern standard for comparing revisions is no longer side-by-side text, but **Visual Ghosting**.
- **The Ghost Layer:** When comparing Rev A to Rev B, the 3D viewer renders Rev A as a semi-transparent "ghost" (grey) and Rev B as a solid color. Added parts are **Green**, removed are **Red**, and modified are **Blue**. At this moment, the ghosting will be minimized since no cad implementation has been performed.
- **Micro-interaction Feed:** As you scroll the BOM, a "Mini-Map" on the right sidebar shows the entire BOM height with color-coded ticks representing changes. Clicking a tick jumps you exactly to that change.
- **Inline Change Reason (The "Why"):** In 2026, we use **Contextual Threads**. You can click any changed property and see a fly-out chat window showing the exact Change Request (CR) or engineer conversation that led to that specific change.

### 3. Intelligent Normalization & Data Quality

- State-of-the-art systems don't just compare; they **Self-Heal** using AI agents.
- **AI Normalization Shadowing:** As a user types a description, an AI agent suggests the "Standardized" version in real-time (e.g., "M6 bolt" -> "BOLT, HEX, M6X1.0").
- **Predictive Validation:** The UI highlights cells in **Purple** if the data doesn't match the "Digital Twin" in the CAD vault, acting as a pre-flight check before formal submission.

### 4. Technical Stack (The "How")

- To build this today, you would use:
- **Frontend:** React 19 or Next.js 16 with **Tailwind CSS** for design tokens.
- **3D Visualization:** **Three.js** or **Babylon.js** utilizing **WebGPU** for native-speed hardware acceleration in the browser.
- **Real-time:** **WebSockets (Socket.io)** for "Multiplayer" BOM editing—you see other users' cursors and edits as they happen, preventing write-conflicts.
- **Data Handling:** **TanStack Table** for high-density, performant grid management with complex filtering.
