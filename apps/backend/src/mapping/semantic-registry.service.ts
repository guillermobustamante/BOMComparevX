import { Injectable } from '@nestjs/common';
import { CanonicalField } from './mapping-contract';

export interface RegistryAliasEntry {
  canonicalField: CanonicalField;
  alias: string;
  language: 'en' | 'es' | 'de' | 'fr' | 'ja' | 'zh';
  domain: 'electronics' | 'mechanical' | 'aerospace' | 'manufacturing';
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
  { canonicalField: 'lifecycle_status', alias: 'status', language: 'en', domain: 'aerospace', weight: 0.88 }
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
