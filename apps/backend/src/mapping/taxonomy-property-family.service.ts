import { Injectable } from '@nestjs/common';
import { SemanticRegistryService } from './semantic-registry.service';

export interface TaxonomyPropertyFamilyResolution {
  familyId: string;
  classificationTag: string;
  matchedAlias: string;
  normalizedInput: string;
  normalizedBase: string;
  confidence: number;
  strategy: 'exact' | 'unit_normalized';
}

interface TaxonomyPropertyFamilyEntry {
  familyId: string;
  classificationTag: string;
  aliases: string[];
}

const UNIT_TOKENS = new Set([
  'mm',
  'mm2',
  'mm3',
  'cm',
  'cm2',
  'cm3',
  'm',
  'm2',
  'm3',
  'in',
  'in2',
  'in3',
  'ft',
  'ft2',
  'ft3',
  'kg',
  'g',
  'lb',
  'lbs',
  'oz',
  'deg',
  'rad',
  'v',
  'a',
  'w',
  'kw',
  'nm',
  'n',
  'pa',
  'bar',
  'psi',
  'c',
  'f',
  'k'
]);

const QUALIFIER_TOKENS = new Set([
  'calc',
  'calculated',
  'computed',
  'nominal',
  'actual',
  'measured',
  'derived',
  'target',
  'estimated',
  'ref'
]);

const TAXONOMY_PROPERTY_FAMILY_ENTRIES: TaxonomyPropertyFamilyEntry[] = [
  { familyId: 'part_number', classificationTag: 'Part Number', aliases: ['part number', 'part no', 'pn', 'component pn', 'component number', 'item number', 'internal part number', 'part no.', 'part number item', 'catalog number', 'assembly part number', 'customer item'] },
  { familyId: 'parent_item', classificationTag: 'Parent Item', aliases: ['parent item', 'next higher assembly', 'parent assembly', 'parent part'] },
  { familyId: 'child_item', classificationTag: 'Child Item', aliases: ['child item', 'component item', 'child component'] },
  { familyId: 'manufacturer_part_number', classificationTag: 'Manufacturer Part Number', aliases: ['manufacturer part number', 'mfr part number', 'mfr #', 'manufacturer part #', 'mfr. #', 'supplier part number', 'vendor part number', 'mpn', 'digikey part number', 'digikey pn', 'lcsc part #', 'jlcpcb part #', 'supplier sku', 'vendor pn', 'mfr pn', 'manufacturer pn'] },
  { familyId: 'customer_part_number', classificationTag: 'Customer Part Number', aliases: ['customer part number', 'oem part number', 'oem pn', 'oem part #'] },
  { familyId: 'revision', classificationTag: 'Revision', aliases: ['revision', 'rev', 'revision level', 'drawing revision', 'drawing spec revision', 'drawing/spec revision', 'spec revision', 'item rev', 'drawing spec rev', 'spec rev'] },
  { familyId: 'description', classificationTag: 'Description', aliases: ['description', 'part description', 'item description', 'component description', 'comp desc', 'bom text', 'line notes', 'comment', 'part name', 'title', 'description / specs', 'remark', 'part name / description', 'bom notes', 'desc'] },
  { familyId: 'quantity', classificationTag: 'Quantity', aliases: ['quantity', 'qty', 'quantity in this line', 'quantity per board', 'qty per board', 'required qty', 'required quantity', 'per assembly ratio', 'qty/board', 'bom header quantity'] },
  { familyId: 'unit_of_measure', classificationTag: 'UoM', aliases: ['uom', 'unit of measure', 'unit', 'base unit', 'base unit of measure'] },
  { familyId: 'find_number', classificationTag: 'Find Number', aliases: ['find number', 'find no', 'item sequence', 'position number'] },
  { familyId: 'reference_designator', classificationTag: 'Reference Designator', aliases: ['reference designator', 'refdes', 'ref des', 'designator', 'customer reference', 'reference'] },
  { familyId: 'bom_line_type', classificationTag: 'BOM Line Type', aliases: ['bom line type', 'line type', 'item category', 'bom usage', 'alternative bom'] },
  { familyId: 'phantom_flag', classificationTag: 'Phantom Flag', aliases: ['phantom flag', 'phantom item'] },
  { familyId: 'optionality_flag', classificationTag: 'Optionality Flag', aliases: ['optionality flag', 'optional flag', 'optional item', 'dni', 'dnp', 'do not install'] },
  { familyId: 'assembly_relationship', classificationTag: 'Assembly Relationship', aliases: ['assembly relationship', 'parent path', 'assembly path', 'occurrence path', 'next higher assembly', 'assy relationship', 'mounting relationship', 'usage path', 'sub assembly', 'sub-assembly'] },
  { familyId: 'occurrence_id', classificationTag: 'Occurrence Identifier', aliases: ['occurrence identifier', 'occurrence internal name', 'occurrence id', 'instance id', 'item node', 'item node number', 'occurrence label', 'occurrence'] },
  { familyId: 'object_id', classificationTag: 'Object Identifier', aliases: ['object identifier', 'part key', 'linked object name', 'linked object id', 'object id', 'element id', 'partkey'] },
  { familyId: 'alternate_substitute', classificationTag: 'Alternate / Substitute', aliases: ['alternate item group', 'approved alternate group', 'alternate part', 'substitute part', 'temporary alternate pn', 'substitute rule', 'supersession', 'cross reference', 'interchangeability code'] },
  { familyId: 'usage_probability', classificationTag: 'Usage Probability', aliases: ['usage probability', 'probability', 'usage percent'] },
  { familyId: 'change_notice', classificationTag: 'Change Number', aliases: ['change number', 'change notice', 'ecn', 'eco', 'ecr', 'pcn number', 'engineering change document', 'service bulletin'] },
  { familyId: 'variant_configuration', classificationTag: 'Variant / Configuration Rule', aliases: ['variant condition', 'variant code', 'configuration rule', 'option code', 'model year', 'trim code', 'market code'] },
  { familyId: 'date_effectivity', classificationTag: 'Date Effectivity', aliases: ['date effectivity', 'effectivity date', 'effective from', 'effective to', 'date effective', 'installation date', 'warranty start date'] },
  { familyId: 'serial_effectivity', classificationTag: 'Serial Effectivity', aliases: ['serial effectivity', 'serial range', 'serialized applicability', 'vin effectivity', 'vin range', 'unit range', 'serial number', 'serial scope'] },
  { familyId: 'lot_effectivity', classificationTag: 'Lot Effectivity', aliases: ['lot effectivity', 'lot scope', 'batch scope', 'lot number', 'lot code rule', 'batch trace', 'lot trace', 'batch number', 'date code rule'] },
  { familyId: 'service_applicability', classificationTag: 'Service Applicability', aliases: ['service applicability', 'service part link', 'service part flag', 'service bom flag', 'service campaign code', 'retrofit kit', 'maintenance applicability', 'spare parts'] },
  { familyId: 'country_of_origin', classificationTag: 'Country of Origin', aliases: ['country of origin', 'source country', 'manufacturing country'] },
  { familyId: 'length', classificationTag: 'Length', aliases: ['length', 'overall length', 'nominal length', 'part length'] },
  { familyId: 'width', classificationTag: 'Width', aliases: ['width', 'overall width', 'nominal width'] },
  { familyId: 'height', classificationTag: 'Height', aliases: ['height', 'overall height', 'nominal height'] },
  { familyId: 'depth', classificationTag: 'Depth', aliases: ['depth', 'overall depth'] },
  { familyId: 'thickness', classificationTag: 'Thickness', aliases: ['thickness', 'wall thickness', 'gauge'] },
  { familyId: 'diameter', classificationTag: 'Diameter', aliases: ['diameter', 'outer diameter', 'inner diameter', 'hole diameter', 'od'] },
  { familyId: 'radius', classificationTag: 'Radius', aliases: ['radius', 'fillet radius'] },
  { familyId: 'area', classificationTag: 'Area', aliases: ['area', 'surface area', 'cross section area', 'projected area'] },
  { familyId: 'volume', classificationTag: 'Volume', aliases: ['volume', 'part volume', 'envelope volume'] },
  { familyId: 'mass', classificationTag: 'Mass', aliases: ['mass', 'part mass', 'component mass'] },
  { familyId: 'weight', classificationTag: 'Weight', aliases: ['weight', 'net weight', 'gross weight', 'shipping weight', 'unit weight', 'balance'] },
  { familyId: 'density', classificationTag: 'Density', aliases: ['density', 'material density', 'density g cm3'] },
  { familyId: 'center_of_mass', classificationTag: 'Center of Mass', aliases: ['center of mass', 'center of gravity', 'cg', 'centroid', 'balance attribute'] },
  { familyId: 'bounding_box', classificationTag: 'Bounding Box', aliases: ['bounding box', 'bbox', 'envelope size', 'overall envelope', 'extents', 'envelope'] },
  { familyId: 'envelope_dimensions', classificationTag: 'Envelope Dimensions', aliases: ['envelope dimensions', 'overall dimensions', 'package dimensions', 'l x w x h', 'xyz size', 'dimensions'] },
  { familyId: 'placement', classificationTag: 'Placement', aliases: ['placement', 'placement coordinates', 'position coordinates', 'coordinates', 'transform', 'location matrix', 'position xyz'] },
  { familyId: 'orientation', classificationTag: 'Orientation', aliases: ['orientation', 'rotation', 'yaw pitch roll', 'angular offset', 'orientation matrix'] },
  { familyId: 'material', classificationTag: 'Material', aliases: ['material', 'material spec', 'material grade', 'material standard', 'substance', 'substrate', 'material / process spec'] },
  { familyId: 'chemistry_formulation', classificationTag: 'Chemistry / Formulation', aliases: ['chemistry', 'formulation', 'resin', 'adhesive', 'alloy', 'composition', 'mold compound'] },
  { familyId: 'finish', classificationTag: 'Finish', aliases: ['finish', 'surface finish', 'roughness', 'texture', 'ra'] },
  { familyId: 'coating', classificationTag: 'Coating', aliases: ['coating', 'plating', 'paint spec', 'surface treatment', 'finish plating', 'coating type', 'finish code'] },
  { familyId: 'hardness', classificationTag: 'Hardness', aliases: ['hardness', 'hardness hrc', 'hardness hv', 'durometer'] },
  { familyId: 'interface_code', classificationTag: 'Interface Code', aliases: ['interface code', 'mounting pattern', 'mount pattern', 'connector pattern', 'connector pinout', 'mating pattern'] },
  { familyId: 'clearance', classificationTag: 'Clearance', aliases: ['clearance', 'clearance rule', 'minimum gap', 'keepout', 'keep out', 'envelope clearance'] },
  { familyId: 'tolerance', classificationTag: 'Tolerance', aliases: ['tolerance', 'dim tolerance', 'geometric tolerance', 'gd&t', 'positional tolerance'] },
  { familyId: 'restricted_substance', classificationTag: 'Restricted Substance Status', aliases: ['restricted substance status', 'rohs', 'rohs flag', 'reach', 'reach flag', 'svhc status', 'halogen free flag', 'specialty metals compliance'] },
  { familyId: 'regulatory_classification', classificationTag: 'Regulatory Classification', aliases: ['regulatory classification', 'regulatory attribute', 'safety characteristic', 'special characteristic', 'critical characteristic', 'export control classification', 'source control drawing'] },
  { familyId: 'compliance_status', classificationTag: 'Compliance Status', aliases: ['compliance status', 'compliance flag', 'security compliance flag', 'hazard class'] },
  { familyId: 'imds_material_declaration', classificationTag: 'IMDS / Material Declaration', aliases: ['imds reference', 'material declaration', 'compliance cert link', 'ipc 1752'] },
  { familyId: 'approved_supplier', classificationTag: 'Approved Supplier', aliases: ['approved supplier', 'approved source', 'approved manufacturer list', 'approved vendor list', 'approved source list', 'avl', 'aml', 'bearing source'] },
  { familyId: 'supplier_code', classificationTag: 'Supplier Code', aliases: ['supplier code', 'vendor code', 'manufacturer code', 'cage'] },
  { familyId: 'plant_applicability', classificationTag: 'Plant Applicability', aliases: ['plant applicability', 'plant', 'site applicability', 'sites', 'work center plant applicability'] },
  { familyId: 'manufacturing_site', classificationTag: 'Supplier / Manufacturing Site', aliases: ['manufacturing site', 'supplier plant', 'production site', 'assembly site', 'test site', 'wafer fab site', 'manufacturing location', 'fab site'] },
  { familyId: 'qualification_status', classificationTag: 'Qualification Status', aliases: ['qualification status', 'source status', 'approved source status', 'ppap status', 'ppap trigger flag'] },
  { familyId: 'consumption_rule', classificationTag: 'Consumption Rule', aliases: ['consumption rule', 'scrap factor', 'yield factor', 'bulk item flag', 'reference quantity'] },
  { familyId: 'process_spec', classificationTag: 'Process Spec Reference', aliases: ['process spec', 'process flow reference', 'process change id', 'routing link', 'production version', 'test method revision', 'routing ref', 'logistics plan reference', 'installation method note', 'process flow', 'repair instruction'] },
  { familyId: 'tooling_identifier', classificationTag: 'Tooling Identifier', aliases: ['tooling identifier', 'tool id', 'tooling status', 'tool status', 'fixture id', 'mold', 'die revision', 'tooling'] },
  { familyId: 'plant_line_equipment', classificationTag: 'Plant / Line / Equipment', aliases: ['production line id', 'work center', 'line', 'equipment', 'machine id', 'production line', 'line move'] },
  { familyId: 'control_plan', classificationTag: 'Control Plan Reference', aliases: ['control plan', 'control plan reference', 'pfmea', 'pfmea link', 'inspection requirement', 'inspection plan'] },
  { familyId: 'traceability_requirement', classificationTag: 'Traceability Requirement', aliases: ['traceability requirement', 'traceability code', 'serial number rule', 'serialization requirement', 'lot code rule', 'tag number rule', 'udi', 'udi di pi', 'traceability'] },
  { familyId: 'manufacturer', classificationTag: 'Manufacturer', aliases: ['manufacturer', 'equipment manufacture', 'mfr'] },
  { familyId: 'product_model', classificationTag: 'Product Model', aliases: ['product model', 'model', 'model number', 'type name', 'type mark', 'device model'] },
  { familyId: 'package_case', classificationTag: 'Package / Case', aliases: ['package', 'package case', 'package/case code', 'case code', 'body style', 'case', 'packaging spec'] },
  { familyId: 'footprint', classificationTag: 'Footprint', aliases: ['footprint', 'land pattern', 'pcb footprint', 'padstack'] },
  { familyId: 'value_rating', classificationTag: 'Value / Rating', aliases: ['value', 'value/rating', 'voltage rating', 'current rating', 'power rating', 'electrical rating', 'pressure rating', 'flow rate', 'torque', 'capacitance', 'resistance', 'inductance', 'voltage', 'power', 'dielectric'] },
  { familyId: 'temperature_grade', classificationTag: 'Temperature Grade', aliases: ['temperature grade', 'operating temp range', 'temp rating', 'max temp', 'aec grade'] },
  { familyId: 'lifecycle_status', classificationTag: 'Lifecycle Status', aliases: ['lifecycle status', 'eol date', 'last time buy date', 'last time ship date', 'lifecycle risk', 'obsolescence', 'nrnd', 'pdn', 'pcn'] },
  { familyId: 'software_calibration', classificationTag: 'Software / Calibration', aliases: ['software version', 'firmware version', 'firmware revision', 'calibration id', 'configuration item', 'bitstream revision', 'bootloader revision', 'loadable software part number', 'ecu variant code'] },
  { familyId: 'compatibility_matrix', classificationTag: 'Compatibility Matrix', aliases: ['compatibility matrix', 'firmware compatibility link', 'baseline link', 'dependency revision', 'approved pairing', 'ci reference', 'functional baseline', 'allocated baseline', 'block mod standard', 'block / mod standard'] },
  { familyId: 'packaging_item', classificationTag: 'Packaging Item', aliases: ['packaging item', 'packaging pn', 'packaging revision', 'returnable rack'] },
  { familyId: 'label_spec', classificationTag: 'Label Specification', aliases: ['label spec', 'barcode format', 'packaging label', 'marking label', 'labeling', 'barcode', 'marking', 'label revision'] },
  { familyId: 'quantity_per_pack', classificationTag: 'Quantity per Pack', aliases: ['quantity per pack', 'qty per pack', 'pack quantity', 'pkg qty'] },
  { familyId: 'handling_storage', classificationTag: 'Handling / Storage', aliases: ['handling code', 'storage condition', 'shelf life', 'preservation code', 'sterilization method', 'packaging configuration'] },
  { familyId: 'deviation_concession', classificationTag: 'Deviation / Concession', aliases: ['deviation number', 'waiver number', 'concession number', 'controlled shipping status', 'ncr number', 'nonconformance number', 'disposition code'] },
  { familyId: 'approval_status', classificationTag: 'Approval Status', aliases: ['approval status', 'release status', 'issue status', 'government ccb'] },
  { familyId: 'warranty_field_issue', classificationTag: 'Warranty / Field Issue', aliases: ['warranty classification', 'field quality', 'recall', 'stop ship', 'stop shipment', 'stop-ship'] },
  { familyId: 'asset_identifier', classificationTag: 'Asset Identifier', aliases: ['asset identifier', 'asset id', 'asset tag', 'tag number', 'tagnumber', 'equipment id'] },
  { familyId: 'ifc_guid', classificationTag: 'IFC GUID', aliases: ['ifc guid', 'guid', 'globalid', 'global id'] },
  { familyId: 'system_classification', classificationTag: 'System Classification', aliases: ['system classification', 'system', 'discipline', 'ifc class', 'system code', 'classification'] },
  { familyId: 'specification_reference', classificationTag: 'Specification Reference', aliases: ['specification reference', 'specification section', 'spec section', 'submittal reference', 'document reference', 'shop drawing revision', 'fabrication drawing ref', 'data item reference', 'submittal', 'supporting data package'] },
  { familyId: 'location_context', classificationTag: 'Location / Zone / Room', aliases: ['location', 'zone', 'room', 'level', 'space', 'facility', 'access zone'] },
  { familyId: 'boq_schedule', classificationTag: 'BoQ / Schedule Item', aliases: ['boq item', 'cost code', 'work package', 'schedule activity', 'procurement package', 'change order number', 'contingency code', 'rfi', 'directive reference'] },
  { familyId: 'performance_requirement', classificationTag: 'Performance Requirement', aliases: ['performance requirement', 'function class', 'acoustic rating', 'structural class', 'fire rating', 'energy environmental attribute', 'occupancy class', 'code classification'] }
];

@Injectable()
export class TaxonomyPropertyFamilyService {
  private readonly familyEntries = TAXONOMY_PROPERTY_FAMILY_ENTRIES.flatMap((entry) =>
    [...new Set([entry.classificationTag, ...entry.aliases])].map((alias) => ({
      ...entry,
      alias,
      normalizedAlias: this.normalizeFamilyValue(alias, false)
    }))
  );

  constructor(private readonly semanticRegistry: SemanticRegistryService = new SemanticRegistryService()) {}

  resolve(value: string): TaxonomyPropertyFamilyResolution | null {
    const normalizedInput = this.normalizeLoose(value);
    if (!normalizedInput) return null;

    const exact = this.findByNormalizedAlias(normalizedInput);
    if (exact) {
      return {
        familyId: exact.familyId,
        classificationTag: exact.classificationTag,
        matchedAlias: exact.alias,
        normalizedInput,
        normalizedBase: normalizedInput,
        confidence: 0.99,
        strategy: 'exact'
      };
    }

    const normalizedBase = this.normalizeFamilyValue(value);
    if (!normalizedBase) return null;

    const baseMatch = this.findByNormalizedAlias(normalizedBase);
    if (!baseMatch) return null;

    return {
      familyId: baseMatch.familyId,
      classificationTag: baseMatch.classificationTag,
      matchedAlias: baseMatch.alias,
      normalizedInput,
      normalizedBase,
      confidence: normalizedInput === normalizedBase ? 0.98 : 0.97,
      strategy: normalizedInput === normalizedBase ? 'exact' : 'unit_normalized'
    };
  }

  private findByNormalizedAlias(value: string) {
    return this.familyEntries.find((entry) => entry.normalizedAlias === value) || null;
  }

  private normalizeLoose(value: string): string {
    return this.semanticRegistry.normalizeHeader(value.replace(/([a-z0-9])([A-Z])/g, '$1 $2'));
  }

  private normalizeFamilyValue(value: string, stripUnits = true): string {
    const normalized = this.normalizeLoose(value);
    if (!normalized) return '';

    const tokens = normalized.split(' ').filter((token) => token.length > 0);
    const trimmed = tokens.filter((token) => !QUALIFIER_TOKENS.has(token));
    if (!stripUnits) {
      return trimmed.join(' ');
    }

    while (trimmed.length > 1 && UNIT_TOKENS.has(trimmed[trimmed.length - 1])) {
      trimmed.pop();
    }
    return trimmed.join(' ');
  }
}
