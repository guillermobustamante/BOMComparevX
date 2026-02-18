import { Injectable } from '@nestjs/common';
import { CanonicalField, DetectedColumnCandidate, resolveReviewState } from './mapping-contract';
import { RegistryAliasEntry, SemanticRegistryService } from './semantic-registry.service';

interface DetectionContext {
  domains?: RegistryAliasEntry['domain'][];
  languages?: RegistryAliasEntry['language'][];
  sampleRows?: Array<Record<string, string | number | null | undefined>>;
}

interface Pass1Result {
  candidates: DetectedColumnCandidate[];
  unmappedColumns: string[];
}

@Injectable()
export class MappingDetectionService {
  constructor(private readonly semanticRegistry: SemanticRegistryService) {}

  detectColumns(headers: string[], context?: DetectionContext): DetectedColumnCandidate[] {
    const pass1 = this.detectPass1(headers, context);
    if (!pass1.unmappedColumns.length) {
      return pass1.candidates;
    }
    const heuristicCandidates = this.detectPass2Heuristics(pass1.unmappedColumns, headers, context?.sampleRows);
    return [...pass1.candidates, ...heuristicCandidates].sort(
      (a, b) => headers.indexOf(a.sourceColumn) - headers.indexOf(b.sourceColumn)
    );
  }

  detectPass1(headers: string[], context?: DetectionContext): Pass1Result {
    const candidates: DetectedColumnCandidate[] = [];
    const unmappedColumns: string[] = [];

    for (const sourceColumn of headers) {
      const exact = this.semanticRegistry.findExact(sourceColumn, {
        domains: context?.domains,
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
            domain: exact.domain
          }
        });
        continue;
      }

      const fuzzy = this.semanticRegistry.findFuzzy(sourceColumn, {
        domains: context?.domains,
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
            domain: fuzzy.domain
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
    sampleRows?: Array<Record<string, string | number | null | undefined>>
  ): DetectedColumnCandidate[] {
    return unmappedColumns.map((sourceColumn) => {
      const normalized = this.semanticRegistry.normalizeHeader(sourceColumn);
      const index = allHeaders.indexOf(sourceColumn);
      const inferred = this.inferByHeuristics(normalized, sourceColumn, index, sampleRows);

      if (!inferred) {
        return {
          sourceColumn,
          canonicalField: null,
          strategy: 'HEURISTIC',
          confidence: 0.5,
          reviewState: resolveReviewState(0.5),
          evidence: {
            matchedAlias: 'unresolved'
          }
        };
      }

      const confidence = Math.min(0.89, Math.max(0.7, inferred.confidence));
      return {
        sourceColumn,
        canonicalField: inferred.canonicalField,
        strategy: 'HEURISTIC',
        confidence,
        reviewState: resolveReviewState(confidence),
        evidence: {
          matchedAlias: inferred.reason
        }
      };
    });
  }

  private inferByHeuristics(
    normalizedHeader: string,
    sourceColumn: string,
    index: number,
    sampleRows?: Array<Record<string, string | number | null | undefined>>
  ): { canonicalField: CanonicalField; confidence: number; reason: string } | null {
    const baseMatches: Array<{ field: CanonicalField; regex: RegExp; score: number; reason: string }> = [
      { field: 'part_number', regex: /\b(part|item|material)\b.*\b(no|number|num)\b|\bpn\b|\bp n\b/, score: 0.78, reason: 'regex-part-number' },
      { field: 'description', regex: /\b(desc|description|details|name)\b/, score: 0.76, reason: 'regex-description' },
      { field: 'quantity', regex: /\b(qty|quantity|count|needed)\b/, score: 0.78, reason: 'regex-quantity' },
      { field: 'revision', regex: /\b(rev|revision|version)\b/, score: 0.75, reason: 'regex-revision' },
      { field: 'supplier', regex: /\b(supplier|vendor|manufacturer)\b/, score: 0.74, reason: 'regex-supplier' },
      { field: 'cost', regex: /\b(cost|price|unit cost)\b/, score: 0.74, reason: 'regex-cost' },
      { field: 'lifecycle_status', regex: /\b(lifecycle|status|phase)\b/, score: 0.72, reason: 'regex-lifecycle' }
    ];

    let best: { canonicalField: CanonicalField; confidence: number; reason: string } | null = null;
    for (const pattern of baseMatches) {
      if (!pattern.regex.test(normalizedHeader)) continue;
      let confidence = pattern.score;

      if (pattern.field === 'part_number' && index === 0) confidence += 0.05;
      if (pattern.field === 'description' && index === 1) confidence += 0.04;
      if (pattern.field === 'quantity' && index >= 1) confidence += 0.03;
      confidence += this.sampleValueBoost(pattern.field, sourceColumn, sampleRows);

      const candidate = {
        canonicalField: pattern.field,
        confidence: Number(confidence.toFixed(4)),
        reason: pattern.reason
      };
      if (!best || candidate.confidence > best.confidence) best = candidate;
    }

    return best;
  }

  private sampleValueBoost(
    field: CanonicalField,
    sourceColumn: string,
    sampleRows?: Array<Record<string, string | number | null | undefined>>
  ): number {
    if (!sampleRows?.length) return 0;
    const values = sampleRows
      .map((row) => row[sourceColumn])
      .filter((value): value is string | number => value !== null && value !== undefined)
      .slice(0, 5);
    if (!values.length) return 0;

    const asStrings = values.map((value) => String(value).trim()).filter((value) => value.length > 0);
    if (!asStrings.length) return 0;

    const numericRatio =
      asStrings.filter((value) => /^-?\d+(\.\d+)?$/.test(value)).length / asStrings.length;

    if (field === 'quantity' && numericRatio >= 0.8) return 0.08;
    if (field === 'cost' && numericRatio >= 0.8) return 0.06;
    if (field === 'revision' && asStrings.some((value) => /^rev?\s*[-_.]?\s*[a-z0-9]+$/i.test(value))) return 0.06;
    if (field === 'part_number' && asStrings.some((value) => /^[a-z0-9][a-z0-9-_.]{2,}$/i.test(value))) return 0.05;

    return 0;
  }
}
