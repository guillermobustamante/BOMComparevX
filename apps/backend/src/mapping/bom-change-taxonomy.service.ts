import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseService } from '../database/database.service';

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
  mode: 'exact' | 'fuzzy';
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
const TAXONOMY_SOURCE_VERSION = 'runbook-v1';
const EXACT_MATCH_CONFIDENCE = 1;
const FUZZY_ACCEPT_THRESHOLD = 0.94;

@Injectable()
export class BomChangeTaxonomyService {
  constructor(private readonly databaseService: DatabaseService) {}

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
    const propertyMatches: BomChangePropertyMatch[] = [];
    const categories = new Map<string, BomChangeTaxonomyCategory & { matchedProperties: string[] }>();

    for (const propertyName of changedProperties) {
      const exactMatches = this.findExactMatches(propertyName, taxonomy.categories);
      if (exactMatches.length > 0) {
        for (const match of exactMatches) {
          propertyMatches.push({
            propertyName,
            taxonomyProperty: match.taxonomyProperty,
            mode: 'exact',
            confidence: EXACT_MATCH_CONFIDENCE
          });
          const existing = categories.get(match.category.category) || { ...match.category, matchedProperties: [] };
          existing.matchedProperties = [...new Set([...existing.matchedProperties, propertyName])];
          categories.set(match.category.category, existing);
        }
        continue;
      }

      const fuzzyMatch = this.findBestFuzzyMatch(propertyName, taxonomy.categories);
      if (!fuzzyMatch || fuzzyMatch.confidence < FUZZY_ACCEPT_THRESHOLD) {
        continue;
      }

      propertyMatches.push({
        propertyName,
        taxonomyProperty: fuzzyMatch.taxonomyProperty,
        mode: 'fuzzy',
        confidence: fuzzyMatch.confidence
      });
      const existing = categories.get(fuzzyMatch.category.category) || { ...fuzzyMatch.category, matchedProperties: [] };
      existing.matchedProperties = [...new Set([...existing.matchedProperties, propertyName])];
      categories.set(fuzzyMatch.category.category, existing);
    }

    const resolvedCategories = [...categories.values()].sort(
      (a, b) =>
        this.impactCriticalityRank(b.impactCriticality) - this.impactCriticalityRank(a.impactCriticality) ||
        a.category.localeCompare(b.category)
    );

    const impactCriticality = resolvedCategories[0]?.impactCriticality || null;
    const highestImpactClass = resolvedCategories[0]?.impactClass || null;

    return {
      industry: taxonomy.industry,
      categories: resolvedCategories,
      highestImpactClass,
      impactCriticality,
      internalApprovingRoles: this.uniqueFlat(resolvedCategories.map((category) => category.internalApprovingRoles)),
      externalApprovingRoles: this.uniqueFlat(resolvedCategories.map((category) => category.externalApprovingRoles)),
      complianceTriggers: this.uniqueFlat(resolvedCategories.map((category) => [category.complianceTrigger])),
      propertyMatches
    };
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
  ): Array<{ category: BomChangeTaxonomyCategory; taxonomyProperty: string }> {
    const normalizedProperty = this.normalizeValue(propertyName);
    return categories.flatMap((category) =>
      category.triggerProperties
        .filter((triggerProperty) => this.normalizeValue(triggerProperty) === normalizedProperty)
        .map((triggerProperty) => ({ category, taxonomyProperty: triggerProperty }))
    );
  }

  private findBestFuzzyMatch(
    propertyName: string,
    categories: BomChangeTaxonomyCategory[]
  ): { category: BomChangeTaxonomyCategory; taxonomyProperty: string; confidence: number } | null {
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
    return viable.sort(
      (a, b) =>
        b.confidence - a.confidence ||
        this.impactCriticalityRank(b.category.impactCriticality) - this.impactCriticalityRank(a.category.impactCriticality) ||
        a.category.category.localeCompare(b.category.category)
    )[0];
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
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
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
