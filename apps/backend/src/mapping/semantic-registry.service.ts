import { Injectable } from '@nestjs/common';
import { CanonicalField, MappingProfile } from './mapping-contract';

export interface RegistryAliasEntry {
  canonicalField: CanonicalField;
  alias: string;
  language: 'en' | 'es' | 'de' | 'fr' | 'ja' | 'zh';
  domain: MappingProfile;
  weight: number;
}

export interface RegistryMatchResult {
  canonicalField: CanonicalField;
  alias: string;
  language: RegistryAliasEntry['language'];
  domain: RegistryAliasEntry['domain'];
  confidence: number;
  normalizedAlias: string;
  normalizedInput: string;
}

interface RegistrySearchOptions {
  domains?: RegistryAliasEntry['domain'][];
  languages?: RegistryAliasEntry['language'][];
}

const ALIAS_REGISTRY: RegistryAliasEntry[] = [
  { canonicalField: 'part_number', alias: 'part number', language: 'en', domain: 'electronics', weight: 1.0 },
  { canonicalField: 'part_number', alias: 'part number', language: 'en', domain: 'manufacturing', weight: 0.99 },
  { canonicalField: 'part_number', alias: 'part no', language: 'en', domain: 'manufacturing', weight: 0.98 },
  { canonicalField: 'part_number', alias: 'item number', language: 'en', domain: 'mechanical', weight: 0.95 },
  { canonicalField: 'part_number', alias: 'número de parte', language: 'es', domain: 'electronics', weight: 1.0 },
  { canonicalField: 'part_number', alias: 'teilenummer', language: 'de', domain: 'mechanical', weight: 0.97 },
  { canonicalField: 'part_number', alias: 'numéro de pièce', language: 'fr', domain: 'aerospace', weight: 0.97 },
  { canonicalField: 'part_number', alias: '部品番号', language: 'ja', domain: 'manufacturing', weight: 0.98 },
  { canonicalField: 'part_number', alias: '零件编号', language: 'zh', domain: 'electronics', weight: 0.98 },
  { canonicalField: 'description', alias: 'description', language: 'en', domain: 'manufacturing', weight: 1.0 },
  { canonicalField: 'description', alias: 'item description', language: 'en', domain: 'electronics', weight: 0.98 },
  { canonicalField: 'description', alias: 'descripción', language: 'es', domain: 'manufacturing', weight: 1.0 },
  { canonicalField: 'description', alias: 'beschreibung', language: 'de', domain: 'mechanical', weight: 0.98 },
  { canonicalField: 'description', alias: 'description pièce', language: 'fr', domain: 'aerospace', weight: 0.96 },
  { canonicalField: 'description', alias: '説明', language: 'ja', domain: 'manufacturing', weight: 0.96 },
  { canonicalField: 'description', alias: '描述', language: 'zh', domain: 'electronics', weight: 0.96 },
  { canonicalField: 'quantity', alias: 'quantity', language: 'en', domain: 'manufacturing', weight: 1.0 },
  { canonicalField: 'quantity', alias: 'qty', language: 'en', domain: 'electronics', weight: 0.99 },
  { canonicalField: 'quantity', alias: 'cantidad', language: 'es', domain: 'manufacturing', weight: 0.99 },
  { canonicalField: 'quantity', alias: 'menge', language: 'de', domain: 'mechanical', weight: 0.97 },
  { canonicalField: 'quantity', alias: 'quantité', language: 'fr', domain: 'aerospace', weight: 0.97 },
  { canonicalField: 'quantity', alias: '数量', language: 'ja', domain: 'manufacturing', weight: 0.97 },
  { canonicalField: 'quantity', alias: '数量', language: 'zh', domain: 'electronics', weight: 0.97 },
  { canonicalField: 'revision', alias: 'revision', language: 'en', domain: 'manufacturing', weight: 0.95 },
  { canonicalField: 'revision', alias: 'rev', language: 'en', domain: 'aerospace', weight: 0.93 },
  { canonicalField: 'supplier', alias: 'supplier', language: 'en', domain: 'manufacturing', weight: 0.94 },
  { canonicalField: 'supplier', alias: 'vendor', language: 'en', domain: 'electronics', weight: 0.92 },
  { canonicalField: 'cost', alias: 'unit cost', language: 'en', domain: 'manufacturing', weight: 0.92 },
  { canonicalField: 'cost', alias: 'price', language: 'en', domain: 'electronics', weight: 0.9 },
  { canonicalField: 'lifecycle_status', alias: 'lifecycle status', language: 'en', domain: 'manufacturing', weight: 0.91 },
  { canonicalField: 'lifecycle_status', alias: 'status', language: 'en', domain: 'aerospace', weight: 0.88 },
  { canonicalField: 'occurrence_id', alias: 'occurrence internal name', language: 'en', domain: 'mechanical', weight: 1.0 },
  { canonicalField: 'occurrence_id', alias: 'occurrence id', language: 'en', domain: 'plm_generic', weight: 0.99 },
  { canonicalField: 'occurrence_id', alias: 'instance id', language: 'en', domain: 'teamcenter_bom', weight: 0.98 },
  { canonicalField: 'occurrence_id', alias: 'item node', language: 'en', domain: 'sap_bom', weight: 0.95 },
  { canonicalField: 'object_id', alias: 'part key', language: 'en', domain: 'mechanical', weight: 0.99 },
  { canonicalField: 'object_id', alias: 'linked object name', language: 'en', domain: 'teamcenter_bom', weight: 0.97 },
  { canonicalField: 'object_id', alias: 'object id', language: 'en', domain: 'plm_generic', weight: 0.96 },
  { canonicalField: 'unit_of_measure', alias: 'uom', language: 'en', domain: 'manufacturing', weight: 0.98 },
  { canonicalField: 'unit_of_measure', alias: 'unit of measure', language: 'en', domain: 'erp_generic', weight: 0.97 },
  { canonicalField: 'unit_of_measure', alias: 'unit', language: 'en', domain: 'manufacturing', weight: 0.9 },
  { canonicalField: 'find_number', alias: 'find number', language: 'en', domain: 'manufacturing', weight: 0.97 },
  { canonicalField: 'find_number', alias: 'find no', language: 'en', domain: 'sap_bom', weight: 0.96 },
  { canonicalField: 'assembly', alias: 'assembly', language: 'en', domain: 'mechanical', weight: 0.95 },
  { canonicalField: 'assembly', alias: 'assy', language: 'en', domain: 'manufacturing', weight: 0.94 },
  { canonicalField: 'parent_path', alias: 'parent path', language: 'en', domain: 'plm_generic', weight: 0.96 },
  { canonicalField: 'parent_path', alias: 'assembly path', language: 'en', domain: 'teamcenter_bom', weight: 0.95 },
  { canonicalField: 'plant', alias: 'plant', language: 'en', domain: 'manufacturing', weight: 0.98 },
  { canonicalField: 'work_center', alias: 'work center', language: 'en', domain: 'manufacturing', weight: 0.96 },
  { canonicalField: 'make_buy', alias: 'make buy', language: 'en', domain: 'manufacturing', weight: 0.95 },
  { canonicalField: 'procurement_type', alias: 'procurement type', language: 'en', domain: 'sap_bom', weight: 0.96 },
  { canonicalField: 'lead_time', alias: 'lead time', language: 'en', domain: 'erp_generic', weight: 0.95 },
  { canonicalField: 'material', alias: 'material', language: 'en', domain: 'manufacturing', weight: 0.9 },
  { canonicalField: 'material_group', alias: 'material group', language: 'en', domain: 'sap_bom', weight: 0.96 },
  { canonicalField: 'routing_ref', alias: 'routing ref', language: 'en', domain: 'manufacturing', weight: 0.95 },
  { canonicalField: 'alternate_part', alias: 'alternate part', language: 'en', domain: 'manufacturing', weight: 0.95 },
  { canonicalField: 'effectivity', alias: 'effectivity', language: 'en', domain: 'aerospace', weight: 0.98 },
  { canonicalField: 'effectivity_from', alias: 'effectivity from', language: 'en', domain: 'aerospace', weight: 0.97 },
  { canonicalField: 'effectivity_to', alias: 'effectivity to', language: 'en', domain: 'aerospace', weight: 0.97 },
  { canonicalField: 'serial_range', alias: 'serial range', language: 'en', domain: 'aerospace', weight: 0.97 },
  { canonicalField: 'drawing_number', alias: 'drawing number', language: 'en', domain: 'aerospace', weight: 0.98 },
  { canonicalField: 'dash_number', alias: 'dash number', language: 'en', domain: 'aerospace', weight: 0.96 },
  { canonicalField: 'tail_number', alias: 'tail number', language: 'en', domain: 'aerospace', weight: 0.96 },
  { canonicalField: 'configuration_state', alias: 'configuration state', language: 'en', domain: 'aerospace', weight: 0.95 },
  { canonicalField: 'criticality', alias: 'criticality', language: 'en', domain: 'aerospace', weight: 0.95 },
  { canonicalField: 'airworthiness_class', alias: 'airworthiness class', language: 'en', domain: 'aerospace', weight: 0.95 },
  { canonicalField: 'approved_supplier', alias: 'approved supplier', language: 'en', domain: 'aerospace', weight: 0.95 },
  { canonicalField: 'program', alias: 'program', language: 'en', domain: 'automotive', weight: 0.96 },
  { canonicalField: 'vehicle_line', alias: 'vehicle line', language: 'en', domain: 'automotive', weight: 0.96 },
  { canonicalField: 'option_code', alias: 'option code', language: 'en', domain: 'automotive', weight: 0.95 },
  { canonicalField: 'engineering_level', alias: 'engineering level', language: 'en', domain: 'automotive', weight: 0.95 },
  { canonicalField: 'change_notice', alias: 'change notice', language: 'en', domain: 'automotive', weight: 0.95 },
  { canonicalField: 'supplier_code', alias: 'supplier code', language: 'en', domain: 'automotive', weight: 0.95 },
  { canonicalField: 'ppap_status', alias: 'ppap status', language: 'en', domain: 'automotive', weight: 0.97 },
  { canonicalField: 'tooling_status', alias: 'tooling status', language: 'en', domain: 'automotive', weight: 0.95 },
  { canonicalField: 'service_part_flag', alias: 'service part flag', language: 'en', domain: 'automotive', weight: 0.95 },
  { canonicalField: 'reference_designator', alias: 'reference designator', language: 'en', domain: 'ipc_bom', weight: 0.98 },
  { canonicalField: 'reference_designator', alias: 'refdes', language: 'en', domain: 'electronics', weight: 0.97 },
  { canonicalField: 'footprint', alias: 'footprint', language: 'en', domain: 'electronics', weight: 0.96 },
  { canonicalField: 'package', alias: 'package', language: 'en', domain: 'electronics', weight: 0.95 },
  { canonicalField: 'manufacturer', alias: 'manufacturer', language: 'en', domain: 'electronics', weight: 0.95 },
  { canonicalField: 'manufacturer_part_number', alias: 'manufacturer part number', language: 'en', domain: 'electronics', weight: 0.98 },
  { canonicalField: 'manufacturer_part_number', alias: 'mfr part number', language: 'en', domain: 'ipc_bom', weight: 0.97 },
  { canonicalField: 'customer_part_number', alias: 'customer part number', language: 'en', domain: 'manufacturing', weight: 0.95 },
  { canonicalField: 'avl', alias: 'avl', language: 'en', domain: 'electronics', weight: 0.96 },
  { canonicalField: 'compliance_status', alias: 'compliance status', language: 'en', domain: 'electronics', weight: 0.95 },
  { canonicalField: 'rohs', alias: 'rohs', language: 'en', domain: 'electronics', weight: 0.98 },
  { canonicalField: 'reach', alias: 'reach', language: 'en', domain: 'electronics', weight: 0.98 },
  { canonicalField: 'lifecycle_risk', alias: 'lifecycle risk', language: 'en', domain: 'electronics', weight: 0.95 },
  { canonicalField: 'substitute_part', alias: 'substitute part', language: 'en', domain: 'electronics', weight: 0.95 },
  { canonicalField: 'asset_id', alias: 'asset id', language: 'en', domain: 'construction', weight: 0.97 },
  { canonicalField: 'system', alias: 'system', language: 'en', domain: 'construction', weight: 0.94 },
  { canonicalField: 'discipline', alias: 'discipline', language: 'en', domain: 'construction', weight: 0.97 },
  { canonicalField: 'spec_section', alias: 'spec section', language: 'en', domain: 'construction', weight: 0.96 },
  { canonicalField: 'location', alias: 'location', language: 'en', domain: 'construction', weight: 0.95 },
  { canonicalField: 'level', alias: 'level', language: 'en', domain: 'construction', weight: 0.95 },
  { canonicalField: 'zone', alias: 'zone', language: 'en', domain: 'construction', weight: 0.95 },
  { canonicalField: 'room', alias: 'room', language: 'en', domain: 'construction', weight: 0.95 },
  { canonicalField: 'ifc_class', alias: 'ifc class', language: 'en', domain: 'ifc_schedule', weight: 0.98 },
  { canonicalField: 'cobie_attribute', alias: 'cobie attribute', language: 'en', domain: 'construction', weight: 0.97 },
  { canonicalField: 'install_phase', alias: 'install phase', language: 'en', domain: 'construction', weight: 0.95 },
  { canonicalField: 'revision_package', alias: 'revision package', language: 'en', domain: 'construction', weight: 0.95 }
];

@Injectable()
export class SemanticRegistryService {
  private readonly aliases = ALIAS_REGISTRY.map((entry) => ({
    ...entry,
    normalizedAlias: this.normalizeHeader(entry.alias)
  }));

  normalizeHeader(input: string): string {
    return input
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  findExact(input: string, options?: RegistrySearchOptions): RegistryMatchResult | null {
    const normalizedInput = this.normalizeHeader(input);
    const candidates = this.filterByOptions(options).filter((entry) => entry.normalizedAlias === normalizedInput);
    if (!candidates.length) return null;

    const best = [...candidates].sort((a, b) => b.weight - a.weight || a.alias.localeCompare(b.alias))[0];
    return {
      canonicalField: best.canonicalField,
      alias: best.alias,
      language: best.language,
      domain: best.domain,
      confidence: Math.min(1, Math.max(0, best.weight)),
      normalizedAlias: best.normalizedAlias,
      normalizedInput
    };
  }

  findFuzzy(input: string, options?: RegistrySearchOptions): RegistryMatchResult | null {
    const normalizedInput = this.normalizeHeader(input);
    if (!normalizedInput) return null;
    const candidates = this.filterByOptions(options)
      .map((entry) => {
        const similarity = this.calculateSimilarity(normalizedInput, entry.normalizedAlias);
        return {
          entry,
          confidence: Number((similarity * entry.weight).toFixed(4))
        };
      })
      .filter((candidate) => candidate.confidence >= 0.82);

    if (!candidates.length) return null;
    const best = [...candidates].sort(
      (a, b) =>
        b.confidence - a.confidence ||
        b.entry.weight - a.entry.weight ||
        a.entry.alias.localeCompare(b.entry.alias)
    )[0];

    return {
      canonicalField: best.entry.canonicalField,
      alias: best.entry.alias,
      language: best.entry.language,
      domain: best.entry.domain,
      confidence: best.confidence,
      normalizedAlias: best.entry.normalizedAlias,
      normalizedInput
    };
  }

  private filterByOptions(options?: RegistrySearchOptions) {
    return this.aliases.filter((entry) => {
      if (options?.domains?.length && !options.domains.includes(entry.domain)) return false;
      if (options?.languages?.length && !options.languages.includes(entry.language)) return false;
      return true;
    });
  }

  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    const distance = this.levenshteinDistance(a, b);
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 0;
    return Number((1 - distance / maxLen).toFixed(4));
  }

  private levenshteinDistance(a: string, b: string): number {
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

    return matrix[a.length][b.length];
  }
}
