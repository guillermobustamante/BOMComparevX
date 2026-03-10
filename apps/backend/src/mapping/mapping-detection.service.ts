import { Injectable } from '@nestjs/common';
import { CanonicalField, DetectedColumnCandidate, MappingProfile, resolveReviewState } from './mapping-contract';
import { LearnedMappingAlias } from './mapping-alias-learning.service';
import { RegistryAliasEntry, SemanticRegistryService } from './semantic-registry.service';

export interface DetectionContext {
  domains?: RegistryAliasEntry['domain'][];
  profiles?: MappingProfile[];
  languages?: RegistryAliasEntry['language'][];
  sampleRows?: Array<Record<string, string | number | null | undefined>>;
  tenantAliases?: LearnedMappingAlias[];
}

interface Pass1Result {
  candidates: DetectedColumnCandidate[];
  unmappedColumns: string[];
}

interface InferenceResult {
  canonicalField: CanonicalField;
  confidence: number;
  reasons: string[];
  negativeSignals: string[];
}

@Injectable()
export class MappingDetectionService {
  constructor(private readonly semanticRegistry: SemanticRegistryService) {}

  detectColumns(headers: string[], context?: DetectionContext): DetectedColumnCandidate[] {
    const pass1 = this.detectPass1(headers, context);
    if (!pass1.unmappedColumns.length) {
      return pass1.candidates;
    }
    const heuristicCandidates = this.detectPass2Heuristics(
      pass1.unmappedColumns,
      headers,
      context?.sampleRows,
      this.resolveProfiles(context)
    );
    return [...pass1.candidates, ...heuristicCandidates].sort(
      (a, b) => headers.indexOf(a.sourceColumn) - headers.indexOf(b.sourceColumn)
    );
  }

  detectPass1(headers: string[], context?: DetectionContext): Pass1Result {
    const candidates: DetectedColumnCandidate[] = [];
    const unmappedColumns: string[] = [];
    const profiles = this.resolveProfiles(context);

    for (const sourceColumn of headers) {
      const tenantMatch = this.findTenantAlias(sourceColumn, context?.tenantAliases);
      if (tenantMatch) {
        candidates.push({
          sourceColumn,
          canonicalField: tenantMatch.canonicalField,
          strategy: 'TENANT_PACK',
          confidence: tenantMatch.confidence,
          reviewState: resolveReviewState(tenantMatch.confidence),
          evidence: {
            matchedAlias: sourceColumn,
            profile: profiles[0],
            reasons: ['tenant_confirmation'],
            negativeSignals: []
          }
        });
        continue;
      }

      const exact = this.semanticRegistry.findExact(sourceColumn, {
        domains: profiles,
        languages: context?.languages
      });
      if (exact) {
        candidates.push({
          sourceColumn,
          canonicalField: exact.canonicalField,
          strategy: 'REGISTRY_EXACT',
          confidence: exact.confidence,
          reviewState: resolveReviewState(exact.confidence),
          evidence: {
            matchedAlias: exact.alias,
            language: exact.language,
            domain: exact.domain,
            profile: exact.domain,
            reasons: this.registryReasons('exact_alias', exact.domain, profiles),
            negativeSignals: []
          }
        });
        continue;
      }

      const fuzzy = this.semanticRegistry.findFuzzy(sourceColumn, {
        domains: profiles,
        languages: context?.languages
      });
      if (fuzzy) {
        candidates.push({
          sourceColumn,
          canonicalField: fuzzy.canonicalField,
          strategy: 'REGISTRY_FUZZY',
          confidence: fuzzy.confidence,
          reviewState: resolveReviewState(fuzzy.confidence),
          evidence: {
            matchedAlias: fuzzy.alias,
            language: fuzzy.language,
            domain: fuzzy.domain,
            profile: fuzzy.domain,
            reasons: this.registryReasons('fuzzy_alias', fuzzy.domain, profiles),
            negativeSignals: []
          }
        });
        continue;
      }

      unmappedColumns.push(sourceColumn);
    }

    return { candidates, unmappedColumns };
  }

  detectPass2Heuristics(
    unmappedColumns: string[],
    allHeaders: string[],
    sampleRows?: Array<Record<string, string | number | null | undefined>>,
    profiles: MappingProfile[] = []
  ): DetectedColumnCandidate[] {
    return unmappedColumns.map((sourceColumn) => {
      const normalized = this.semanticRegistry.normalizeHeader(sourceColumn);
      const index = allHeaders.indexOf(sourceColumn);
      const inferred = this.inferByHeuristics(normalized, sourceColumn, index, allHeaders, sampleRows, profiles);

      if (!inferred) {
        return {
          sourceColumn,
          canonicalField: null,
          strategy: 'HEURISTIC',
          confidence: 0.5,
          reviewState: resolveReviewState(0.5),
          evidence: {
            matchedAlias: 'unresolved',
            profile: profiles[0],
            reasons: ['unresolved'],
            negativeSignals: []
          }
        };
      }

      const confidence = Number(Math.min(0.89, Math.max(0.5, inferred.confidence)).toFixed(4));
      return {
        sourceColumn,
        canonicalField: confidence < 0.7 ? null : inferred.canonicalField,
        strategy: 'HEURISTIC',
        confidence,
        reviewState: resolveReviewState(confidence),
        evidence: {
          matchedAlias: inferred.reasons[0] || 'heuristic',
          profile: profiles[0],
          reasons: inferred.reasons,
          negativeSignals: inferred.negativeSignals
        }
      };
    });
  }

  private inferByHeuristics(
    normalizedHeader: string,
    sourceColumn: string,
    index: number,
    allHeaders: string[],
    sampleRows: Array<Record<string, string | number | null | undefined>> | undefined,
    profiles: MappingProfile[]
  ): InferenceResult | null {
    const baseMatches: Array<{ field: CanonicalField; regex: RegExp; score: number; reason: string }> = [
      { field: 'part_number', regex: /\b(part|item|material)\b.*\b(no|number|num)\b|\bpn\b|\bp n\b/, score: 0.78, reason: 'regex-part-number' },
      { field: 'description', regex: /\b(desc|description|details|name)\b/, score: 0.76, reason: 'regex-description' },
      { field: 'quantity', regex: /\b(qty|quantity|count|needed)\b/, score: 0.78, reason: 'regex-quantity' },
      { field: 'revision', regex: /\b(rev|revision|version)\b/, score: 0.75, reason: 'regex-revision' },
      { field: 'supplier', regex: /\b(supplier|vendor)\b/, score: 0.74, reason: 'regex-supplier' },
      { field: 'cost', regex: /\b(cost|price|unit cost)\b/, score: 0.74, reason: 'regex-cost' },
      { field: 'lifecycle_status', regex: /\b(lifecycle|status|phase)\b/, score: 0.72, reason: 'regex-lifecycle' },
      { field: 'unit_of_measure', regex: /\b(uom|u\/m|unit of measure|units?)\b/, score: 0.8, reason: 'regex-unit-of-measure' },
      { field: 'find_number', regex: /\b(find number|find no|findnum)\b/, score: 0.82, reason: 'regex-find-number' },
      { field: 'assembly', regex: /\b(assembly|assy)\b/, score: 0.76, reason: 'regex-assembly' },
      { field: 'parent_path', regex: /\b(parent path|assembly path|bom path)\b/, score: 0.82, reason: 'regex-parent-path' },
      { field: 'plant', regex: /\bplant\b/, score: 0.84, reason: 'regex-plant' },
      { field: 'make_buy', regex: /\b(make buy|make\/buy|make or buy)\b/, score: 0.84, reason: 'regex-make-buy' },
      { field: 'material', regex: /\bmaterial\b/, score: 0.74, reason: 'regex-material' },
      { field: 'finish', regex: /\bfinish|coating|surface\b/, score: 0.76, reason: 'regex-finish' },
      { field: 'weight', regex: /\b(weight|mass)\b/, score: 0.8, reason: 'regex-weight' },
      { field: 'effectivity', regex: /\b(effectivity|effective|validity)\b/, score: 0.79, reason: 'regex-effectivity' },
      { field: 'effectivity_from', regex: /\b(effectivity from|effective from|valid from|start effectivity)\b/, score: 0.83, reason: 'regex-effectivity-from' },
      { field: 'effectivity_to', regex: /\b(effectivity to|effective to|valid to|end effectivity)\b/, score: 0.83, reason: 'regex-effectivity-to' },
      { field: 'serial_range', regex: /\b(serial range|serials|serial applicability)\b/, score: 0.84, reason: 'regex-serial-range' },
      { field: 'drawing_number', regex: /\b(drawing number|drawing no|dwg number|dwg no)\b/, score: 0.85, reason: 'regex-drawing-number' },
      { field: 'manufacturer_part_number', regex: /\b(mfr part number|manufacturer part number|mpn)\b/, score: 0.86, reason: 'regex-manufacturer-part-number' },
      { field: 'customer_part_number', regex: /\b(customer part number|customer pn|customer item)\b/, score: 0.84, reason: 'regex-customer-part-number' },
      { field: 'compliance_status', regex: /\b(compliance status|regulatory status)\b/, score: 0.84, reason: 'regex-compliance-status' },
      { field: 'hazard_class', regex: /\b(hazard class|hazmat|dangerous goods)\b/, score: 0.84, reason: 'regex-hazard-class' },
      { field: 'location', regex: /\b(location|loc)\b/, score: 0.75, reason: 'regex-location' },
      { field: 'discipline', regex: /\b(discipline|trade)\b/, score: 0.84, reason: 'regex-discipline' },
      { field: 'work_center', regex: /\b(work center|workcentre)\b/, score: 0.84, reason: 'regex-work-center' },
      { field: 'procurement_type', regex: /\b(procurement type|proc type)\b/, score: 0.84, reason: 'regex-procurement-type' },
      { field: 'lead_time', regex: /\b(lead time|leadtime)\b/, score: 0.84, reason: 'regex-lead-time' },
      { field: 'material_group', regex: /\b(material group)\b/, score: 0.84, reason: 'regex-material-group' },
      { field: 'routing_ref', regex: /\b(routing ref|routing)\b/, score: 0.82, reason: 'regex-routing-ref' },
      { field: 'alternate_part', regex: /\b(alternate part|alternate pn|alt part)\b/, score: 0.82, reason: 'regex-alternate-part' },
      { field: 'program', regex: /\b(program|programme)\b/, score: 0.83, reason: 'regex-program' },
      { field: 'vehicle_line', regex: /\b(vehicle line|model line)\b/, score: 0.84, reason: 'regex-vehicle-line' },
      { field: 'option_code', regex: /\b(option code|option)\b/, score: 0.83, reason: 'regex-option-code' },
      { field: 'engineering_level', regex: /\b(engineering level|eng level)\b/, score: 0.84, reason: 'regex-engineering-level' },
      { field: 'change_notice', regex: /\b(change notice|ecn|ecr)\b/, score: 0.83, reason: 'regex-change-notice' },
      { field: 'supplier_code', regex: /\b(supplier code|vendor code)\b/, score: 0.84, reason: 'regex-supplier-code' },
      { field: 'ppap_status', regex: /\b(ppap status|ppap)\b/, score: 0.87, reason: 'regex-ppap-status' },
      { field: 'tooling_status', regex: /\b(tooling status|tool status)\b/, score: 0.84, reason: 'regex-tooling-status' },
      { field: 'service_part_flag', regex: /\b(service part flag|service part)\b/, score: 0.83, reason: 'regex-service-part-flag' },
      { field: 'dash_number', regex: /\b(dash number|dash no)\b/, score: 0.83, reason: 'regex-dash-number' },
      { field: 'tail_number', regex: /\b(tail number|tail no)\b/, score: 0.84, reason: 'regex-tail-number' },
      { field: 'lot', regex: /\b(lot|batch)\b/, score: 0.78, reason: 'regex-lot' },
      { field: 'configuration_state', regex: /\b(configuration state|config state)\b/, score: 0.84, reason: 'regex-configuration-state' },
      { field: 'criticality', regex: /\b(criticality|critical)\b/, score: 0.82, reason: 'regex-criticality' },
      { field: 'airworthiness_class', regex: /\b(airworthiness class)\b/, score: 0.86, reason: 'regex-airworthiness-class' },
      { field: 'approved_supplier', regex: /\b(approved supplier|approved vendor)\b/, score: 0.84, reason: 'regex-approved-supplier' },
      { field: 'reference_designator', regex: /\b(reference designator|ref des|refdes)\b/, score: 0.87, reason: 'regex-reference-designator' },
      { field: 'footprint', regex: /\b(footprint|land pattern)\b/, score: 0.84, reason: 'regex-footprint' },
      { field: 'package', regex: /\b(package|pkg)\b/, score: 0.82, reason: 'regex-package' },
      { field: 'manufacturer', regex: /\b(manufacturer|mfr)\b/, score: 0.82, reason: 'regex-manufacturer' },
      { field: 'avl', regex: /\b(avl|approved vendor list)\b/, score: 0.86, reason: 'regex-avl' },
      { field: 'rohs', regex: /\b(rohs)\b/, score: 0.87, reason: 'regex-rohs' },
      { field: 'reach', regex: /\b(reach)\b/, score: 0.87, reason: 'regex-reach' },
      { field: 'lifecycle_risk', regex: /\b(lifecycle risk|eol risk)\b/, score: 0.84, reason: 'regex-lifecycle-risk' },
      { field: 'substitute_part', regex: /\b(substitute part|alt component)\b/, score: 0.83, reason: 'regex-substitute-part' },
      { field: 'asset_id', regex: /\b(asset id|asset number)\b/, score: 0.85, reason: 'regex-asset-id' },
      { field: 'system', regex: /\b(system)\b/, score: 0.76, reason: 'regex-system' },
      { field: 'spec_section', regex: /\b(spec section|specification section)\b/, score: 0.85, reason: 'regex-spec-section' },
      { field: 'level', regex: /\b(level|floor)\b/, score: 0.84, reason: 'regex-level' },
      { field: 'zone', regex: /\b(zone)\b/, score: 0.84, reason: 'regex-zone' },
      { field: 'room', regex: /\b(room)\b/, score: 0.84, reason: 'regex-room' },
      { field: 'ifc_class', regex: /\b(ifc class|ifc)\b/, score: 0.87, reason: 'regex-ifc-class' },
      { field: 'cobie_attribute', regex: /\b(cobie attribute|cobie)\b/, score: 0.87, reason: 'regex-cobie-attribute' },
      { field: 'install_phase', regex: /\b(install phase|installation phase)\b/, score: 0.84, reason: 'regex-install-phase' },
      { field: 'revision_package', regex: /\b(revision package|package revision)\b/, score: 0.84, reason: 'regex-revision-package' }
    ];

    let best: InferenceResult | null = null;
    for (const pattern of baseMatches) {
      if (!pattern.regex.test(normalizedHeader)) continue;

      let confidence = pattern.score;
      const reasons = [pattern.reason];
      const negativeSignals: string[] = [];

      confidence += this.positionBoost(pattern.field, index, allHeaders, reasons);
      confidence += this.profileBoost(pattern.field, profiles, reasons);
      confidence += this.sampleValueBoost(pattern.field, sourceColumn, sampleRows, reasons);

      const penalties = this.negativeRulePenalty(
        pattern.field,
        normalizedHeader,
        sourceColumn,
        sampleRows,
        profiles,
        negativeSignals
      );
      confidence -= penalties;

      if (profiles.length > 0) {
        reasons.push('industry_template');
      }

      const candidate = {
        canonicalField: pattern.field,
        confidence: Number(confidence.toFixed(4)),
        reasons,
        negativeSignals
      };
      if (!best || candidate.confidence > best.confidence) best = candidate;
    }

    return best;
  }

  private positionBoost(
    field: CanonicalField,
    index: number,
    allHeaders: string[],
    reasons: string[]
  ): number {
    const previous = this.semanticRegistry.normalizeHeader(allHeaders[index - 1] || '');
    const next = this.semanticRegistry.normalizeHeader(allHeaders[index + 1] || '');
    let boost = 0;

    if (field === 'part_number' && index === 0) {
      boost += 0.05;
      reasons.push('position_pattern');
    }
    if (field === 'description' && index === 1) {
      boost += 0.04;
      reasons.push('position_pattern');
    }
    if (field === 'quantity' && /\b(uom|unit)\b/.test(next)) {
      boost += 0.03;
      reasons.push('neighbor_quantity_unit_pair');
    }
    if (field === 'unit_of_measure' && /\b(qty|quantity|count|needed)\b/.test(previous)) {
      boost += 0.05;
      reasons.push('neighbor_quantity_unit_pair');
    }
    if ((field === 'assembly' || field === 'parent_path') && /\b(level|parent|hierarchy)\b/.test(previous + ' ' + next)) {
      boost += 0.03;
      reasons.push('hierarchy_context');
    }
    if (field === 'find_number' && /\b(position|seq|sequence|line)\b/.test(previous + ' ' + next)) {
      boost += 0.03;
      reasons.push('position_pattern');
    }

    return boost;
  }

  private profileBoost(field: CanonicalField, profiles: MappingProfile[], reasons: string[]): number {
    if (!profiles.length) return 0;
    let boost = 0;
    const groupedProfiles = new Set(profiles);

    if (groupedProfiles.has('manufacturing') || groupedProfiles.has('sap_bom') || groupedProfiles.has('erp_generic')) {
      if (['plant', 'work_center', 'unit_of_measure', 'make_buy', 'procurement_type', 'lead_time', 'material_group', 'routing_ref', 'alternate_part'].includes(field)) {
        boost += 0.05;
      }
    }

    if (groupedProfiles.has('automotive')) {
      if (['program', 'vehicle_line', 'option_code', 'engineering_level', 'change_notice', 'supplier_code', 'ppap_status', 'tooling_status', 'service_part_flag'].includes(field)) {
        boost += 0.07;
      }
    }

    if (groupedProfiles.has('aerospace')) {
      if (['drawing_number', 'dash_number', 'effectivity', 'effectivity_from', 'effectivity_to', 'tail_number', 'serial_range', 'lot', 'configuration_state', 'criticality', 'airworthiness_class', 'approved_supplier'].includes(field)) {
        boost += 0.07;
      }
    }

    if (groupedProfiles.has('electronics') || groupedProfiles.has('ipc_bom')) {
      if (['reference_designator', 'footprint', 'package', 'manufacturer', 'manufacturer_part_number', 'avl', 'compliance_status', 'rohs', 'reach', 'lifecycle_risk', 'substitute_part'].includes(field)) {
        boost += 0.07;
      }
    }

    if (groupedProfiles.has('construction') || groupedProfiles.has('ifc_schedule')) {
      if (['asset_id', 'system', 'discipline', 'spec_section', 'location', 'level', 'zone', 'room', 'ifc_class', 'cobie_attribute', 'install_phase', 'revision_package'].includes(field)) {
        boost += 0.07;
      }
    }

    if (boost > 0) {
      reasons.push('industry_template');
    }
    return boost;
  }

  private sampleValueBoost(
    field: CanonicalField,
    sourceColumn: string,
    sampleRows: Array<Record<string, string | number | null | undefined>> | undefined,
    reasons: string[]
  ): number {
    if (!sampleRows?.length) return 0;
    const values = sampleRows
      .map((row) => row[sourceColumn])
      .filter((value): value is string | number => value !== null && value !== undefined)
      .slice(0, 10);
    if (!values.length) return 0;

    const asStrings = values.map((value) => String(value).trim()).filter((value) => value.length > 0);
    if (!asStrings.length) return 0;

    const numericRatio = asStrings.filter((value) => /^-?\d+(\.\d+)?$/.test(value)).length / asStrings.length;
    const add = (amount: number, reason: string): number => {
      reasons.push(reason);
      return amount;
    };

    if (field === 'quantity' && numericRatio >= 0.8) return add(0.08, 'value_pattern_numeric');
    if (field === 'cost' && numericRatio >= 0.8) return add(0.06, 'value_pattern_numeric');
    if (field === 'weight' && numericRatio >= 0.8) return add(0.06, 'value_pattern_numeric');
    if (field === 'revision' && asStrings.some((value) => /^rev?\s*[-_.]?\s*[a-z0-9]+$/i.test(value))) return add(0.06, 'value_pattern_revision');
    if (field === 'part_number' && asStrings.some((value) => /^[a-z0-9][a-z0-9-_.]{2,}$/i.test(value))) return add(0.05, 'value_pattern_part_number');
    if (field === 'unit_of_measure' && asStrings.some((value) => /^(ea|each|pcs|pc|kg|g|lb|mm|cm|m|in|ft)$/i.test(value))) return add(0.09, 'value_pattern_unit');
    if ((field === 'effectivity_from' || field === 'effectivity_to') && asStrings.some((value) => /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(value))) return add(0.08, 'value_pattern_date');
    if (field === 'serial_range' && asStrings.some((value) => /^[a-z0-9]+[-:][a-z0-9]+$/i.test(value))) return add(0.08, 'value_pattern_serial_range');
    if (field === 'reference_designator' && asStrings.some((value) => /^[a-z]{1,3}\d+([,;]\s*[a-z]{1,3}\d+)*$/i.test(value))) return add(0.1, 'value_pattern_reference_designator');
    if (field === 'package' && asStrings.some((value) => /^(0402|0603|0805|qfn|bga|sot|soic|dip)/i.test(value))) return add(0.08, 'value_pattern_package');
    if (field === 'location' && asStrings.some((value) => /^(area|zone|room|lvl|level)\b/i.test(value))) return add(0.05, 'value_pattern_location');
    if (field === 'discipline' && asStrings.some((value) => /^(arch|mech|mep|elec|civil|struct)/i.test(value))) return add(0.07, 'value_pattern_discipline');
    if (field === 'compliance_status' && asStrings.some((value) => /^(compliant|non[- ]compliant|pending)$/i.test(value))) return add(0.06, 'value_pattern_compliance');
    if (field === 'rohs' && asStrings.some((value) => /^(yes|no|compliant|exempt)$/i.test(value))) return add(0.06, 'value_pattern_compliance');
    if (field === 'reach' && asStrings.some((value) => /^(yes|no|compliant|exempt)$/i.test(value))) return add(0.06, 'value_pattern_compliance');

    return 0;
  }

  private negativeRulePenalty(
    field: CanonicalField,
    normalizedHeader: string,
    sourceColumn: string,
    sampleRows: Array<Record<string, string | number | null | undefined>> | undefined,
    profiles: MappingProfile[],
    negativeSignals: string[]
  ): number {
    let penalty = 0;

    if (
      field === 'quantity' &&
      /\b(line|item|index|seq|sequence|find|position)\b/.test(normalizedHeader)
    ) {
      penalty += 0.25;
      negativeSignals.push('negative_rule_line_number_vs_quantity');
    }

    if (field === 'quantity' && this.looksSequential(sampleRows, sourceColumn)) {
      penalty += 0.2;
      negativeSignals.push('negative_rule_sequential_numeric_values');
    }

    if (
      field === 'lifecycle_status' &&
      profiles.some((profile) => profile === 'construction' || profile === 'ifc_schedule') &&
      normalizedHeader === 'status' &&
      this.looksLikeWorkflowState(sampleRows, sourceColumn)
    ) {
      penalty += 0.35;
      negativeSignals.push('negative_rule_construction_workflow_status');
    }

    return penalty;
  }

  private looksSequential(
    sampleRows: Array<Record<string, string | number | null | undefined>> | undefined,
    sourceColumn: string
  ): boolean {
    if (!sampleRows?.length) return false;
    const values = sampleRows
      .map((row) => row[sourceColumn])
      .filter((value): value is string | number => value !== null && value !== undefined)
      .slice(0, 8)
      .map((value) => Number(value));

    if (values.length < 3 || values.some((value) => Number.isNaN(value))) return false;
    const deltas = values.slice(1).map((value, idx) => value - values[idx]);
    return deltas.every((delta) => delta === 1 || delta === 10);
  }

  private looksLikeWorkflowState(
    sampleRows: Array<Record<string, string | number | null | undefined>> | undefined,
    sourceColumn: string
  ): boolean {
    if (!sampleRows?.length) return false;
    const values = sampleRows
      .map((row) => row[sourceColumn])
      .filter((value): value is string | number => value !== null && value !== undefined)
      .slice(0, 8)
      .map((value) => String(value).trim().toLowerCase());

    if (!values.length) return false;
    const workflowTokens = new Set(['open', 'closed', 'approved', 'in progress', 'issued', 'for review', 'wip']);
    const ratio = values.filter((value) => workflowTokens.has(value)).length / values.length;
    return ratio >= 0.5;
  }

  private resolveProfiles(context?: DetectionContext): MappingProfile[] {
    const profiles = [...(context?.profiles || []), ...(context?.domains || [])];
    return [...new Set(profiles)] as MappingProfile[];
  }

  private findTenantAlias(
    sourceColumn: string,
    tenantAliases: LearnedMappingAlias[] | undefined
  ): { canonicalField: string; confidence: number } | null {
    if (!tenantAliases?.length) return null;
    const normalized = this.semanticRegistry.normalizeHeader(sourceColumn);
    const candidates = tenantAliases.filter((alias) => alias.normalizedSourceColumn === normalized);
    if (!candidates.length) return null;
    const best = [...candidates].sort(
      (a, b) => b.confirmations - a.confirmations || a.canonicalField.localeCompare(b.canonicalField)
    )[0];
    const confidence = best.confirmations >= 10 ? 0.96 : best.confirmations >= 3 ? 0.93 : 0.86;
    return {
      canonicalField: best.canonicalField,
      confidence
    };
  }

  private registryReasons(baseReason: string, matchedProfile: MappingProfile, activeProfiles: MappingProfile[]): string[] {
    const reasons = [baseReason];
    if (activeProfiles.includes(matchedProfile)) {
      reasons.push('industry_template');
    }
    return reasons;
  }
}
