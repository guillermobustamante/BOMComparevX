# Multi-Industry Engineering Change Request (ECR)

## Part 1: General Information
* **ECR Number:** [Auto-generated]
* **Date Submitted:** [YYYY-MM-DD]
* **Originator Name:** [Name]
* **Department:** [Engineering / Manufacturing / Quality / Supply Chain]
* **Affected Item/Assembly Number:** [Part Number or Model GUID]
* **Current Revision Level:** [Rev]
* **Industry Context:** (Select all that apply to dictate routing)
    * [ ] General Manufacturing
    * [ ] Automotive
    * [ ] Electronics
    * [ ] Aerospace
    * [ ] Defense & Government
    * [ ] Construction & Built Environment
* **Change Priority:**
    * [ ] Emergency (Safety risk, line down, stop ship)
    * [ ] Urgent (Production impact imminent)
    * [ ] Routine (Standard continuous improvement or cost reduction)

## Part 2: Change Description and Justification
* **Title of Change:** [Brief summary, e.g., Replace 10 mm bracket with 12 mm reinforced bracket]
* **Detailed Description:** [What exactly is changing? Include before and after states.]
* **Reason for Change:** [Why is this necessary? e.g., Cost reduction, field failure, obsolescence, supplier request.]
* **Alternative Solutions Considered:** [Did we look at other options? Why was this one chosen?]

## Part 3: Industry-Specific Compliance Routing
*Complete the section(s) corresponding to the "Industry Context" selected in Part 1.*

### Section 3A: General Manufacturing Compliance (ISO 9001 base)
* [ ] **ISO 9001 Clause 8.5.6 (Design Change):** Does this alter form, fit, function, or BOM structure?
* [ ] **ISO 9001 Clause 8.4 (Supplier Change):** Does this change the approved source, manufacturing site, or sub-tier?
* [ ] **ISO 14001 (Environmental):** Does this introduce new chemicals, resins, or restricted substances?
* [ ] **Machinery Directive / CE Mark:** Does this affect a safety-critical characteristic or safety label?

### Section 3B: Automotive Compliance (IATF 16949 & Core Tools)
* [ ] **PPAP Trigger (Level 1-5):** Does this change geometry, tolerance, or introduce a new production tool?
* [ ] **Control Plan & PFMEA Update:** Does this affect a special characteristic or require a line process move?
* [ ] **IMDS Reporting:** Does this alter the material composition, finish, or plating requiring a new IMDS ID?
* [ ] **Functional Safety (ISO 26262):** Does this modify ECU variant code, calibration dataset, or ASIL-rated hardware?

### Section 3C: Electronics Compliance (JEDEC, IPC, Cybersecurity)
* [ ] **PCN / PDN Requirement (J-STD-046/048):** Is this driven by a component manufacturer's change or EOL notice?
* [ ] **PCB/PCBA Alteration:** Does this affect layer stack-up, impedance rules, or test program coverage?
* [ ] **Cybersecurity / Firmware (IEC 62443):** Does this update a bootloader, security key, FPGA bitstream, or memory map?
* [ ] **Material Declaration (IPC-1752A):** Does this affect RoHS, REACH SVHC, or Halogen-free status?

### Section 3C: Aerospace Compliance (AS9100 & FAA/EASA)
* [ ] **Airworthiness Classification:** Is this a Major or Minor change under 14 CFR Part 21?
* [ ] **First Article Inspection (AS9102):** Does this introduce a new process, tooling, or manufacturing site?
* [ ] **Special Process Qualification:** Does this change an NDT, heat treat, plating, or welding spec (Nadcap review)?
* [ ] **Software Baseline (DO-178C / DO-254):** Does this change loadable software or programmable hardware baselines?

### Section 3D: Defense Compliance (EIA-649 & Contractual Flow-down)
* [ ] **Baseline Authority (EIA-649):** Is this a Class I (Government CCB required) or Class II (Internal CCB) change?
* [ ] **Export Control (ITAR/EAR):** Does this introduce a new country of origin or affect export classification?
* [ ] **DFARS Compliance:** Does this affect specialty metals (252.225-7009) or approved vendor lists?
* [ ] **Cybersecurity (CMMC):** Does this change a supplier handling Controlled Unclassified Information (CUI)?

### Section 3E: Construction Compliance (ISO 19650 & AIA/FIDIC)
* [ ] **Design/Model Clash (BIM):** Does this alter an IFC GUID, routing clearance, or structural load?
* [ ] **Code/Permit Impact:** Does this affect occupancy, fire rating, ADA accessibility, or energy baselines?
* [ ] **Sustainability (EPD/LEED):** Does the substitute material lack an Environmental Product Declaration?
* [ ] **Commercial Impact (AIA G701):** Will this require a formal adjustment to the contract sum or schedule?

## Part 4: Disposition and Inventory Plan
* **Existing Inventory/Work-in-Progress Disposition:**
    * [ ] Scrap existing stock
    * [ ] Rework existing stock
    * [ ] Use as is (run out existing stock before cut-in)
* **Target Effectivity:** [Specific Date / Specific Serial Number / Specific Lot Number / Specific Plant]

## Part 5: Required Approvals (RACI Matrix)
*Routing is dictated by the compliance triggers selected in Part 3.*

* **Design/Engineering Authority:** [Signature / Date]
* **Manufacturing/Process Authority:** [Signature / Date]
* **Quality/Compliance Officer:** [Signature / Date]
* **Supply Chain/Procurement:** [Signature / Date]
* **Customer/External Authority (If triggered):** [Signature / Date]
* **Change Control Board (CCB) Final Approval:** [Signature / Date]