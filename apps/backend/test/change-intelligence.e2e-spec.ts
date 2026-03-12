import { ClassificationService } from '../src/diff/classification.service';
import { DiffFeatureFlagService } from '../src/diff/feature-flag.service';
import { MatchDecision } from '../src/diff/diff-contract';
import { NormalizationService } from '../src/diff/normalization.service';
import { BomChangeTaxonomyService } from '../src/mapping/bom-change-taxonomy.service';

describe('Change intelligence foundations', () => {
  const normalizationService = new NormalizationService();
  const featureFlags = new DiffFeatureFlagService();
  const classificationService = new ClassificationService(normalizationService, featureFlags);
  const taxonomyService = new BomChangeTaxonomyService({ enabled: false } as any);

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
  });
});
