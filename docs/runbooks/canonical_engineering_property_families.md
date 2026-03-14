# Canonical Engineering Property Families

## Purpose

This document defines a platform-owned semantic layer between raw BOM column names and tenant-facing taxonomy tags.

The target behavior is:

`source property -> canonical family -> classification tag -> industry taxonomy category`

Example:

* source property: `Volume_mm3`
* canonical family: `volume`
* classification tag: `Volume`
* taxonomy category: `Product design or form-fit-function change` in Automotive

This document was expanded using a time-boxed public-web research pass across official BOM-like artifacts, parts lists, import templates, and change-control documentation from major organizations and standards. Public full BOM workbooks are rare in automotive, aerospace, defense, and medical due IP and export restrictions, so the evidence base includes:

* public BOMs or parts lists where available
* official import templates and parts-list data dictionaries
* official change-control documents that expose the field vocabulary used around released BOMs

## Research confidence

This revision materially improves alias coverage, especially for:

* geometry and physical-property fields
* electronics-specific part and package fields
* sourcing / approved-source / manufacturer fields
* effectivity and configuration fields
* packaging / labeling / traceability fields
* software / calibration / embedded configuration fields
* construction / asset / IFC / COBie-like schedule fields

It is stronger than the previous draft, but it should still be treated as a platform baseline, not a final claim of universal 90% coverage. The platform should expect ongoing enrichment from real tenant data and from actual uploaded tenant BOMs.

## Source basis used in this expansion

The following public sources influenced the family and alias expansion:

* Magna supplier change / quality requirement material and Toyota-style process-change requirement patterns already captured in [bom_change_taxonomy_by_industry.md](/c:/Users/yetro/Evolve%20Global%20Solutions/BOM%20Compare%20-%20Documents/Code-BOMComparevX/BOMComparevX/docs/runbooks/bom_change_taxonomy_by_industry.md)
* Boeing D6-51991 supplier digital product definition guidance, which references CAD/CAM/CAI, measurement systems, and product-definition process changes: [Boeing supplier page](https://www.boeingsuppliers.com/doingbiz/d14426.pdf)
* Crane Aerospace supplier change-control and quality guidance already referenced in [bom_change_taxonomy_by_industry.md](/c:/Users/yetro/Evolve%20Global%20Solutions/BOM%20Compare%20-%20Documents/Code-BOMComparevX/BOMComparevX/docs/runbooks/bom_change_taxonomy_by_industry.md)
* NASA / NSSC illustrated parts-list style data, which exposes fields such as figure, item, part number, description, quantity, usage, units, and next-higher assembly context: [NASA example](https://ntrs.nasa.gov/api/citations/19770018183/downloads/19770018183.pdf)
* DLA source approval / parts-control material, which reinforces source-control, approved-source, CAGE, manufacturer, and effectivity-like traceability concepts: [DLA page](https://www.dla.mil/Aviation/Offers/SourceApprovalRequest/)
* Infineon BOM export / import guidance showing electronics BOM structures with fields like reference designator, quantity, MPN, description, package / footprint / dimensions: [Infineon page](https://documentation.infineon.com/spice/using-infineon-spice/tgv1751972211805)
* Intel Transparent Supply Chain As-Built Data / PCN material, which contributes manufacturer, site, assembly, test, traceability, lot/date-code, and change-notification vocabulary: [Intel TSC page](https://www.intel.com/content/www/us/en/quality/quality-transparency-cpg.html)
* Autodesk / construction import-template and asset-data pages, which contribute asset, system, location, zone, room, type, model, submittal, and schedule-oriented property names: [Autodesk page](https://help.autodesk.com/view/RVT/2024/ENU/?guid=GUID-0ED0A9B5-8F31-4FEA-BF50-844D84D3E6B4)
* buildingSMART / IFC and COBie field conventions already reflected in [bom_change_taxonomy_by_industry.md](/c:/Users/yetro/Evolve%20Global%20Solutions/BOM%20Compare%20-%20Documents/Code-BOMComparevX/BOMComparevX/docs/runbooks/bom_change_taxonomy_by_industry.md)

## Design rules

### Rule 1: canonical families are global

Canonical families should be platform-owned and cross-tenant. Tenants may override tag labels and category mappings, but they should not have to reinvent the semantic families.

### Rule 2: classification tags stay human

Canonical family IDs may be snake_case and stable for code.
Classification tags should stay readable for admins:

* `Volume`
* `Bounding Box`
* `Approved Supplier`
* `Software / Calibration`

### Rule 3: normalization must be engineering-aware

String-only fuzzy logic is not enough. The resolver should normalize:

* case and separators
* camel / snake / kebab / space variants
* common engineering unit suffixes
* common system prefixes / suffixes such as `calc`, `nominal`, `actual`, `target`, `measured`, `ref`

Examples:

* `Volume_mm3`, `Volume (mm3)`, `part volume`, `calc_volume`
* `CenterOfMass`, `center_of_mass`, `CG`, `centroid`
* `Drawing/Spec Revision`, `drawing spec rev`, `spec_rev`

### Rule 4: family first, fuzzy last

Recommended resolution order:

1. exact normalized tag match
2. canonical-family match
3. semantic alias match
4. guarded fuzzy match

## Family groups

The families below are grouped by intent because not all classification-triggering fields are geometric. The taxonomy already includes sourcing, effectivity, compliance, process, and packaging concepts, so the semantic model must do the same.

### 1. Geometry and physical properties

| Canonical family | Recommended classification tag | Typical source-property variants that should auto-map |
|---|---|---|
| `length` | `Length` | `Length_mm`, `OverallLength`, `NominalLength`, `PartLength`, `L` |
| `width` | `Width` | `Width_mm`, `OverallWidth`, `NominalWidth`, `W` |
| `height` | `Height` | `Height_mm`, `OverallHeight`, `NominalHeight`, `H` |
| `depth` | `Depth` | `Depth_mm`, `OverallDepth` |
| `thickness` | `Thickness` | `Thickness_mm`, `WallThickness`, `Gauge` |
| `diameter` | `Diameter` | `Diameter_mm`, `OD`, `OuterDiameter`, `InnerDiameter`, `HoleDiameter` |
| `radius` | `Radius` | `Radius_mm`, `FilletRadius` |
| `area` | `Area` | `Area_mm2`, `SurfaceArea_mm2`, `CrossSectionArea`, `ProjectedArea` |
| `volume` | `Volume` | `Volume_mm3`, `Volume_cm3`, `PartVolume`, `CalcVolume`, `EnvelopeVolume` |
| `mass` | `Mass` | `Mass_g`, `Mass_kg`, `PartMass`, `ComponentMass` |
| `weight` | `Weight` | `Weight_g`, `Weight_kg`, `NetWeight`, `GrossWeight`, `ShippingWeight` |
| `density` | `Density` | `Density_g_cm3`, `MaterialDensity` |
| `center_of_mass` | `Center of Mass` | `CenterOfMass`, `CenterOfMass_mm`, `CG`, `Centroid` |
| `bounding_box` | `Bounding Box` | `BoundingBox_mm`, `BBox`, `EnvelopeSize`, `Extents`, `OverallEnvelope` |
| `envelope_dimensions` | `Envelope Dimensions` | `OverallDimensions`, `PackageDimensions`, `Envelope_mm`, `LxWxH`, `XYZSize` |
| `clearance` | `Clearance` | `Clearance_mm`, `Keepout`, `MinimumGap`, `EnvelopeClearance` |
| `tolerance` | `Tolerance` | `Tolerance`, `DimTolerance`, `GeomTolerance`, `GD&T`, `PositionalTolerance` |
| `hardness` | `Hardness` | `HardnessHV`, `HardnessHRC`, `Durometer` |
| `finish` | `Finish` | `SurfaceFinish`, `Texture`, `Ra`, `Roughness` |
| `coating` | `Coating` | `CoatingType`, `Plating`, `PaintSpec`, `SurfaceTreatment`, `FinishCode` |

### 2. Placement, assembly, and interface

| Canonical family | Recommended classification tag | Typical source-property variants that should auto-map |
|---|---|---|
| `position_coordinates` | `Placement` | `Placement`, `PositionXYZ`, `Coordinates`, `Transform`, `LocationMatrix` |
| `orientation` | `Orientation` | `Rotation`, `YawPitchRoll`, `AngularOffset`, `OrientationMatrix` |
| `reference_designator` | `Reference Designator` | `ReferenceDesignator`, `Reference Designator`, `RefDes`, `Position` |
| `find_number` | `Find Number` | `FindNumber`, `Find No`, `Item Sequence`, `ItemNumber`, `Position Number` |
| `interface_code` | `Interface Code` | `InterfaceCode`, `MountPattern`, `MatingPattern`, `ConnectorPattern` |
| `assembly_relationship` | `Assembly Relationship` | `ParentPath`, `AssemblyPath`, `OccurrencePath`, `MountingRelationship`, `UsagePath` |
| `occurrence_id` | `Occurrence Identifier` | `OccurrenceInternalName`, `OccurrenceID`, `InstanceID`, `ItemNode`, `OccurrenceLabel` |
| `object_id` | `Object Identifier` | `PartKey`, `LinkedObjectName`, `LinkedObjectId`, `ObjectID`, `ElementID` |

### 3. Identity, revision, and substitution

| Canonical family | Recommended classification tag | Typical source-property variants that should auto-map |
|---|---|---|
| `part_number` | `Part Number` | `PartNumber`, `Component PN`, `OEM Part Number`, `Internal Part Number`, `Child Item` |
| `manufacturer_part_number` | `Manufacturer Part Number` | `MPN`, `Mfr Part Number`, `Supplier Part Number`, `Vendor Part Number` |
| `customer_part_number` | `Customer Part Number` | `Customer Part Number`, `OEM PN`, `Customer Item` |
| `revision` | `Revision` | `Revision`, `Rev`, `Revision Level`, `Drawing Revision`, `Spec Revision` |
| `description` | `Description` | `Description`, `Part Description`, `Item Description`, `BOM Text`, `Line Notes` |
| `alternate_substitute` | `Alternate / Substitute` | `Alternate Item Group`, `Substitute Rule`, `Supersession`, `Interchangeability Code`, `Cross Reference` |

### 4. Material, formulation, and compliance

| Canonical family | Recommended classification tag | Typical source-property variants that should auto-map |
|---|---|---|
| `material` | `Material` | `Material`, `MaterialSpec`, `Material Grade`, `Substrate`, `Material Standard` |
| `chemistry_formulation` | `Chemistry / Formulation` | `Chemistry`, `Formulation`, `Resin`, `Adhesive`, `Alloy`, `Composition` |
| `restricted_substance` | `Restricted Substance Status` | `RoHS`, `REACH`, `SVHC`, `ELV`, `Restricted Substance`, `Compliance Flag` |
| `regulatory_classification` | `Regulatory Classification` | `Regulatory Attribute`, `Compliance Classification`, `Safety Characteristic`, `Special Characteristic` |
| `imds_material_declaration` | `IMDS / Material Declaration` | `IMDS Reference`, `Material Declaration`, `Compliance Certificate Link` |

### 5. Quantity, usage, and effectivity

| Canonical family | Recommended classification tag | Typical source-property variants that should auto-map |
|---|---|---|
| `quantity` | `Quantity` | `Quantity`, `Qty`, `QuantityInThisLine`, `RequiredQty`, `Per Assembly Ratio` |
| `unit_of_measure` | `UoM` | `UOM`, `Unit`, `Unit of Measure`, `BaseUnitOfMeasure` |
| `consumption_rule` | `Consumption Rule` | `Scrap Factor`, `Yield Factor`, `Usage Probability`, `Bulk Item Flag`, `Reference Quantity` |
| `effectivity_date` | `Date Effectivity` | `Effectivity Date`, `Effective From`, `Effective To`, `Date Effectivity` |
| `effectivity_serial` | `Serial Effectivity` | `Serial Effectivity`, `Serial Range`, `VIN Range`, `Unit Range` |
| `effectivity_lot` | `Lot Effectivity` | `Lot Effectivity`, `Lot Scope`, `Batch Scope`, `Date Code Rule` |
| `variant_configuration` | `Variant / Configuration Rule` | `Variant Code`, `Option Code`, `Configuration Rule`, `Model Year`, `Trim Code`, `Market Code` |
| `plant_applicability` | `Plant Applicability` | `Plant Applicability`, `Manufacturing Site`, `Production Site`, `Work Center/Plant Applicability` |

### 6. Sourcing and approved-source control

| Canonical family | Recommended classification tag | Typical source-property variants that should auto-map |
|---|---|---|
| `approved_supplier` | `Approved Supplier` | `Approved Supplier`, `Approved Vendor List`, `Approved Manufacturer List`, `AVL`, `AML` |
| `supplier_code` | `Supplier Code` | `Supplier Code`, `Vendor Code`, `CAGE`, `Manufacturer Code` |
| `supplier_site` | `Supplier / Manufacturing Site` | `Manufacturing Site`, `Supplier Plant`, `Assembly Site`, `Test Site`, `Fab Site` |
| `country_of_origin` | `Country of Origin` | `Country of Origin`, `Source Country`, `Manufacturing Country` |
| `qualification_status` | `Qualification Status` | `Qualification Status`, `Approved Source Status`, `Source Status`, `PPAP Status` |

### 7. Process, tooling, manufacturing, and quality-planning

| Canonical family | Recommended classification tag | Typical source-property variants that should auto-map |
|---|---|---|
| `process_reference` | `Process Spec Reference` | `Process Spec`, `Process Flow Reference`, `Production Version`, `Routing Link` |
| `tooling_identifier` | `Tooling Identifier` | `Tool ID`, `Tooling Identifier`, `Fixture ID`, `Mold`, `Die Revision` |
| `plant_line_equipment` | `Plant / Line / Equipment` | `Production Line ID`, `Work Center`, `Line`, `Equipment`, `Machine ID` |
| `control_plan_reference` | `Control Plan Reference` | `Control Plan`, `Inspection Plan`, `PFMEA Link`, `Inspection Requirement` |
| `traceability_requirement` | `Traceability Requirement` | `Traceability Code`, `Serialization Requirement`, `Lot Trace`, `Batch Trace` |

### 8. Electronics-specific families

| Canonical family | Recommended classification tag | Typical source-property variants that should auto-map |
|---|---|---|
| `package_case` | `Package / Case` | `Package`, `Case`, `Body Style`, `Case Code` |
| `footprint` | `Footprint` | `Footprint`, `Land Pattern`, `PCB Footprint`, `Padstack` |
| `electrical_value` | `Value / Rating` | `Value`, `Capacitance`, `Resistance`, `Inductance`, `Voltage Rating`, `Current Rating` |
| `temperature_grade` | `Temperature Grade` | `Temperature Grade`, `Operating Temp Range`, `AEC Grade` |
| `lifecycle_status` | `Lifecycle Status` | `Lifecycle Status`, `PCN`, `PDN`, `Obsolescence`, `NRND`, `EOL` |

### 9. Software, firmware, and calibration

| Canonical family | Recommended classification tag | Typical source-property variants that should auto-map |
|---|---|---|
| `software_calibration` | `Software / Calibration` | `Software Version`, `Firmware Version`, `Calibration ID`, `Configuration Item`, `ECU Variant Code` |
| `compatibility_matrix` | `Compatibility Matrix` | `Compatibility Matrix`, `Approved Pairing`, `Dependency Revision`, `Baseline Link` |

### 10. Packaging, labeling, and logistics

| Canonical family | Recommended classification tag | Typical source-property variants that should auto-map |
|---|---|---|
| `packaging_item` | `Packaging Item` | `Packaging PN`, `Packaging Revision`, `Packaging Item`, `Returnable Rack` |
| `label_spec` | `Label Specification` | `Label Spec`, `Barcode Format`, `Marking`, `Label Revision` |
| `quantity_per_pack` | `Quantity per Pack` | `Qty Per Pack`, `Quantity per Pack`, `Pack Quantity` |
| `handling_storage` | `Handling / Storage` | `Handling Code`, `Storage Condition`, `Shelf Life`, `Preservation Code` |

### 11. Service, deviation, concession, and emergency

| Canonical family | Recommended classification tag | Typical source-property variants that should auto-map |
|---|---|---|
| `service_applicability` | `Service Applicability` | `Service Part Link`, `Service BOM Flag`, `Service Campaign Code`, `Retrofit Kit` |
| `deviation_concession` | `Deviation / Concession` | `Deviation Number`, `Waiver Number`, `Concession Number`, `Disposition Code` |
| `approval_status` | `Approval Status` | `Approval Status`, `Release Status`, `Controlled Shipping Status` |
| `warranty_field_issue` | `Warranty / Field Issue` | `Warranty Classification`, `Recall`, `Stop-Ship`, `Field Quality` |

### 12. Construction / asset / IFC / COBie families

| Canonical family | Recommended classification tag | Typical source-property variants that should auto-map |
|---|---|---|
| `asset_identifier` | `Asset Identifier` | `Asset Tag`, `Asset ID`, `Equipment ID` |
| `ifc_guid` | `IFC GUID` | `IFC GUID`, `GUID`, `GlobalId` |
| `system_classification` | `System Classification` | `System`, `Discipline`, `IFC Class`, `System Code`, `Classification` |
| `specification_reference` | `Specification Reference` | `Spec Section`, `Specification Section`, `Submittal Reference` |
| `location_context` | `Location / Zone / Room` | `Location`, `Zone`, `Room`, `Level`, `Area`, `Space` |
| `boq_schedule` | `BoQ / Schedule Item` | `BoQ Item`, `Cost Code`, `Work Package`, `Schedule Activity` |

## Observed alias patterns from public company and platform sources

This section captures alias patterns observed in public material from leading companies and tooling ecosystems. These are not all full downloadable BOM workbooks, but they are official field vocabularies that materially improve alias coverage.

### General discrete manufacturing / PLM / ERP

Observed from SAP, Oracle Agile, and Siemens Teamcenter style material:

* `Material`
* `Plant`
* `BOM Usage`
* `Alternative BOM`
* `Change Number`
* `Engineering Change Document`
* `Base Unit`
* `BOM Header Quantity`
* `Item Node Number`
* `Find Number`
* `Ref Des`
* `Item Rev`
* `Item Description`
* `Sites`
* `BOM Notes`
* `Occurrence`
* `Variant Condition`

These reinforce the following tags:

* `Part Number`
* `Revision`
* `Quantity`
* `UoM`
* `Find Number`
* `Reference Designator`
* `Plant Applicability`
* `Variant / Configuration Rule`
* `Process Spec Reference`
* `Approval Status`

### Automotive

Observed from Magna and Toyota-style supplier-change / PPAP / process-change material:

* `Supplier Part Number`
* `OEM Part Number`
* `Revision Level`
* `PPAP Status`
* `Production Site`
* `Manufacturing Site`
* `Tooling`
* `Process Flow`
* `Control Plan`
* `PFMEA`
* `Plant`
* `Variant Code`
* `Model Year`
* `VIN Effectivity`
* `Service Part`
* `Packaging Spec`
* `Barcode`
* `Traceability`

These reinforce the following tags:

* `Manufacturer Part Number`
* `Revision`
* `Qualification Status`
* `Supplier / Manufacturing Site`
* `Tooling Identifier`
* `Process Spec Reference`
* `Control Plan Reference`
* `Plant Applicability`
* `Variant / Configuration Rule`
* `Serial Effectivity`
* `Service Applicability`
* `Label Specification`
* `Traceability Requirement`

### Electronics

Observed from Texas Instruments, Infineon, Intel, and common electronics BOM import/export patterns:

* `Reference`
* `Designator`
* `RefDes`
* `Value`
* `Tolerance`
* `Voltage`
* `Power`
* `Dielectric`
* `Manufacturer`
* `Part Number`
* `Supplier`
* `Supplier Part Number`
* `Footprint`
* `Package`
* `Case Code`
* `Temperature Grade`
* `Lifecycle Status`
* `PCN`
* `PDN`
* `Bitstream Revision`
* `Bootloader Revision`
* `Configuration Item`
* `Serial Number Rule`

These reinforce the following tags:

* `Reference Designator`
* `Value / Rating`
* `Manufacturer Part Number`
* `Approved Supplier`
* `Footprint`
* `Package / Case`
* `Temperature Grade`
* `Lifecycle Status`
* `Software / Calibration`
* `Traceability Requirement`

### Aerospace

Observed from Boeing, Crane Aerospace, Honeywell/NASA-style parts-list and supplier-change material:

* `Source Control Drawing`
* `Configuration Item`
* `Critical Characteristic`
* `Material / Process Spec`
* `Weight`
* `Balance`
* `Center of Gravity`
* `Envelope`
* `Installation Note`
* `Service Bulletin`
* `Retrofit Kit`
* `Serialized Applicability`
* `Loadable Software Part Number`
* `Block / Mod Standard`
* `Maintenance Applicability`

These reinforce the following tags:

* `Regulatory Classification`
* `Material`
* `Weight`
* `Center of Mass`
* `Bounding Box`
* `Interface Code`
* `Service Applicability`
* `Serial Effectivity`
* `Software / Calibration`
* `Compatibility Matrix`

### Defense / government contracting

Observed from DLA, DAU, and defense configuration-control material:

* `CI Reference`
* `Functional Baseline`
* `Allocated Baseline`
* `Source Control Drawing`
* `Specialty Metals Compliance`
* `Bearing Source`
* `Export Control Classification`
* `Supporting Data Package`
* `Nonconformance Number`
* `Repair Instruction`
* `Government CCB`

These reinforce the following tags:

* `Part Number`
* `Revision`
* `Approved Supplier`
* `Country of Origin`
* `Regulatory Classification`
* `Deviation / Concession`
* `Approval Status`
* `Serial Effectivity`
* `Lot Effectivity`

### Construction / built environment

Observed from Autodesk / Revit schedule and COBie / IFC-oriented field conventions:

* `Asset Tag`
* `Type Name`
* `Type Mark`
* `Model`
* `Manufacturer`
* `Serial Number`
* `Installation Date`
* `Warranty Start Date`
* `Room`
* `Zone`
* `Level`
* `System`
* `Discipline`
* `Specification Section`
* `Submittal`
* `GlobalId`
* `IFC GUID`
* `Issue Status`

These reinforce the following tags:

* `Asset Identifier`
* `Manufacturer Part Number`
* `Location / Zone / Room`
* `System Classification`
* `Specification Reference`
* `IFC GUID`
* `Approval Status`
* `Warranty / Field Issue`

### Medical devices

Public full BOMs from top-tier medical-device companies are scarce, but official service / regulatory material and product-data conventions repeatedly expose:

* `Device Model`
* `Catalog Number`
* `Lot Number`
* `Serial Number`
* `UDI / DI / PI`
* `Software Version`
* `Firmware Revision`
* `Sterilization Method`
* `Shelf Life`
* `Packaging Configuration`
* `Labeling`
* `Material`
* `Dimensions`
* `Weight`

These reinforce the following tags:

* `Part Number`
* `Serial Effectivity`
* `Lot Effectivity`
* `Software / Calibration`
* `Handling / Storage`
* `Label Specification`
* `Material`
* `Length`
* `Width`
* `Height`
* `Weight`

## Additional alias evidence from community-shared BOM ecosystems

This section broadens the source base beyond official company sites. These sources are valuable because they expose the shorthand and column names people actually exchange in BOM files.

### Shared electronics BOM ecosystems

Observed from JLCPCB, LCSC, KiCad / Altium GitHub templates, PCB assembly blogs, and public BOM examples:

* `Comment`
* `Designator`
* `Reference`
* `Customer Reference`
* `Reference Designator`
* `Footprint`
* `Package`
* `Value`
* `Tolerance`
* `Manufacturer`
* `Manufacturer Part #`
* `Mfr. #`
* `Digi-Key Part Number`
* `LCSC Part #`
* `JLCPCB Part #`
* `Vendor Part Number`
* `Quantity per board`
* `DNI`
* `DNP`
* `Do Not Install`
* `Description / Specs`

Sources:

* JLCPCB BOM guidance: https://jlcpcb.com/help/article/bill-of-materials-for-pcb-assembly
* LCSC BOM upload flow: https://www.lcsc.com/bom
* KiCad multi-BOM plugin: https://github.com/Kenneract/KiCAD-Multi-BOM-Plugin
* Altium BOM template: https://github.com/gbmhunter/Altium-Bom-Template
* PCB assembly BOM article: https://www.coloradopcbassembly.com/bom/

These community-shared patterns reinforce:

* `Reference Designator`
* `Footprint`
* `Package / Case`
* `Value / Rating`
* `Manufacturer Part Number`
* `Approved Supplier`
* `Quantity`
* `Description`
* `Approval Status`

### Shared general mechanical / manufacturing BOM ecosystems

Observed from public Excel-BOM tooling and shared assembly BOM examples:

* `PN`
* `QTY`
* `Pkg QTY`
* `Pkg Price`
* `Unit Cost`
* `Unit Weight`
* `Title`
* `Desc`
* `Supplier SKU`
* `Assembly`
* `Part`
* `Sub-Assembly`

Sources:

* PyBOM shared Excel model: https://github.com/robsiegwart/pyBOM
* BOM.js fields: https://github.com/arkham-engineering/bom

These community-shared patterns reinforce:

* `Part Number`
* `Quantity`
* `Weight`
* `Description`
* `UoM`
* `Approved Supplier`

### Shared medical-service / spare-parts ecosystems

Observed from public service manuals, parts catalogs, and shared spare-parts lists:

* `Item`
* `Part No.`
* `Part Name`
* `Qty`
* `Remark`
* `Assembly part number`
* `Model`
* `Equipment Manufacture`
* `Spare parts`
* `Catalog Number`
* `Oxygen Cell`
* `Flow Sensor`
* `Software Version`
* `Serial Number`
* `Lot Number`

Sources:

* Stryker Medical service manual parts listings: https://www.manualslib.com/manual/1905085/Stryker-Medical-2025.html
* Dräger Medical technical documentation parts catalog: https://www.manualslib.com/manual/3043930/Dr-Ger-Medical-Oxylog-3000.html
* Shared medical spare parts list: https://www.slideshare.net/slideshow/urgent-medical-spareparts-list-2014-1/37369198
* RPI medical replacement parts navigation: https://www.rpiparts.com/vnotes.htm

These community-shared patterns reinforce:

* `Part Number`
* `Description`
* `Quantity`
* `Manufacturer Part Number`
* `Serial Effectivity`
* `Lot Effectivity`
* `Software / Calibration`
* `Service Applicability`

### Shared construction / COBie / asset-data ecosystems

Observed from COBie structure references and COBie validation/help pages:

* `Facility`
* `Level`
* `Zone`
* `Space`
* `Type`
* `Component`
* `System`
* `Attribute`
* `Document`
* `Resource`
* `Package`
* `Job`
* `Event`
* `Instruction`
* `Risk`
* `TagNumber`
* `ModelNumber`
* `SerialNumber`
* `Asset Tag`

Sources:

* NIBS COBie structure and format: https://drupal.nibs.org/nbims/v3/cobie/1.4
* DAQS COBie component tag number guidance: https://help.daqs.io/DAQS/ENG/CObie/Components/COBie_Component_TagNumber/

These community-shared patterns reinforce:

* `Asset Identifier`
* `Location / Zone / Room`
* `System Classification`
* `Specification Reference`
* `Approval Status`
* `Warranty / Field Issue`

## Recommended default classification-tag vocabulary

These are the tags the UI should prefer. Source-specific field names should normalize into them automatically.

* `Part Number`
* `Manufacturer Part Number`
* `Customer Part Number`
* `Revision`
* `Description`
* `Alternate / Substitute`
* `Length`
* `Width`
* `Height`
* `Depth`
* `Thickness`
* `Diameter`
* `Radius`
* `Area`
* `Volume`
* `Mass`
* `Weight`
* `Density`
* `Center of Mass`
* `Bounding Box`
* `Envelope Dimensions`
* `Placement`
* `Orientation`
* `Reference Designator`
* `Find Number`
* `Interface Code`
* `Assembly Relationship`
* `Occurrence Identifier`
* `Object Identifier`
* `Material`
* `Chemistry / Formulation`
* `Restricted Substance Status`
* `Regulatory Classification`
* `IMDS / Material Declaration`
* `Quantity`
* `UoM`
* `Consumption Rule`
* `Date Effectivity`
* `Serial Effectivity`
* `Lot Effectivity`
* `Variant / Configuration Rule`
* `Plant Applicability`
* `Approved Supplier`
* `Supplier Code`
* `Supplier / Manufacturing Site`
* `Country of Origin`
* `Qualification Status`
* `Process Spec Reference`
* `Tooling Identifier`
* `Plant / Line / Equipment`
* `Control Plan Reference`
* `Traceability Requirement`
* `Package / Case`
* `Footprint`
* `Value / Rating`
* `Temperature Grade`
* `Lifecycle Status`
* `Software / Calibration`
* `Compatibility Matrix`
* `Packaging Item`
* `Label Specification`
* `Quantity per Pack`
* `Handling / Storage`
* `Service Applicability`
* `Deviation / Concession`
* `Approval Status`
* `Warranty / Field Issue`
* `Asset Identifier`
* `IFC GUID`
* `System Classification`
* `Specification Reference`
* `Location / Zone / Room`
* `BoQ / Schedule Item`

## Default mapping to existing taxonomy categories

These mappings use category names already present in [bom_change_taxonomy_by_industry.md](/c:/Users/yetro/Evolve%20Global%20Solutions/BOM%20Compare%20-%20Documents/Code-BOMComparevX/BOMComparevX/docs/runbooks/bom_change_taxonomy_by_industry.md).

### General discrete manufacturing

| Family group | Default taxonomy category |
|---|---|
| geometry and physical properties | `Form-fit-function substitution` |
| placement / assembly / interface | `Functional BOM structure change` when assembly behavior changes, otherwise `Form-fit-function substitution` |
| material / chemistry / compliance | `Material or specification change affecting performance or compliance` |
| quantity / usage | `Quantity or consumption change with functional effect` |
| effectivity / variant | `Variant or effectivity rule change` |
| approved source / site | `Approved source or manufacturing site change` |
| process / tooling / line / control plan | `Process or tooling change affecting producibility` |
| packaging / labeling / handling | `Packaging, preservation, or handling BOM change` |
| service / deviation / concession | `Temporary substitute or concession` or `Emergency line-stop, field, or stop-ship change` depending urgency |
| documentation-only description / metadata | `Documentation-only clarification or metadata correction` |

### Automotive

| Family group | Default taxonomy category |
|---|---|
| geometry and physical properties | `Product design or form-fit-function change` |
| placement / assembly / interface | `Product design or form-fit-function change` |
| material / chemistry / compliance | `Material, chemistry, formulation, or finish change` |
| approved source / site | `Supplier or sub-tier source change` |
| process / tooling / plant / line | `Process, line, equipment, tooling, or plant change` |
| software / firmware / calibration | `Software, calibration, or embedded configuration change` |
| packaging / labeling / traceability | `Packaging, labeling, or traceability change` |
| variant / plant / VIN / model-year effectivity | `Variant, plant, or effectivity scope change` |
| deviation / concession | `Temporary deviation, controlled shipping, or concession` |
| field / recall / stop-ship | `Emergency field, warranty, or recall-driven change` |
| documentation-only | `Documentation-only or non-substantive data change` |

### Electronics

| Family group | Default taxonomy category |
|---|---|
| part identity / alternates / lifecycle | `Component replacement or cross-reference change` |
| footprint / package / placement / geometry / impedance-related interface | `PCB footprint, layout, stack-up, or net-critical change` |
| manufacturer / approved source / site / package revision / die revision / PCN | `Product/process/site change requiring PCN` |
| material / finish / RoHS / REACH / SVHC / MSL | `Material, finish, or compliance change` |
| software / firmware / bitstream / programmed content | `Firmware, FPGA bitstream, or programmed-device revision` |
| obsolescence / end-of-life / last-time-buy | `Obsolescence, PDN, or EOL replacement` |
| test / serialization / labeling / programming file | `Test, programming, serialization, or labeling change` |
| documentation-only | `Minor advisory or document-only update` |
| temporary alternate / deviation | `Temporary shortage substitution or concession` |
| counterfeit / field-failure / stop-ship | `Emergency counterfeit, field failure, or stop-ship change` |

### Aerospace

| Family group | Default taxonomy category |
|---|---|
| part identity / configuration item / critical / safety / mission attributes | `Airworthiness, flight-safety, or mission-critical product definition change` |
| interface / connector / mount / center of gravity / envelope / maintainability | `Interface, interchangeability, maintainability, or weight/balance change` |
| material / process / special process / finish / coating | `Material, special process, or specification change` |
| approved source / source control / supplier site | `Source-controlled or qualified supplier change` |
| process / tooling / test method / facility / site | `Manufacturing process, tooling, or site change` |
| software / firmware / loadable software / configuration ID | `Software, firmware, or configuration-identification change` |
| serial / block / retrofit / maintenance applicability | `Retrofit, service bulletin, or serial/block effectivity change` |
| documentation-only | `Documentation-only or non-substantive data change` |
| waiver / deviation / concession | `Temporary waiver, deviation, or concession` |
| urgent fleet / grounding / stop-ship | `Urgent fleet issue, grounding risk, or stop-ship change` |

### Defense / government contracting

| Family group | Default taxonomy category |
|---|---|
| configuration item / baseline / contract-controlled definition | `Government-baselined configuration change` |
| approved source / process spec / effectivity / supporting data package | `Significant controlled change below highest baseline authority` |
| source control drawing / approved source / vendor site | `Source control drawing or approved-source change` |
| material source / country / specialty metals / export control | `DFARS, specialty metals, bearings, export, or controlled-source compliance change` |
| process / facility / equipment / sub-tier | `Process, facility, or sub-tier change affecting contract deliverable` |
| serial / lot / retrofit / spares applicability | `Fielded-unit serial, lot, retrofit, or spares applicability change` |
| documentation-only | `Administrative or data-package-only change` |
| deviation / waiver / concession | `Deviation, waiver, or concession` |
| nonconformance / repair / restricted acceptance | `Nonconforming material disposition with customer impact` |
| urgent mission / safety / stop-shipment | `Urgent mission, safety, or stop-shipment change` |

### Construction and built environment

| Family group | Default taxonomy category |
|---|---|
| asset / IFC / specification / geometry / performance / configuration | `Design scope or configuration change` |
| manufacturer / model / material / finish / fire rating / substitution | `Product or material substitution` |
| quantity / area / level / zone / schedule / cost-coded location change | `Quantity, takeoff, or location schedule change` |
| coordinates / clearances / system / discipline / clash context | `Coordination or clash-resolution change` |
| shop drawing / fabrication / submittal / connection detail | `Shop drawing, fabrication, or submittal change` |
| sequence / temporary works / logistics / access | `Means, methods, sequencing, or temporary works change` |
| code / permit / fire / accessibility / energy / life-safety | `Code, permitting, fire, life-safety, or regulatory change` |
| commercial-only schedule / cost / change-order fields | `Commercial change only` |
| documentation / naming / issue status metadata | `Documentation or status-only revision` |
| deviation / NCR / concession | `Temporary field deviation, NCR disposition, or concession` |
| emergency site-risk / hidden-condition fields | `Emergency unforeseen-condition or site-safety change` |

### Medical devices

There is currently no dedicated `Medical devices` taxonomy section in [bom_change_taxonomy_by_industry.md](/c:/Users/yetro/Evolve%20Global%20Solutions/BOM%20Compare%20-%20Documents/Code-BOMComparevX/BOMComparevX/docs/runbooks/bom_change_taxonomy_by_industry.md), even though the backend industry list anticipates one.

Until that taxonomy exists, the recommended default mapping is:

| Family group | Provisional default category behavior |
|---|---|
| geometry / dimensions / weight / performance fields | treat as equivalent to high-criticality product-definition change |
| material / chemistry / sterilization / shelf-life / labeling / UDI fields | treat as material / compliance / regulatory-impacting change |
| software / firmware / calibration fields | treat as high-criticality embedded-configuration change |
| lot / serial / packaging configuration / traceability fields | treat as effectivity / traceability / release-scope change |

## Important implementation examples

| Source property | Canonical family | Recommended classification tag | Expected default category |
|---|---|---|---|
| `Volume_mm3` | `volume` | `Volume` | `Product design or form-fit-function change` in Automotive |
| `Area_mm2` | `area` | `Area` | `Product design or form-fit-function change` in Automotive |
| `BoundingBox_mm` | `bounding_box` | `Bounding Box` | `Product design or form-fit-function change` in Automotive |
| `CenterOfMass` | `center_of_mass` | `Center of Mass` | `Product design or form-fit-function change` in Automotive |
| `OccurrenceInternalName` | `occurrence_id` | `Occurrence Identifier` | matching identity helper first, taxonomy only if tenant chooses to classify it |
| `Drawing/Spec Revision` | `revision` | `Revision` | `Product design or form-fit-function change` in Automotive |
| `PPAP Status` | `qualification_status` | `Qualification Status` | `Process, line, equipment, tooling, or plant change` or automotive qualification controls depending tenant policy |
| `Service Part Link` | `service_applicability` | `Service Applicability` | `Product design or form-fit-function change` or `Variant, plant, or effectivity scope change` depending taxonomy setup |
| `IFC GUID` | `ifc_guid` | `IFC GUID` | construction coordination / design-scope categories |

## Implementation recommendation

Recommended resolver behavior:

1. Normalize source property name
2. Remove recognized engineering-unit suffixes and wrappers
3. Resolve to canonical family
4. Map canonical family to default classification tag
5. Let tenant taxonomy decide which category that tag triggers
6. Keep fuzzy matching only as a guarded fallback

## Recommendation

The platform should not try to solve this class of problem only with fuzzy string matching.

The right model is:

* global canonical families
* human-readable classification tags
* tenant-editable category mapping
* unit-aware normalization for engineering fields

## Current limit

This research pass materially improved the platform baseline, but it did not produce a defensible claim of 90% real-world alias coverage across all industries. Public BOMs from top-tier companies are unevenly available by sector, and several sectors expose field vocabulary through change-control or support documentation more often than through downloadable BOM spreadsheets.

So the recommended next step is:

* use this document as the seed baseline
* implement canonical-family resolution
* instrument unmatched changed properties in production-like QA
* feed the observed misses back into this document and the semantic registry

The broader non-official search improved practical alias coverage, especially for electronics, service-parts, and construction asset data, but the same conclusion still holds: the only honest path to something close to 90% is iterative enrichment from real uploaded BOMs after the canonical-family resolver is deployed.

For the current problem, `Volume_mm3` should never depend on raw fuzzy similarity to `Volume`. It should resolve deterministically through the `volume` family.
