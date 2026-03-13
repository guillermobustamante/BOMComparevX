import { ClassificationService } from '../src/diff/classification.service';
import { DiffFeatureFlagService } from '../src/diff/feature-flag.service';
import { MatchDecision } from '../src/diff/diff-contract';
import { NormalizationService } from '../src/diff/normalization.service';
import { BomChangeTaxonomyCategory, BomChangeTaxonomyService } from '../src/mapping/bom-change-taxonomy.service';

describe('Change intelligence foundations', () => {
  const normalizationService = new NormalizationService();
  const featureFlags = new DiffFeatureFlagService();
  const classificationService = new ClassificationService(normalizationService, featureFlags);
  const taxonomyService = new BomChangeTaxonomyService({ enabled: false } as any);

  async function saveTenantTaxonomy(
    tenantId: string,
    industry: string,
    category: Omit<BomChangeTaxonomyCategory, 'industry'>
  ) {
    await taxonomyService.saveTaxonomy({
      tenantId,
      industry,
      actorEmail: 'tester@example.com',
      categories: [
        {
          ...category,
          industry
        }
      ]
    });
  }

  function matchedRow(): MatchDecision {
    return {
      sourceRowId: 'row-a',
      targetRowId: 'row-b',
      strategy: 'PART_NUMBER',
      score: 1,
      reviewRequired: false,
      tieBreakTrace: [],
      reasonCode: 'matched_part_number'
    };
  }

  it('compares all preserved properties and detects non-canonical BOM field changes', () => {
    const rows = classificationService.classifyWithStats({
      sourceRows: [
        {
          rowId: 'row-a',
          partNumber: 'ABC-100',
          revision: 'A',
          description: 'Bracket',
          properties: {
            BoundingBox_mm: '15.0 x 2.0 x 15.0',
            Description: 'Bracket'
          }
        }
      ],
      targetRows: [
        {
          rowId: 'row-b',
          partNumber: 'ABC-100',
          revision: 'A',
          description: 'Bracket',
          properties: {
            BoundingBox_mm: '16.0 x 2.0 x 16.0',
            Description: 'Bracket'
          }
        }
      ],
      matches: [matchedRow()],
      unmatchedSourceIds: [],
      unmatchedTargetIds: []
    });

    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].changeType).toBe('modified');
    expect(rows.rows[0].cells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'BoundingBox_mm',
          before: '15.000000 x 2.000000 x 15.000000',
          after: '16.000000 x 2.000000 x 16.000000'
        })
      ])
    );
  });

  it('treats blank, missing, and null properties as equivalent', () => {
    const rows = classificationService.classifyWithStats({
      sourceRows: [
        {
          rowId: 'row-a',
          partNumber: 'ABC-100',
          revision: 'A',
          description: 'Bracket',
          properties: {
            BoundingBox_mm: ''
          }
        }
      ],
      targetRows: [
        {
          rowId: 'row-b',
          partNumber: 'ABC-100',
          revision: 'A',
          description: 'Bracket',
          properties: {}
        }
      ],
      matches: [matchedRow()],
      unmatchedSourceIds: [],
      unmatchedTargetIds: []
    });

    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].changeType).toBe('no_change');
    expect(rows.rows[0].cells).toHaveLength(0);
  });

  it('classifies exact and fuzzy taxonomy property matches from the seeded runbook', async () => {
    const result = await taxonomyService.classifyChangedProperties('tenant-a', [
      'Quantity',
      'Vendor Part Numbers'
    ]);

    expect(result.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'Quantity or consumption change with functional effect',
          impactCriticality: 'High'
        }),
        expect.objectContaining({
          category: 'Approved source or manufacturing site change',
          impactCriticality: 'Medium'
        })
      ])
    );
    expect(result.propertyMatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          propertyName: 'Quantity',
          mode: 'exact'
        }),
        expect.objectContaining({
          propertyName: 'Vendor Part Numbers',
          mode: 'fuzzy'
        })
      ])
    );
    expect(result.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'Quantity or consumption change with functional effect',
          matchedProperties: expect.arrayContaining(['Quantity'])
        }),
        expect.objectContaining({
          category: 'Approved source or manufacturing site change',
          matchedProperties: expect.arrayContaining(['Vendor Part Number'])
        })
      ])
    );
  });

  it('classifies multiple General discrete manufacturing aliases through semantic trigger matching', async () => {
    await saveTenantTaxonomy('tenant-generic', 'General discrete manufacturing', {
      category: 'Functional BOM structure change',
      changeDescription: 'Semantic alias coverage for generic trigger tags',
      impactClass: 'A',
      impactCriticality: 'High',
      triggerProperties: ['Component PN', 'Component Revision', 'Quantity', 'UoM'],
      internalApprovingRoles: ['Engineering'],
      externalApprovingRoles: [],
      controlPath: 'ECO',
      complianceTrigger: 'ISO 9001'
    });

    const result = await taxonomyService.classifyChangedProperties(
      'tenant-generic',
      ['MEVS Part Number', 'MEVS Current Revision', 'QuantityInThisLine', 'Comp. Qty (CUn)', 'UOM'],
      'General discrete manufacturing'
    );

    expect(result.categories).toEqual([
      expect.objectContaining({
        category: 'Functional BOM structure change',
        impactCriticality: 'High',
        matchedProperties: expect.arrayContaining([
          'Component PN',
          'Component Revision',
          'Quantity',
          'UoM'
        ])
      })
    ]);
    expect(result.propertyMatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ propertyName: 'MEVS Part Number', taxonomyProperty: 'Component PN', mode: 'semantic' }),
        expect.objectContaining({ propertyName: 'MEVS Current Revision', taxonomyProperty: 'Component Revision', mode: 'semantic' }),
        expect.objectContaining({ propertyName: 'QuantityInThisLine', taxonomyProperty: 'Quantity', mode: 'semantic' }),
        expect.objectContaining({ propertyName: 'Comp. Qty (CUn)', taxonomyProperty: 'Quantity', mode: 'semantic' }),
        expect.objectContaining({ propertyName: 'UOM', taxonomyProperty: 'UoM', mode: 'semantic' })
      ])
    );
    expect(result.propertyMatches.every((match) => match.confidence >= 0.9)).toBe(true);
  });

  it('does not classify unrelated General discrete manufacturing fields through semantic aliases', async () => {
    await saveTenantTaxonomy('tenant-generic-negative', 'General discrete manufacturing', {
      category: 'Functional BOM structure change',
      changeDescription: 'Negative guard coverage for generic aliases',
      impactClass: 'A',
      impactCriticality: 'High',
      triggerProperties: ['Component PN', 'Component Revision', 'Quantity', 'UoM'],
      internalApprovingRoles: ['Engineering'],
      externalApprovingRoles: [],
      controlPath: 'ECO',
      complianceTrigger: 'ISO 9001'
    });

    const result = await taxonomyService.classifyChangedProperties(
      'tenant-generic-negative',
      ['Volume_mm3', 'COMP_DESC', 'PartKey'],
      'General discrete manufacturing'
    );

    expect(result.categories).toEqual([]);
    expect(result.propertyMatches).toEqual([]);
  });

  it('classifies multiple Automotive aliases through semantic trigger matching', async () => {
    await saveTenantTaxonomy('tenant-automotive', 'Automotive', {
      category: 'Automotive alias coverage',
      changeDescription: 'Semantic alias coverage for automotive trigger tags',
      impactClass: 'A',
      impactCriticality: 'High',
      triggerProperties: ['Supplier Part Number', 'Revision Level', 'PPAP Trigger Flag', 'Service Part Link', 'Tooling Status'],
      internalApprovingRoles: ['SQE'],
      externalApprovingRoles: [],
      controlPath: 'PPAP',
      complianceTrigger: 'IATF 16949'
    });

    const result = await taxonomyService.classifyChangedProperties(
      'tenant-automotive',
      ['Vendor Part Number', 'MEVS Current Revision', 'PPAP Status', 'Service Part Flag', 'Tool Status'],
      'Automotive'
    );

    expect(result.categories).toEqual([
      expect.objectContaining({
        category: 'Automotive alias coverage',
        impactCriticality: 'High',
        matchedProperties: expect.arrayContaining([
          'Supplier Part Number',
          'Revision Level',
          'PPAP Trigger Flag',
          'Service Part Link',
          'Tooling Status'
        ])
      })
    ]);
    expect(result.propertyMatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ propertyName: 'Vendor Part Number', taxonomyProperty: 'Supplier Part Number', mode: 'semantic' }),
        expect.objectContaining({ propertyName: 'MEVS Current Revision', taxonomyProperty: 'Revision Level', mode: 'semantic' }),
        expect.objectContaining({ propertyName: 'PPAP Status', taxonomyProperty: 'PPAP Trigger Flag', mode: 'semantic' }),
        expect.objectContaining({ propertyName: 'Service Part Flag', taxonomyProperty: 'Service Part Link', mode: 'semantic' }),
        expect.objectContaining({ propertyName: 'Tool Status', taxonomyProperty: 'Tooling Status', mode: 'semantic' })
      ])
    );
    expect(result.propertyMatches.every((match) => match.confidence >= 0.9)).toBe(true);
  });

  it('does not classify unrelated Automotive fields through semantic aliases', async () => {
    await saveTenantTaxonomy('tenant-automotive-negative', 'Automotive', {
      category: 'Automotive alias coverage',
      changeDescription: 'Negative guard coverage for automotive aliases',
      impactClass: 'A',
      impactCriticality: 'High',
      triggerProperties: ['Supplier Part Number', 'Revision Level', 'PPAP Trigger Flag', 'Service Part Link', 'Tooling Status'],
      internalApprovingRoles: ['SQE'],
      externalApprovingRoles: [],
      controlPath: 'PPAP',
      complianceTrigger: 'IATF 16949'
    });

    const result = await taxonomyService.classifyChangedProperties(
      'tenant-automotive-negative',
      ['Volume_mm3', 'COMP_DESC', 'PartKey'],
      'Automotive'
    );

    expect(result.categories).toEqual([]);
    expect(result.propertyMatches).toEqual([]);
  });
});
