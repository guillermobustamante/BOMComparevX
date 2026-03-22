import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseService } from '../database/database.service';
import { DiffComparableRow } from '../diff/diff-contract';
import { SemanticRegistryService } from './semantic-registry.service';
import { TaxonomyPropertyFamilyService } from './taxonomy-property-family.service';

export interface BomChangeTaxonomyCategory {
  industry: string;
  category: string;
  changeDescription: string;
  impactClass: string;
  impactCriticality: 'High' | 'Medium' | 'Low';
  triggerProperties: string[];
  internalApprovingRoles: string[];
  externalApprovingRoles: string[];
  controlPath: string;
  complianceTrigger: string;
}

export interface BomChangeTaxonomyDocument {
  industry: string;
  categories: BomChangeTaxonomyCategory[];
}

export interface BomChangePropertyMatch {
  propertyName: string;
  taxonomyProperty: string;
  mode: 'exact' | 'family' | 'semantic' | 'fuzzy';
  confidence: number;
}

export interface BomChangeClassificationResult {
  industry: string;
  categories: Array<BomChangeTaxonomyCategory & { matchedProperties: string[] }>;
  highestImpactClass: string | null;
  impactCriticality: 'High' | 'Medium' | 'Low' | null;
  internalApprovingRoles: string[];
  externalApprovingRoles: string[];
  complianceTriggers: string[];
  propertyMatches: BomChangePropertyMatch[];
}

const DEFAULT_INDUSTRY = 'General discrete manufacturing';
const AUTOMOTIVE_INDUSTRY = 'Automotive';
const TAXONOMY_SOURCE_VERSION = 'runbook-v1';
const EXACT_MATCH_CONFIDENCE = 1;
const SEMANTIC_MATCH_CONFIDENCE_FLOOR = 0.9;
const FUZZY_ACCEPT_THRESHOLD = 0.94;
const GENERIC_REVIEW_CONTROL_PATH = 'ECR -> impact review -> ECO/ECN decision -> controlled implementation if approved';

const REMOVED_REVIEW_CATEGORY_TEMPLATE: StructuralCategoryTemplate = {
  category: 'Component removed - impact review required',
  changeDescription:
    'Remove a released or comparison-relevant BOM component with insufficient evidence to prove it is low-risk, scoped-only, or safety-controlled; this is the default removal fallback when the system cannot classify further',
  impactClass: 'B',
  impactCriticality: 'Medium',
  triggerProperties: ['Parent Item', 'Child Item', 'Component PN', 'Component Revision', 'Quantity', 'UoM', 'Find Number', 'Item Sequence', 'Parent Path', 'Assembly Relationship', 'Change Number'],
  internalApprovingRoles: ['Design Engineer', 'Manufacturing Engineer', 'Quality Engineer', 'Supply Chain/Purchasing', 'Service/Aftermarket', 'Document Control'],
  externalApprovingRoles: ['Customer or supplier authority if contractually controlled'],
  controlPath: GENERIC_REVIEW_CONTROL_PATH,
  complianceTrigger: 'ISO 9001:2015 Clause 8.5.6'
};

const REMOVED_FUNCTIONAL_CATEGORY_TEMPLATE: StructuralCategoryTemplate = {
  category: 'Functional or service-affecting component removed',
  changeDescription:
    'Remove an installed component, subassembly, or service item in a way that changes product behavior, supported service structure, maintainability, or released assembly content',
  impactClass: 'A',
  impactCriticality: 'High',
  triggerProperties: ['Parent Item', 'Child Item', 'Component PN', 'Component Revision', 'Quantity', 'UoM', 'Find Number', 'Item Sequence', 'Reference Designator', 'Service BOM Flag', 'Service Part Link', 'Assembly Relationship', 'Alternate Item Group', 'Usage Probability', 'Change Number'],
  internalApprovingRoles: ['Cognizant Design Engineer', 'Product/Systems Engineer', 'Manufacturing Engineer', 'Quality Engineer', 'Service/Aftermarket', 'Change Control Board'],
  externalApprovingRoles: ['Customer design authority when customer-controlled', 'approved supplier if supplier-owned design'],
  controlPath: 'ECR -> impact analysis -> ECO/ECN -> validation -> controlled cut-in / effectivity',
  complianceTrigger: 'ISO 9001:2015 Clause 8.5.6'
};

const REMOVED_SAFETY_CATEGORY_TEMPLATE: StructuralCategoryTemplate = {
  category: 'Safety, regulatory, or critical characteristic removed',
  changeDescription:
    'Remove a component or attribute tied to safety, compliance, traceability, statutory requirements, or critical characteristics',
  impactClass: 'A',
  impactCriticality: 'High',
  triggerProperties: ['Critical Characteristic Flag', 'Safety Characteristic Flag', 'Regulatory Attribute', 'Compliance Classification', 'Inspection Requirement', 'Traceability Code', 'Serialization Requirement', 'Airworthiness Class', 'Component PN', 'Revision', 'Change Number'],
  internalApprovingRoles: ['Design Authority', 'Quality Manager', 'Regulatory/Compliance', 'Manufacturing Quality', 'Product Safety lead', 'CCB'],
  externalApprovingRoles: ['Customer', 'notified body', 'regulator', 'delegated authority if applicable'],
  controlPath: 'Highest-level ECO, validation, traceability review, and external notification where required',
  complianceTrigger: 'Machinery Directive / OSHA / customer-specific compliance control'
};

const REMOVED_VARIANT_CATEGORY_TEMPLATE: StructuralCategoryTemplate = {
  category: 'Variant or effectivity-scoped removal',
  changeDescription:
    'Remove a component only for a subset of configurations, plants, customers, dates, serial ranges, lot ranges, or model applicability',
  impactClass: 'B',
  impactCriticality: 'Medium',
  triggerProperties: ['Variant Condition', 'Option Code', 'Configuration Rule', 'Plant Applicability', 'Customer Applicability', 'Date Effectivity', 'Serial Effectivity', 'Lot Effectivity', 'Unit Range', 'Service Applicability', 'Supersession Rule', 'Change Number'],
  internalApprovingRoles: ['Product Configuration Manager', 'Design Engineer', 'ERP/PLM Administrator', 'Planning', 'Service', 'CCB'],
  externalApprovingRoles: ['Customer where scope is contract-specific'],
  controlPath: 'ECO / revision effectivity release in PLM and ERP with applicability review',
  complianceTrigger: 'ISO 10007'
};

const REMOVED_REFERENCE_CATEGORY_TEMPLATE: StructuralCategoryTemplate = {
  category: 'Reference-only, documentation, or cleanup removal',
  changeDescription:
    'Remove a note, comment, reference, metadata-only row, or non-installed/document-only entry with no substantive product-definition impact',
  impactClass: 'C',
  impactCriticality: 'Low',
  triggerProperties: ['Description', 'BOM Text', 'Line Notes', 'Reference Document', 'Drawing Reference', 'Metadata', 'Comment Field', 'Internal Category', 'Search Keywords'],
  internalApprovingRoles: ['Document Control', 'ERP/PLM data steward', 'Design Engineer for concurrence'],
  externalApprovingRoles: [],
  controlPath: 'Fast-track change or controlled metadata correction',
  complianceTrigger: 'ISO 9001:2015 Clause 7.5'
};

const ADDED_REVIEW_CATEGORY_TEMPLATE: StructuralCategoryTemplate = {
  category: 'Component added - impact review required',
  changeDescription:
    'Add a released or comparison-relevant BOM component and require review when structure exists but explicit taxonomy evidence is incomplete',
  impactClass: 'B',
  impactCriticality: 'Medium',
  triggerProperties: ['Parent Item', 'Child Item', 'Component PN', 'Component Revision', 'Quantity', 'UoM', 'Find Number', 'Item Sequence', 'Assembly Relationship', 'Change Number'],
  internalApprovingRoles: ['Design Engineer', 'Manufacturing Engineer', 'Quality Engineer', 'Supply Chain/Purchasing', 'Document Control'],
  externalApprovingRoles: ['Customer or supplier authority if contractually controlled'],
  controlPath: GENERIC_REVIEW_CONTROL_PATH,
  complianceTrigger: 'ISO 9001:2015 Clause 8.5.6'
};

const REMOVED_SAFETY_SIGNALS: StructuralSignalDefinition[] = [
  { label: 'Critical Characteristic Flag', tokens: ['critical characteristic', 'criticality', 'critical'] },
  { label: 'Safety Characteristic Flag', tokens: ['safety characteristic', 'safety critical', 'safety'] },
  { label: 'Regulatory Attribute', tokens: ['regulatory'] },
  { label: 'Compliance Classification', tokens: ['compliance classification', 'compliance status', 'compliance', 'rohs', 'reach', 'hazard', 'restricted substance'] },
  { label: 'Inspection Requirement', tokens: ['inspection requirement', 'control plan', 'sampling requirement'] },
  { label: 'Traceability Code', tokens: ['traceability'] },
  { label: 'Serialization Requirement', tokens: ['serialization', 'serialisation'] },
  { label: 'Airworthiness Class', tokens: ['airworthiness'] }
];

const REMOVED_VARIANT_SIGNALS: StructuralSignalDefinition[] = [
  { label: 'Variant Condition', tokens: ['variant condition', 'variant'] },
  { label: 'Option Code', tokens: ['option code', 'option'] },
  { label: 'Configuration Rule', tokens: ['configuration rule', 'config rule'] },
  { label: 'Plant Applicability', tokens: ['plant applicability'] },
  { label: 'Customer Applicability', tokens: ['customer applicability'] },
  { label: 'Date Effectivity', tokens: ['date effectivity', 'effectivity date'] },
  { label: 'Serial Effectivity', tokens: ['serial effectivity', 'serial range'] },
  { label: 'Lot Effectivity', tokens: ['lot effectivity', 'lot scope', 'lot'] },
  { label: 'Unit Range', tokens: ['unit range', 'model applicability', 'model year'] },
  { label: 'Service Applicability', tokens: ['service applicability'] },
  { label: 'Supersession Rule', tokens: ['supersession'] }
];

const REMOVED_FUNCTIONAL_SIGNALS: StructuralSignalDefinition[] = [
  { label: 'Parent Item', tokens: ['parent item', 'parent path'] },
  { label: 'Child Item', tokens: ['child item'] },
  { label: 'Component PN', tokens: ['component pn', 'component part number', 'part number', 'part key', 'child item'] },
  { label: 'Component Revision', tokens: ['component revision', 'revision level', 'revision'] },
  { label: 'Quantity', tokens: ['quantity', 'qty', 'consumption', 'usage probability'] },
  { label: 'UoM', tokens: ['uom', 'unit of measure', 'units'] },
  { label: 'Find Number', tokens: ['find number', 'position', 'item sequence'] },
  { label: 'Reference Designator', tokens: ['reference designator'] },
  { label: 'Service BOM Flag', tokens: ['service bom flag', 'service part flag', 'service part link'] },
  { label: 'Assembly Relationship', tokens: ['assembly relationship', 'assembly path'] },
  { label: 'Alternate Item Group', tokens: ['alternate item group', 'alternate'] }
];

const REMOVED_REFERENCE_SIGNALS: StructuralSignalDefinition[] = [
  { label: 'BOM Text', tokens: ['bom text', 'text line'] },
  { label: 'Line Notes', tokens: ['line note', 'notes'] },
  { label: 'Reference Document', tokens: ['reference document', 'document reference', 'document only'] },
  { label: 'Drawing Reference', tokens: ['drawing reference'] },
  { label: 'Metadata', tokens: ['metadata', 'search keyword'] },
  { label: 'Comment Field', tokens: ['comment'] },
  { label: 'Internal Category', tokens: ['internal category'] }
];

interface TaxonomySemanticAliasEntry {
  canonicalField: string;
  alias: string;
  confidence: number;
  industries?: string[];
}

interface ResolvedSemanticField {
  canonicalField: string;
  confidence: number;
}

interface ResolvedCategoryMatch {
  category: BomChangeTaxonomyCategory;
  taxonomyProperty: string;
  confidence: number;
  mode: BomChangePropertyMatch['mode'];
}

interface StructuralEntry {
  name: string;
  normalizedName: string;
  value: string;
  normalizedValue: string;
}

interface StructuralCategoryTemplate {
  category: string;
  changeDescription: string;
  impactClass: string;
  impactCriticality: 'High' | 'Medium' | 'Low';
  triggerProperties: string[];
  internalApprovingRoles: string[];
  externalApprovingRoles: string[];
  controlPath: string;
  complianceTrigger: string;
}

interface StructuralSignalDefinition {
  label: string;
  tokens: string[];
}

interface StructuralCategorySelection {
  template: StructuralCategoryTemplate;
  matchedProperties: string[];
}

const TAXONOMY_SEMANTIC_ALIASES: TaxonomySemanticAliasEntry[] = [
  { canonicalField: 'part_number', alias: 'component pn', confidence: 0.99, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'part_number', alias: 'component part number', confidence: 0.99, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'part_number', alias: 'component number', confidence: 0.98, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'part_number', alias: 'component', confidence: 0.92, industries: [DEFAULT_INDUSTRY] },
  { canonicalField: 'part_number', alias: 'part', confidence: 0.91, industries: [DEFAULT_INDUSTRY] },
  { canonicalField: 'part_number', alias: 'child item', confidence: 0.96, industries: [DEFAULT_INDUSTRY] },
  { canonicalField: 'part_number', alias: 'mevs part number', confidence: 0.98, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'revision', alias: 'component revision', confidence: 0.99, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'revision', alias: 'revision level', confidence: 0.99, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'revision', alias: 'mevs current revision', confidence: 0.98, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'revision', alias: 'mevs prod int revision', confidence: 0.97, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'revision', alias: 'mevs revision', confidence: 0.97, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'revision', alias: 'drawing spec revision', confidence: 0.95, industries: [AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'revision', alias: 'drawing/spec revision', confidence: 0.95, industries: [AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'quantity', alias: 'quantity in this line', confidence: 0.98, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'quantity', alias: 'quantityinthisline', confidence: 0.98, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'quantity', alias: 'comp qty', confidence: 0.97, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'quantity', alias: 'comp qty cun', confidence: 0.97, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'quantity', alias: 'aqqtym', confidence: 0.95, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'unit_of_measure', alias: 'uom', confidence: 0.99, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'unit_of_measure', alias: 'uo m', confidence: 0.97, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'unit_of_measure', alias: 'unit of measure', confidence: 0.99, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'description', alias: 'component description', confidence: 0.99, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'description', alias: 'component desc', confidence: 0.97, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'description', alias: 'comp desc', confidence: 0.97, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'object_id', alias: 'part key', confidence: 0.99, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'object_id', alias: 'partkey', confidence: 0.99, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'find_number', alias: 'find number', confidence: 0.99, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'find_number', alias: 'item sequence', confidence: 0.95, industries: [DEFAULT_INDUSTRY] },
  { canonicalField: 'customer_part_number', alias: 'oem part number', confidence: 0.99, industries: [AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'customer_part_number', alias: 'oem pn', confidence: 0.97, industries: [AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'manufacturer_part_number', alias: 'supplier part number', confidence: 0.99, industries: [AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'manufacturer_part_number', alias: 'vendor part number', confidence: 0.97, industries: [AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'ppap_status', alias: 'ppap status', confidence: 0.99, industries: [AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'ppap_status', alias: 'ppap trigger flag', confidence: 0.96, industries: [AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'ppap_status', alias: 'ppap state', confidence: 0.95, industries: [AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'tooling_status', alias: 'tooling status', confidence: 0.99, industries: [AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'tooling_status', alias: 'tool status', confidence: 0.96, industries: [AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'service_part_flag', alias: 'service bom flag', confidence: 0.98, industries: [DEFAULT_INDUSTRY, AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'service_part_flag', alias: 'service part flag', confidence: 0.98, industries: [AUTOMOTIVE_INDUSTRY] },
  { canonicalField: 'service_part_flag', alias: 'service part link', confidence: 0.93, industries: [AUTOMOTIVE_INDUSTRY] }
];

function normalizeTaxonomyValue(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class BomChangeTaxonomyService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly semanticRegistry: SemanticRegistryService = new SemanticRegistryService(),
    private readonly propertyFamilyResolver: TaxonomyPropertyFamilyService = new TaxonomyPropertyFamilyService(semanticRegistry)
  ) {}

  private readonly defaultIndustryByTenant = new Map<string, string>();
  private readonly taxonomyByTenantIndustry = new Map<string, BomChangeTaxonomyDocument>();
  private readonly seededDocuments = this.loadSeedDocuments();

  listIndustries(): string[] {
    return [...this.seededDocuments.keys()].sort((a, b) => a.localeCompare(b));
  }

  async getDefaultIndustry(tenantId: string): Promise<string> {
    const inMemory = this.defaultIndustryByTenant.get(tenantId);
    if (inMemory) return inMemory;

    if (this.databaseService.enabled) {
      const client = this.databaseService.client as any;
      const row = await client.tenantIndustrySetting?.findUnique({
        where: { tenantId }
      });
      if (row?.defaultIndustry) {
        this.defaultIndustryByTenant.set(tenantId, row.defaultIndustry);
        return row.defaultIndustry;
      }
    }

    return DEFAULT_INDUSTRY;
  }

  async setDefaultIndustry(input: {
    tenantId: string;
    defaultIndustry: string;
    actorEmail: string;
  }): Promise<{ defaultIndustry: string }> {
    const defaultIndustry = this.resolveIndustryName(input.defaultIndustry);
    this.defaultIndustryByTenant.set(input.tenantId, defaultIndustry);

    if (this.databaseService.enabled) {
      const client = this.databaseService.client as any;
      await client.tenantIndustrySetting?.upsert({
        where: { tenantId: input.tenantId },
        update: {
          defaultIndustry,
          updatedAtUtc: new Date(),
          updatedBy: input.actorEmail
        },
        create: {
          settingId: randomUUID(),
          tenantId: input.tenantId,
          defaultIndustry,
          updatedAtUtc: new Date(),
          updatedBy: input.actorEmail
        }
      });
    }

    return { defaultIndustry };
  }

  async getTaxonomy(tenantId: string, industry?: string): Promise<BomChangeTaxonomyDocument> {
    const resolvedIndustry = this.resolveIndustryName(industry || (await this.getDefaultIndustry(tenantId)));
    const key = this.tenantIndustryKey(tenantId, resolvedIndustry);
    const inMemory = this.taxonomyByTenantIndustry.get(key);
    if (inMemory) {
      return this.cloneDocument(inMemory);
    }

    if (this.databaseService.enabled) {
      const client = this.databaseService.client as any;
      const row = await client.tenantBomTaxonomy?.findUnique({
        where: {
          tenantId_industry: {
            tenantId,
            industry: resolvedIndustry
          }
        }
      });
      if (row?.taxonomyJson) {
        const parsed = this.parseTaxonomyJson(row.taxonomyJson, resolvedIndustry);
        this.taxonomyByTenantIndustry.set(key, parsed);
        return this.cloneDocument(parsed);
      }
    }

    return this.cloneDocument(this.seededDocuments.get(resolvedIndustry) || this.seededDocuments.get(DEFAULT_INDUSTRY)!);
  }

  async saveTaxonomy(input: {
    tenantId: string;
    industry: string;
    categories: BomChangeTaxonomyCategory[];
    actorEmail: string;
  }): Promise<BomChangeTaxonomyDocument> {
    const industry = this.resolveIndustryName(input.industry);
    const document: BomChangeTaxonomyDocument = {
      industry,
      categories: input.categories.map((category) => ({
        ...category,
        industry
      }))
    };
    const key = this.tenantIndustryKey(input.tenantId, industry);
    this.taxonomyByTenantIndustry.set(key, document);

    if (this.databaseService.enabled) {
      const client = this.databaseService.client as any;
      await client.tenantBomTaxonomy?.upsert({
        where: {
          tenantId_industry: {
            tenantId: input.tenantId,
            industry
          }
        },
        update: {
          taxonomyJson: JSON.stringify(document.categories),
          sourceVersion: TAXONOMY_SOURCE_VERSION,
          updatedAtUtc: new Date(),
          updatedBy: input.actorEmail
        },
        create: {
          taxonomyId: randomUUID(),
          tenantId: input.tenantId,
          industry,
          taxonomyJson: JSON.stringify(document.categories),
          sourceVersion: TAXONOMY_SOURCE_VERSION,
          updatedAtUtc: new Date(),
          updatedBy: input.actorEmail
        }
      });
    }

    return this.cloneDocument(document);
  }

  async classifyChangedProperties(
    tenantId: string,
    changedProperties: string[],
    industry?: string
  ): Promise<BomChangeClassificationResult> {
    const taxonomy = await this.getTaxonomy(tenantId, industry);
    return this.classifyPropertyNamesAgainstTaxonomy(taxonomy, changedProperties);
  }

  async classifyStructuralChange(input: {
    tenantId: string;
    changeType: 'added' | 'removed';
    row: DiffComparableRow | null;
    industry?: string;
  }): Promise<BomChangeClassificationResult> {
    const taxonomy = await this.getTaxonomy(input.tenantId, input.industry);
    const structuralEntries = this.collectStructuralEntries(input.row);
    const structuralProperties = [...new Set(structuralEntries.map((entry) => entry.name))];

    if (input.changeType === 'removed') {
      const removalSelection = this.resolveRemovedStructuralCategory(taxonomy, input.row, structuralEntries);
      return this.buildStructuralCategoryResult(taxonomy.industry, taxonomy.categories, removalSelection);
    }

    const taxonomyResult = this.classifyPropertyNamesAgainstTaxonomy(taxonomy, structuralProperties);
    if (taxonomyResult.categories.length > 0) {
      return taxonomyResult;
    }

    return this.buildStructuralCategoryResult(taxonomy.industry, taxonomy.categories, {
      template: ADDED_REVIEW_CATEGORY_TEMPLATE,
      matchedProperties: this.resolveInstalledBomLineLabels(input.row)
    });
  }

  private classifyPropertyNamesAgainstTaxonomy(
    taxonomy: BomChangeTaxonomyDocument,
    propertyNames: string[]
  ): BomChangeClassificationResult {
    const propertyMatches: BomChangePropertyMatch[] = [];
    const categories = new Map<string, BomChangeTaxonomyCategory & { matchedProperties: string[] }>();

    for (const propertyName of propertyNames) {
      for (const match of this.resolveCategoryMatches(propertyName, taxonomy)) {
        propertyMatches.push({
          propertyName,
          taxonomyProperty: match.taxonomyProperty,
          mode: match.mode,
          confidence: match.confidence
        });
        this.recordCategoryMatch(categories, match);
      }
    }

    return this.buildClassificationResult(taxonomy.industry, categories, propertyMatches);
  }

  private buildStructuralCategoryResult(
    industry: string,
    taxonomyCategories: BomChangeTaxonomyCategory[],
    selection: StructuralCategorySelection
  ): BomChangeClassificationResult {
    const category = this.resolveStructuralCategory(taxonomyCategories, industry, selection.template);
    const categories = new Map<string, BomChangeTaxonomyCategory & { matchedProperties: string[] }>();
    categories.set(category.category, {
      ...category,
      matchedProperties: selection.matchedProperties.length > 0 ? selection.matchedProperties : category.triggerProperties.slice(0, 1)
    });
    const propertyMatches = selection.matchedProperties.map((propertyName) => ({
      propertyName,
      taxonomyProperty: propertyName,
      mode: 'exact' as const,
      confidence: EXACT_MATCH_CONFIDENCE
    }));
    return this.buildClassificationResult(industry, categories, propertyMatches);
  }

  private resolveRemovedStructuralCategory(
    taxonomy: BomChangeTaxonomyDocument,
    row: DiffComparableRow | null,
    entries: StructuralEntry[]
  ): StructuralCategorySelection {
    const lowRiskSignals = this.findMatchingStructuralLabels(entries, REMOVED_REFERENCE_SIGNALS);
    const installedLineSignals = this.resolveInstalledBomLineLabels(row);
    if (lowRiskSignals.length > 0 && installedLineSignals.length === 0) {
      return {
        template: REMOVED_REFERENCE_CATEGORY_TEMPLATE,
        matchedProperties: lowRiskSignals
      };
    }

    const safetySignals = this.findMatchingStructuralLabels(entries, REMOVED_SAFETY_SIGNALS);
    if (safetySignals.length > 0) {
      return {
        template: REMOVED_SAFETY_CATEGORY_TEMPLATE,
        matchedProperties: safetySignals
      };
    }

    const variantSignals = this.findMatchingStructuralLabels(entries, REMOVED_VARIANT_SIGNALS);
    if (variantSignals.length > 0) {
      return {
        template: REMOVED_VARIANT_CATEGORY_TEMPLATE,
        matchedProperties: variantSignals
      };
    }

    const functionalSignals = [
      ...this.findMatchingStructuralLabels(entries, REMOVED_FUNCTIONAL_SIGNALS),
      ...installedLineSignals
    ];
    if (functionalSignals.length > 0) {
      return {
        template: REMOVED_FUNCTIONAL_CATEGORY_TEMPLATE,
        matchedProperties: [...new Set(functionalSignals)]
      };
    }

    const taxonomySignals = this.classifyPropertyNamesAgainstTaxonomy(
      taxonomy,
      [...new Set(entries.map((entry) => entry.name))]
    );
    const derivedMatches = [...new Set(taxonomySignals.propertyMatches.map((match) => match.taxonomyProperty))];
    return {
      template: REMOVED_REVIEW_CATEGORY_TEMPLATE,
      matchedProperties: derivedMatches.length > 0 ? derivedMatches : ['Component PN']
    };
  }

  private resolveStructuralCategory(
    taxonomyCategories: BomChangeTaxonomyCategory[],
    industry: string,
    template: StructuralCategoryTemplate
  ): BomChangeTaxonomyCategory {
    const seeded = taxonomyCategories.find((category) => category.category === template.category);
    if (seeded) {
      return {
        ...seeded,
        industry
      };
    }

    return {
      industry,
      category: template.category,
      changeDescription: template.changeDescription,
      impactClass: template.impactClass,
      impactCriticality: template.impactCriticality,
      triggerProperties: [...template.triggerProperties],
      internalApprovingRoles: [...template.internalApprovingRoles],
      externalApprovingRoles: [...template.externalApprovingRoles],
      controlPath: template.controlPath,
      complianceTrigger: template.complianceTrigger
    };
  }

  private collectStructuralEntries(row: DiffComparableRow | null): StructuralEntry[] {
    if (!row) return [];
    const entries: StructuralEntry[] = [];
    const addEntry = (name: string, value: string | number | boolean | null | undefined) => {
      if (value === null || value === undefined) return;
      const stringValue = String(value).trim();
      if (!stringValue) return;
      entries.push({
        name,
        normalizedName: this.normalizeValue(name),
        value: stringValue,
        normalizedValue: this.normalizeValue(stringValue)
      });
    };

    addEntry('Part Number', row.partNumber);
    addEntry('Revision', row.revision);
    addEntry('Description', row.description);
    addEntry('Quantity', row.quantity);
    addEntry('Supplier', row.supplier);
    addEntry('Plant', row.plant);
    addEntry('UoM', row.units);
    addEntry('Cost', row.cost);
    addEntry('Category', row.category);
    addEntry('Parent Path', row.parentPath);
    addEntry('Position', row.position);
    addEntry('Assembly Path', row.assemblyPath);
    addEntry('Find Number', row.findNumber);
    addEntry('Hierarchy Level', row.hierarchyLevel);

    for (const [name, value] of Object.entries(row.properties || {})) {
      addEntry(name, value);
    }

    return entries;
  }

  private findMatchingStructuralLabels(
    entries: StructuralEntry[],
    definitions: StructuralSignalDefinition[]
  ): string[] {
    return definitions
      .filter((definition) =>
        definition.tokens.some((token) => {
          const normalizedToken = this.normalizeValue(token);
          return entries.some(
            (entry) =>
              this.normalizedContains(entry.normalizedName, normalizedToken) ||
              this.normalizedContains(entry.normalizedValue, normalizedToken)
          );
        })
      )
      .map((definition) => definition.label);
  }

  private normalizedContains(value: string, token: string): boolean {
    return (
      value === token ||
      value.startsWith(`${token} `) ||
      value.endsWith(` ${token}`) ||
      value.includes(` ${token} `)
    );
  }

  private resolveInstalledBomLineLabels(row: DiffComparableRow | null): string[] {
    if (!row) return [];
    const labels: string[] = [];
    if (row.partNumber) labels.push('Component PN');
    if (row.revision) labels.push('Component Revision');
    if (row.quantity !== null && row.quantity !== undefined) labels.push('Quantity');
    if (row.units) labels.push('UoM');
    if (row.parentPath) labels.push('Parent Item');
    if (row.assemblyPath) labels.push('Assembly Relationship');
    if (row.findNumber || row.position) labels.push('Find Number');
    return [...new Set(labels)];
  }

  private loadSeedDocuments(): Map<string, BomChangeTaxonomyDocument> {
    const runbookPath = resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'docs',
      'runbooks',
      'bom_change_taxonomy_by_industry.md'
    );
    if (!existsSync(runbookPath)) {
      return new Map([[DEFAULT_INDUSTRY, { industry: DEFAULT_INDUSTRY, categories: [] }]]);
    }

    const content = readFileSync(runbookPath, 'utf8');
    const sections = content.split(/\r?\n## /g);
    const documents = new Map<string, BomChangeTaxonomyDocument>();

    for (const rawSection of sections) {
      const section = rawSection.startsWith('# ') ? rawSection : `## ${rawSection}`;
      const headingMatch = section.match(/^##\s+(.+)$/m);
      if (!headingMatch) continue;
      const industry = headingMatch[1].trim();
      if (!/^(General discrete manufacturing|Automotive|Electronics|Medical devices|Aerospace|Defense and government contracting|Construction and built environment)$/i.test(industry)) {
        continue;
      }

      const lines = section.split(/\r?\n/);
      const tableStart = lines.findIndex((line) => line.startsWith('| Industry | Taxonomy category |'));
      if (tableStart < 0) continue;

      const categories: BomChangeTaxonomyCategory[] = [];
      for (let index = tableStart + 2; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line.startsWith('|')) break;
        const cells = line
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim());
        if (cells.length < 9) continue;

        const roles = this.parseRoleCell(cells[6]);
        categories.push({
          industry,
          category: cells[1],
          changeDescription: cells[2],
          impactClass: cells[3],
          impactCriticality: this.normalizeCriticality(cells[4]),
          triggerProperties: cells[5]
            .split(',')
            .map((value) => value.trim())
            .filter((value) => value.length > 0),
          internalApprovingRoles: roles.internal,
          externalApprovingRoles: roles.external,
          controlPath: cells[7],
          complianceTrigger: cells[8]
        });
      }

      documents.set(industry, { industry, categories });
    }

    if (!documents.has(DEFAULT_INDUSTRY)) {
      documents.set(DEFAULT_INDUSTRY, { industry: DEFAULT_INDUSTRY, categories: [] });
    }
    return documents;
  }

  private parseRoleCell(value: string): { internal: string[]; external: string[] } {
    const internalMatch = value.match(/Internal:\s*(.*?)(?:\.\s*External:|External:|$)/i);
    const externalMatch = value.match(/External:\s*(.*)$/i);
    return {
      internal: this.splitRoleList(internalMatch?.[1] || ''),
      external: this.splitRoleList(externalMatch?.[1] || '')
    };
  }

  private splitRoleList(value: string): string[] {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  private findExactMatches(
    propertyName: string,
    categories: BomChangeTaxonomyCategory[]
  ): ResolvedCategoryMatch[] {
    const normalizedProperty = this.normalizeValue(propertyName);
    return categories.flatMap((category) =>
      category.triggerProperties
        .filter((triggerProperty) => this.normalizeValue(triggerProperty) === normalizedProperty)
        .map((triggerProperty) => ({
          category,
          taxonomyProperty: triggerProperty,
          confidence: EXACT_MATCH_CONFIDENCE,
          mode: 'exact'
        }))
    );
  }

  private findSemanticMatches(
    propertyName: string,
    categories: BomChangeTaxonomyCategory[],
    industry: string
  ): ResolvedCategoryMatch[] {
    const resolvedProperty = this.resolveSemanticField(propertyName, industry);
    if (!resolvedProperty || resolvedProperty.confidence < SEMANTIC_MATCH_CONFIDENCE_FLOOR) {
      return [];
    }

    return categories.flatMap((category) =>
      category.triggerProperties.flatMap((triggerProperty) => {
        const resolvedTrigger = this.resolveSemanticField(triggerProperty, industry);
        if (!resolvedTrigger || resolvedTrigger.confidence < SEMANTIC_MATCH_CONFIDENCE_FLOOR) {
          return [];
        }
        if (resolvedTrigger.canonicalField !== resolvedProperty.canonicalField) {
          return [];
        }

        return [{
          category,
          taxonomyProperty: triggerProperty,
          confidence: Number(Math.min(resolvedProperty.confidence, resolvedTrigger.confidence).toFixed(4)),
          mode: 'semantic'
        }];
      })
    );
  }

  private findPropertyFamilyMatches(
    propertyName: string,
    categories: BomChangeTaxonomyCategory[]
  ): ResolvedCategoryMatch[] {
    const resolvedProperty = this.propertyFamilyResolver.resolve(propertyName);
    if (!resolvedProperty) {
      return [];
    }

    return categories.flatMap((category) =>
      category.triggerProperties.flatMap((triggerProperty) => {
        const resolvedTrigger = this.propertyFamilyResolver.resolve(triggerProperty);
        if (!resolvedTrigger) {
          return [];
        }
        if (resolvedTrigger.familyId !== resolvedProperty.familyId) {
          return [];
        }

        return [{
          category,
          taxonomyProperty: triggerProperty,
          confidence: Number(Math.min(resolvedProperty.confidence, resolvedTrigger.confidence).toFixed(4)),
          mode: 'family'
        }];
      })
    );
  }

  private findBestFuzzyMatch(
    propertyName: string,
    categories: BomChangeTaxonomyCategory[]
  ): ResolvedCategoryMatch | null {
    const normalizedProperty = this.normalizeValue(propertyName);
    if (!normalizedProperty) return null;

    const candidates = categories.flatMap((category) =>
      category.triggerProperties.map((triggerProperty) => ({
        category,
        taxonomyProperty: triggerProperty,
        confidence: this.calculateSimilarity(normalizedProperty, this.normalizeValue(triggerProperty))
      }))
    );
    const viable = candidates.filter((candidate) => candidate.confidence >= FUZZY_ACCEPT_THRESHOLD);
    if (!viable.length) return null;
    const best = viable.sort(
      (a, b) =>
        b.confidence - a.confidence ||
        this.impactCriticalityRank(b.category.impactCriticality) - this.impactCriticalityRank(a.category.impactCriticality) ||
        a.category.category.localeCompare(b.category.category)
    )[0];
    return {
      ...best,
      mode: 'fuzzy'
    };
  }

  private resolveCategoryMatches(
    propertyName: string,
    taxonomy: BomChangeTaxonomyDocument
  ): ResolvedCategoryMatch[] {
    const exactMatches = this.findExactMatches(propertyName, taxonomy.categories);
    if (exactMatches.length > 0) {
      return exactMatches;
    }

    const familyMatches = this.findPropertyFamilyMatches(propertyName, taxonomy.categories);
    if (familyMatches.length > 0) {
      return familyMatches;
    }

    const semanticMatches = this.findSemanticMatches(propertyName, taxonomy.categories, taxonomy.industry);
    if (semanticMatches.length > 0) {
      return semanticMatches;
    }

    const fuzzyMatch = this.findBestFuzzyMatch(propertyName, taxonomy.categories);
    if (!fuzzyMatch || fuzzyMatch.confidence < FUZZY_ACCEPT_THRESHOLD) {
      return [];
    }

    return [fuzzyMatch];
  }

  private recordCategoryMatch(
    categories: Map<string, BomChangeTaxonomyCategory & { matchedProperties: string[] }>,
    match: ResolvedCategoryMatch
  ): void {
    const existing = categories.get(match.category.category) || { ...match.category, matchedProperties: [] };
    existing.matchedProperties = [...new Set([...existing.matchedProperties, match.taxonomyProperty])];
    categories.set(match.category.category, existing);
  }

  private buildClassificationResult(
    industry: string,
    categories: Map<string, BomChangeTaxonomyCategory & { matchedProperties: string[] }>,
    propertyMatches: BomChangePropertyMatch[]
  ): BomChangeClassificationResult {
    const resolvedCategories = [...categories.values()].sort(
      (a, b) =>
        this.impactCriticalityRank(b.impactCriticality) - this.impactCriticalityRank(a.impactCriticality) ||
        a.category.localeCompare(b.category)
    );

    return {
      industry,
      categories: resolvedCategories,
      highestImpactClass: resolvedCategories[0]?.impactClass || null,
      impactCriticality: resolvedCategories[0]?.impactCriticality || null,
      internalApprovingRoles: this.uniqueFlat(resolvedCategories.map((category) => category.internalApprovingRoles)),
      externalApprovingRoles: this.uniqueFlat(resolvedCategories.map((category) => category.externalApprovingRoles)),
      complianceTriggers: this.uniqueFlat(resolvedCategories.map((category) => [category.complianceTrigger])),
      propertyMatches
    };
  }

  private resolveSemanticField(value: string, industry: string): ResolvedSemanticField | null {
    const normalizedValue = this.normalizeValue(value);
    if (!normalizedValue) return null;

    const aliasExact = TAXONOMY_SEMANTIC_ALIASES
      .filter((entry) => this.aliasAppliesToIndustry(entry, industry) && this.normalizeValue(entry.alias) === normalizedValue)
      .sort((a, b) => b.confidence - a.confidence || a.alias.localeCompare(b.alias))[0];
    if (aliasExact) {
      return {
        canonicalField: aliasExact.canonicalField,
        confidence: aliasExact.confidence
      };
    }

    const registryExact = this.semanticRegistry.findExact(value);
    if (registryExact) {
      return {
        canonicalField: registryExact.canonicalField,
        confidence: registryExact.confidence
      };
    }

    const aliasFuzzy = TAXONOMY_SEMANTIC_ALIASES
      .filter((entry) => this.aliasAppliesToIndustry(entry, industry))
      .map((entry) => ({
        canonicalField: entry.canonicalField,
        confidence: Number((this.calculateSimilarity(normalizedValue, this.normalizeValue(entry.alias)) * entry.confidence).toFixed(4))
      }))
      .filter((entry) => entry.confidence >= SEMANTIC_MATCH_CONFIDENCE_FLOOR)
      .sort((a, b) => b.confidence - a.confidence || a.canonicalField.localeCompare(b.canonicalField))[0];
    if (aliasFuzzy) {
      return aliasFuzzy;
    }

    const registryFuzzy = this.semanticRegistry.findFuzzy(value);
    if (registryFuzzy && registryFuzzy.confidence >= SEMANTIC_MATCH_CONFIDENCE_FLOOR) {
      return {
        canonicalField: registryFuzzy.canonicalField,
        confidence: registryFuzzy.confidence
      };
    }

    return null;
  }

  private aliasAppliesToIndustry(entry: TaxonomySemanticAliasEntry, industry: string): boolean {
    return !entry.industries?.length || entry.industries.includes(industry);
  }

  private calculateSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) {
      return Number((Math.min(a.length, b.length) / Math.max(a.length, b.length)).toFixed(4));
    }

    const aTokens = new Set(a.split(' ').filter((token) => token.length > 0));
    const bTokens = new Set(b.split(' ').filter((token) => token.length > 0));
    const overlap = [...aTokens].filter((token) => bTokens.has(token)).length;
    const tokenScore = overlap / Math.max(aTokens.size, bTokens.size, 1);
    const editScore = this.levenshteinSimilarity(a, b);
    return Number(((tokenScore * 0.65) + (editScore * 0.35)).toFixed(4));
  }

  private levenshteinSimilarity(a: string, b: string): number {
    const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
      Array.from({ length: b.length + 1 }, () => 0)
    );
    for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return Number((1 - matrix[a.length][b.length] / maxLen).toFixed(4));
  }

  private normalizeCriticality(value: string): 'High' | 'Medium' | 'Low' {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'high') return 'High';
    if (normalized === 'medium') return 'Medium';
    return 'Low';
  }

  private normalizeValue(value: string): string {
    return normalizeTaxonomyValue(value);
  }

  private resolveIndustryName(value: string): string {
    const normalized = this.normalizeValue(value);
    const exact = [...this.seededDocuments.keys()].find((industry) => this.normalizeValue(industry) === normalized);
    return exact || DEFAULT_INDUSTRY;
  }

  private impactCriticalityRank(value: 'High' | 'Medium' | 'Low'): number {
    if (value === 'High') return 3;
    if (value === 'Medium') return 2;
    return 1;
  }

  private uniqueFlat(values: string[][]): string[] {
    return [...new Set(values.flat().map((value) => value.trim()).filter((value) => value.length > 0))];
  }

  private tenantIndustryKey(tenantId: string, industry: string): string {
    return `${tenantId}::${industry}`;
  }

  private cloneDocument(document: BomChangeTaxonomyDocument): BomChangeTaxonomyDocument {
    return {
      industry: document.industry,
      categories: document.categories.map((category) => ({
        ...category,
        triggerProperties: [...category.triggerProperties],
        internalApprovingRoles: [...category.internalApprovingRoles],
        externalApprovingRoles: [...category.externalApprovingRoles]
      }))
    };
  }

  private parseTaxonomyJson(raw: string, industry: string): BomChangeTaxonomyDocument {
    try {
      const parsed = JSON.parse(raw) as BomChangeTaxonomyCategory[];
      return {
        industry,
        categories: Array.isArray(parsed)
          ? parsed.map((category) => ({
              ...category,
              industry
            }))
          : []
      };
    } catch {
      return {
        industry,
        categories: []
      };
    }
  }
}
