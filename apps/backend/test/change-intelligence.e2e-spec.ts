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

  it('classifies removed service-relevant BOM lines as high-impact functional removals', async () => {
    const result = await taxonomyService.classifyStructuralChange({
      tenantId: 'tenant-a',
      changeType: 'removed',
      row: {
        rowId: 'removed-service',
        partNumber: 'FUSE-100',
        quantity: 1,
        parentPath: '/root',
        properties: {
          'Service BOM Flag': 'Y'
        }
      }
    });

    expect(result.highestImpactClass).toBe('A');
    expect(result.impactCriticality).toBe('High');
    expect(result.categories[0]).toEqual(
      expect.objectContaining({
        category: 'Functional or service-affecting component removed'
      })
    );
    expect(result.categories[0].matchedProperties).toEqual(
      expect.arrayContaining(['Component PN', 'Quantity', 'Parent Item', 'Service BOM Flag'])
    );
  });

  it('classifies effectivity-scoped removals as medium-impact scoped removals', async () => {
    const result = await taxonomyService.classifyStructuralChange({
      tenantId: 'tenant-a',
      changeType: 'removed',
      row: {
        rowId: 'removed-variant',
        properties: {
          'Date Effectivity': '2026-03-20',
          'Serial Effectivity': '100-200'
        }
      }
    });

    expect(result.highestImpactClass).toBe('B');
    expect(result.impactCriticality).toBe('Medium');
    expect(result.categories[0]).toEqual(
      expect.objectContaining({
        category: 'Variant or effectivity-scoped removal'
      })
    );
    expect(result.categories[0].matchedProperties).toEqual(
      expect.arrayContaining(['Date Effectivity', 'Serial Effectivity'])
    );
  });

  it('classifies explicit reference-only removals as low-impact cleanup removals', async () => {
    const result = await taxonomyService.classifyStructuralChange({
      tenantId: 'tenant-a',
      changeType: 'removed',
      row: {
        rowId: 'removed-note',
        properties: {
          'BOM Text': 'REMOVE LEGACY NOTE',
          'Line Notes': 'obsolete annotation'
        }
      }
    });

    expect(result.highestImpactClass).toBe('C');
    expect(result.impactCriticality).toBe('Low');
    expect(result.categories[0]).toEqual(
      expect.objectContaining({
        category: 'Reference-only, documentation, or cleanup removal'
      })
    );
    expect(result.categories[0].matchedProperties).toEqual(expect.arrayContaining(['BOM Text', 'Line Notes']));
  });

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
        expect.objectContaining({ propertyName: 'MEVS Part Number', taxonomyProperty: 'Component PN' }),
        expect.objectContaining({ propertyName: 'MEVS Current Revision', taxonomyProperty: 'Component Revision' }),
        expect.objectContaining({ propertyName: 'QuantityInThisLine', taxonomyProperty: 'Quantity' }),
        expect.objectContaining({ propertyName: 'Comp. Qty (CUn)', taxonomyProperty: 'Quantity' }),
        expect.objectContaining({ propertyName: 'UOM', taxonomyProperty: 'UoM' })
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
      ['Shipping Volume Status', 'COMP_DESC', 'PartKey'],
      'General discrete manufacturing'
    );

    expect(result.categories).toEqual([]);
    expect(result.propertyMatches).toEqual([]);
  });

  it('classifies engineering measurement fields through canonical property families', async () => {
    await saveTenantTaxonomy('tenant-engineering-families', 'Automotive', {
      category: 'Product design or form-fit-function change',
      changeDescription: 'Engineering property family resolution coverage',
      impactClass: 'A',
      impactCriticality: 'High',
      triggerProperties: ['Volume', 'Area', 'Bounding Box', 'Center of Mass'],
      internalApprovingRoles: ['Design Engineer'],
      externalApprovingRoles: [],
      controlPath: 'ECR/ECO',
      complianceTrigger: 'IATF 16949'
    });

    const result = await taxonomyService.classifyChangedProperties(
      'tenant-engineering-families',
      ['Volume_mm3', 'Area_mm2', 'BoundingBox_mm', 'CenterOfMass'],
      'Automotive'
    );

    expect(result.categories).toEqual([
      expect.objectContaining({
        category: 'Product design or form-fit-function change',
        matchedProperties: expect.arrayContaining(['Volume', 'Area', 'Bounding Box', 'Center of Mass'])
      })
    ]);
    expect(result.propertyMatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ propertyName: 'Volume_mm3', taxonomyProperty: 'Volume', mode: 'family' }),
        expect.objectContaining({ propertyName: 'Area_mm2', taxonomyProperty: 'Area', mode: 'family' }),
        expect.objectContaining({ propertyName: 'BoundingBox_mm', taxonomyProperty: 'Bounding Box', mode: 'family' }),
        expect.objectContaining({ propertyName: 'CenterOfMass', taxonomyProperty: 'Center of Mass' })
      ])
    );
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
        expect.objectContaining({ propertyName: 'Vendor Part Number', taxonomyProperty: 'Supplier Part Number' }),
        expect.objectContaining({ propertyName: 'MEVS Current Revision', taxonomyProperty: 'Revision Level' }),
        expect.objectContaining({ propertyName: 'PPAP Status', taxonomyProperty: 'PPAP Trigger Flag' }),
        expect.objectContaining({ propertyName: 'Service Part Flag', taxonomyProperty: 'Service Part Link' }),
        expect.objectContaining({ propertyName: 'Tool Status', taxonomyProperty: 'Tooling Status' })
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

  it('classifies shared electronics BOM vocabulary from public assembly ecosystems', async () => {
    await saveTenantTaxonomy('tenant-electronics-public-vocab', 'Electronics', {
      category: 'Component replacement or cross-reference change',
      changeDescription: 'Public electronics BOM vocabulary coverage',
      impactClass: 'A',
      impactCriticality: 'High',
      triggerProperties: ['Reference Designator', 'Manufacturer Part Number', 'Quantity', 'Footprint', 'Package / Case'],
      internalApprovingRoles: ['Hardware Engineer'],
      externalApprovingRoles: [],
      controlPath: 'ECO',
      complianceTrigger: 'JEDEC J-STD-046'
    });

    const result = await taxonomyService.classifyChangedProperties(
      'tenant-electronics-public-vocab',
      ['Designator', 'Manufacturer Part #', 'Qty per board', 'Footprint', 'Package'],
      'Electronics'
    );

    expect(result.categories).toEqual([
      expect.objectContaining({
        category: 'Component replacement or cross-reference change',
        matchedProperties: expect.arrayContaining([
          'Reference Designator',
          'Manufacturer Part Number',
          'Quantity',
          'Footprint',
          'Package / Case'
        ])
      })
    ]);
  });

  it('classifies shared construction and COBie vocabulary through property families', async () => {
    await saveTenantTaxonomy('tenant-construction-public-vocab', 'Construction and built environment', {
      category: 'Design scope or configuration change',
      changeDescription: 'Public COBie and construction schedule vocabulary coverage',
      impactClass: 'A',
      impactCriticality: 'High',
      triggerProperties: ['Asset Identifier', 'IFC GUID', 'Specification Reference', 'Location / Zone / Room', 'System Classification', 'BoQ / Schedule Item'],
      internalApprovingRoles: ['BIM Manager'],
      externalApprovingRoles: [],
      controlPath: 'Change order',
      complianceTrigger: 'ISO 19650'
    });

    const result = await taxonomyService.classifyChangedProperties(
      'tenant-construction-public-vocab',
      ['TagNumber', 'GlobalId', 'Spec Section', 'Room', 'System', 'Cost Code'],
      'Construction and built environment'
    );

    expect(result.categories).toEqual([
      expect.objectContaining({
        category: 'Design scope or configuration change',
        matchedProperties: expect.arrayContaining([
          'Asset Identifier',
          'IFC GUID',
          'Specification Reference',
          'Location / Zone / Room',
          'System Classification',
          'BoQ / Schedule Item'
        ])
      })
    ]);
  });

  it('classifies shared service-parts vocabulary used in public medical equipment parts lists', async () => {
    await saveTenantTaxonomy('tenant-service-parts-public-vocab', 'General discrete manufacturing', {
      category: 'Functional BOM structure change',
      changeDescription: 'Public service-parts and medical-equipment vocabulary coverage',
      impactClass: 'A',
      impactCriticality: 'High',
      triggerProperties: ['Part Number', 'Serial Effectivity', 'Software / Calibration', 'Handling / Storage'],
      internalApprovingRoles: ['Service Engineer'],
      externalApprovingRoles: [],
      controlPath: 'ECO',
      complianceTrigger: 'ISO 9001'
    });

    const result = await taxonomyService.classifyChangedProperties(
      'tenant-service-parts-public-vocab',
      ['Part No.', 'Serial Number', 'Software Version', 'Shelf Life'],
      'General discrete manufacturing'
    );

    expect(result.categories).toEqual([
      expect.objectContaining({
        category: 'Functional BOM structure change',
        matchedProperties: expect.arrayContaining([
          'Part Number',
          'Serial Effectivity',
          'Software / Calibration',
          'Handling / Storage'
        ])
      })
    ]);
  });

  it('classifies shared PLM and ERP BOM vocabulary from public manufacturing ecosystems', async () => {
    await saveTenantTaxonomy('tenant-generic-public-vocab', 'General discrete manufacturing', {
      category: 'Functional BOM structure change',
      changeDescription: 'Shared PLM and ERP vocabulary coverage',
      impactClass: 'A',
      impactCriticality: 'High',
      triggerProperties: ['Quantity', 'UoM', 'Occurrence Identifier', 'Description', 'Variant / Configuration Rule'],
      internalApprovingRoles: ['Manufacturing Engineer'],
      externalApprovingRoles: [],
      controlPath: 'ECO',
      complianceTrigger: 'ISO 9001'
    });

    const result = await taxonomyService.classifyChangedProperties(
      'tenant-generic-public-vocab',
      ['BOM Header Quantity', 'Base Unit', 'Item Node Number', 'BOM Notes', 'Variant Condition'],
      'General discrete manufacturing'
    );

    expect(result.categories).toEqual([
      expect.objectContaining({
        category: 'Functional BOM structure change',
        matchedProperties: expect.arrayContaining([
          'Quantity',
          'UoM',
          'Occurrence Identifier',
          'Description',
          'Variant / Configuration Rule'
        ])
      })
    ]);
  });

  it('classifies public aerospace parts-list vocabulary through property families', async () => {
    await saveTenantTaxonomy('tenant-aerospace-public-vocab', 'Aerospace', {
      category: 'Flight product definition or interface change',
      changeDescription: 'Public aerospace field-vocabulary coverage',
      impactClass: 'A',
      impactCriticality: 'High',
      triggerProperties: ['Regulatory Classification', 'Weight', 'Center of Mass', 'Bounding Box', 'Service Applicability', 'Serial Effectivity', 'Software / Calibration', 'Compatibility Matrix'],
      internalApprovingRoles: ['Configuration Management'],
      externalApprovingRoles: [],
      controlPath: 'CCB',
      complianceTrigger: 'AS9100'
    });

    const result = await taxonomyService.classifyChangedProperties(
      'tenant-aerospace-public-vocab',
      ['Source Control Drawing', 'Weight_kg', 'CenterOfGravity', 'Envelope', 'Maintenance Applicability', 'Serialized Applicability', 'Loadable Software Part Number', 'Block / Mod Standard'],
      'Aerospace'
    );

    expect(result.categories).toEqual([
      expect.objectContaining({
        category: 'Flight product definition or interface change',
        matchedProperties: expect.arrayContaining([
          'Regulatory Classification',
          'Weight',
          'Center of Mass',
          'Bounding Box',
          'Service Applicability',
          'Serial Effectivity',
          'Software / Calibration',
          'Compatibility Matrix'
        ])
      })
    ]);
  });

  it('classifies public defense and government-contracting vocabulary through property families', async () => {
    await saveTenantTaxonomy('tenant-defense-public-vocab', 'Defense and government contracting', {
      category: 'Source-control or compliance-significant change',
      changeDescription: 'Public defense field-vocabulary coverage',
      impactClass: 'A',
      impactCriticality: 'High',
      triggerProperties: ['Approved Supplier', 'Supplier Code', 'Regulatory Classification', 'Deviation / Concession', 'Approval Status', 'Serial Effectivity', 'Lot Effectivity'],
      internalApprovingRoles: ['Program Quality'],
      externalApprovingRoles: [],
      controlPath: 'Government CCB',
      complianceTrigger: 'DFARS'
    });

    const result = await taxonomyService.classifyChangedProperties(
      'tenant-defense-public-vocab',
      ['Bearing Source', 'CAGE', 'Export Control Classification', 'Nonconformance Number', 'Government CCB', 'Serial Number', 'Lot Number'],
      'Defense and government contracting'
    );

    expect(result.categories).toEqual([
      expect.objectContaining({
        category: 'Source-control or compliance-significant change',
        matchedProperties: expect.arrayContaining([
          'Approved Supplier',
          'Supplier Code',
          'Regulatory Classification',
          'Deviation / Concession',
          'Approval Status',
          'Serial Effectivity',
          'Lot Effectivity'
        ])
      })
    ]);
  });

  it('classifies public medical-device and spare-parts vocabulary through property families', async () => {
    await saveTenantTaxonomy('tenant-medical-public-vocab', 'Medical devices', {
      category: 'Device definition or labeling change',
      changeDescription: 'Public medical-device and service-parts vocabulary coverage',
      impactClass: 'A',
      impactCriticality: 'High',
      triggerProperties: ['Part Number', 'Serial Effectivity', 'Lot Effectivity', 'Software / Calibration', 'Handling / Storage', 'Label Specification', 'Material', 'Length', 'Width', 'Height', 'Weight'],
      internalApprovingRoles: ['Regulatory Affairs'],
      externalApprovingRoles: [],
      controlPath: 'Design control',
      complianceTrigger: '21 CFR 820'
    });

    const result = await taxonomyService.classifyChangedProperties(
      'tenant-medical-public-vocab',
      ['Catalog Number', 'Serial Number', 'Lot Number', 'Software Version', 'Shelf Life', 'Labeling', 'MaterialSpec', 'Length_mm', 'Width_mm', 'Height_mm', 'Weight_kg'],
      'Medical devices'
    );

    expect(result.categories).toEqual([
      expect.objectContaining({
        category: 'Device definition or labeling change',
        matchedProperties: expect.arrayContaining([
          'Part Number',
          'Serial Effectivity',
          'Lot Effectivity',
          'Software / Calibration',
          'Handling / Storage',
          'Label Specification',
          'Material',
          'Length',
          'Width',
          'Height',
          'Weight'
        ])
      })
    ]);
  });
});
