import * as XLSX from 'xlsx';
import { UploadRevisionService } from '../src/uploads/upload-revision.service';
import { NormalizationService } from '../src/diff/normalization.service';
import { DiffFeatureFlagService } from '../src/diff/feature-flag.service';
import { ProfileAdapterService } from '../src/diff/profile-adapter.service';
import { MatcherService } from '../src/diff/matcher.service';
import { ClassificationService } from '../src/diff/classification.service';
import { DiffComputationService } from '../src/diff/diff-computation.service';
import { BomChangeTaxonomyService } from '../src/mapping/bom-change-taxonomy.service';
import { SemanticRegistryService } from '../src/mapping/semantic-registry.service';

function buildWorkbookFile(rows: Array<Record<string, string | number>>): Express.Multer.File {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const data = [
    headers,
    ...rows.map((row) => headers.map((header) => row[header] ?? ''))
  ];
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'BOM');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
  return {
    fieldname: 'file',
    originalname: 'occurrence-aware.xlsx',
    encoding: '7bit',
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: buffer.length,
    buffer,
    stream: undefined as never,
    destination: '',
    filename: 'occurrence-aware.xlsx',
    path: ''
  } as Express.Multer.File;
}

function buildOccurrenceRows(order: string[]): Array<Record<string, string | number>> {
  const base: Record<string, Record<string, string | number>> = {
    Solid035: {
      Level: 3,
      ParentPath: 'Nissan GT-R/Fahrwerk/Hinterrad links komplett',
      AssemblyPath: 'Nissan GT-R/Fahrwerk/Hinterrad links komplett/SI-Mutter M8',
      LineType: 'DirectPart',
      PartNumber: '',
      PartName: 'SI-Mutter M8',
      PartKey: 'Solid035',
      QuantityInThisLine: 1,
      Quantity_in_Parent: 1,
      OccurrenceLabel: 'SI-Mutter M8',
      OccurrenceInternalName: 'Solid035',
      Placement: 'Placement [Pos=(0,2.77556e-14,41.8), Yaw-Pitch-Roll=(0,0,0)]',
      LinkedObjectName: 'Solid035',
      LinkedObjectLabel: 'SI-Mutter M8',
      Volume_mm3: 1019.8688395108185,
      Area_mm2: 1062.6740434536248,
      BoundingBox_mm: '15.0 x 15.0 x 12.0',
      CenterOfMass: 'Vector (1.3064793016317646e-10, -1.51614543292725e-09, 46.815340693295965)'
    },
    Link031: {
      Level: 3,
      ParentPath: 'Nissan GT-R/Fahrwerk/Hinterrad rechts komplett',
      AssemblyPath: 'Nissan GT-R/Fahrwerk/Hinterrad rechts komplett/SI-Mutter M009',
      LineType: 'Occurrence(Link)',
      PartNumber: '',
      PartName: 'SI-Mutter M8',
      PartKey: 'Solid035',
      QuantityInThisLine: 1,
      Quantity_in_Parent: 1,
      OccurrenceLabel: 'SI-Mutter M009',
      OccurrenceInternalName: 'Link031',
      Placement: 'Placement [Pos=(0,-2.77556e-14,41.3), Yaw-Pitch-Roll=(0,0,0)]',
      LinkedObjectName: 'Solid035',
      LinkedObjectLabel: 'SI-Mutter M8',
      Volume_mm3: 1019.8688395108185,
      Area_mm2: 1062.6740434536248,
      BoundingBox_mm: '15.0 x 15.0 x 12.0',
      CenterOfMass: 'Vector (1.3064793016317646e-10, -1.51614543292725e-09, 46.815340693295965)'
    },
    Link037: {
      Level: 3,
      ParentPath: 'Nissan GT-R/Fahrwerk/Vorderrad rechts komplett',
      AssemblyPath: 'Nissan GT-R/Fahrwerk/Vorderrad rechts komplett/SI-Mutter M010',
      LineType: 'Occurrence(Link)',
      PartNumber: '',
      PartName: 'SI-Mutter M8',
      PartKey: 'Solid035',
      QuantityInThisLine: 1,
      Quantity_in_Parent: 1,
      OccurrenceLabel: 'SI-Mutter M010',
      OccurrenceInternalName: 'Link037',
      Placement: 'Placement [Pos=(2.77556e-14,2.08167e-14,41.3), Yaw-Pitch-Roll=(0,0,0)]',
      LinkedObjectName: 'Solid035',
      LinkedObjectLabel: 'SI-Mutter M8',
      Volume_mm3: 1019.8688395108185,
      Area_mm2: 1062.6740434536248,
      BoundingBox_mm: '15.0 x 15.0 x 12.0',
      CenterOfMass: 'Vector (1.3064793016317646e-10, -1.51614543292725e-09, 46.815340693295965)'
    },
    Link046: {
      Level: 3,
      ParentPath: 'Nissan GT-R/Fahrwerk/Vorderrad links Komplett',
      AssemblyPath: 'Nissan GT-R/Fahrwerk/Vorderrad links Komplett/SI-Mutter M011',
      LineType: 'Occurrence(Link)',
      PartNumber: '',
      PartName: 'SI-Mutter M8',
      PartKey: 'Solid035',
      QuantityInThisLine: 1,
      Quantity_in_Parent: 1,
      OccurrenceLabel: 'SI-Mutter M011',
      OccurrenceInternalName: 'Link046',
      Placement: 'Placement [Pos=(4.16334e-14,-1.38778e-14,41.3), Yaw-Pitch-Roll=(-24.5199,0,0)]',
      LinkedObjectName: 'Solid035',
      LinkedObjectLabel: 'SI-Mutter M8',
      Volume_mm3: 1019.8688395108185,
      Area_mm2: 1062.6740434536248,
      BoundingBox_mm: '15.0 x 15.0 x 12.0',
      CenterOfMass: 'Vector (1.3064793016317646e-10, -1.51614543292725e-09, 46.815340693295965)'
    }
  };

  return order.map((key) => ({ ...base[key] }));
}

describe('Occurrence-aware matching hardening', () => {
  const uploadRevisionService = new UploadRevisionService({ enabled: false } as any);
  const normalizationService = new NormalizationService();
  const featureFlags = new DiffFeatureFlagService();
  const profileAdapterService = new ProfileAdapterService();
  const matcherService = new MatcherService(normalizationService, featureFlags);
  const classificationService = new ClassificationService(normalizationService, featureFlags);
  const taxonomyService = new BomChangeTaxonomyService({ enabled: false } as any);
  const diffComputationService = new DiffComputationService(
    normalizationService,
    featureFlags,
    profileAdapterService,
    matcherService,
    classificationService,
    taxonomyService
  );
  const semanticRegistryService = new SemanticRegistryService();

  it('prefers occurrence identity over shared object identity during upload parsing', async () => {
    const rows = buildOccurrenceRows(['Link031']);
    const file = buildWorkbookFile(rows);
    const pair = await uploadRevisionService.storeRevisionPair({
      tenantId: 'tenant-a',
      sessionId: 'session-occurrence-parser',
      jobId: 'job-occurrence-parser',
      fileA: file,
      fileB: file
    });

    const parsedRows = await uploadRevisionService.getRevisionRows('tenant-a', pair.leftRevisionId);
    expect(parsedRows).not.toBeNull();
    expect(parsedRows?.[0]).toEqual(
      expect.objectContaining({
        internalId: 'Link031',
        occurrenceInternalId: 'Link031',
        objectInternalId: 'Solid035'
      })
    );
  });

  it('keeps repeated shared-part occurrences as no-change even when target order shifts', () => {
    const sourceRows = buildOccurrenceRows(['Solid035', 'Link031', 'Link037', 'Link046']).map((row, index) => ({
      rowId: `s-${index + 1}`,
      internalId: String(row.OccurrenceInternalName),
      occurrenceInternalId: String(row.OccurrenceInternalName),
      objectInternalId: String(row.PartKey),
      partNumber: null,
      revision: null,
      description: String(row.PartName),
      quantity: Number(row.QuantityInThisLine),
      parentPath: String(row.ParentPath),
      assemblyPath: String(row.AssemblyPath),
      hierarchyLevel: Number(row.Level),
      properties: { ...row }
    }));
    const targetRows = buildOccurrenceRows(['Link046', 'Link037', 'Solid035', 'Link031']).map((row, index) => ({
      rowId: `t-${index + 1}`,
      internalId: String(row.OccurrenceInternalName),
      occurrenceInternalId: String(row.OccurrenceInternalName),
      objectInternalId: String(row.PartKey),
      partNumber: null,
      revision: null,
      description: String(row.PartName),
      quantity: Number(row.QuantityInThisLine),
      parentPath: String(row.ParentPath),
      assemblyPath: String(row.AssemblyPath),
      hierarchyLevel: Number(row.Level),
      properties: { ...row }
    }));

    const computed = diffComputationService.compute({
      sourceRows,
      targetRows,
      sourceContext: {
        fileName: 'example-1-ver-1.xlsx',
        headers: Object.keys(buildOccurrenceRows(['Link031'])[0])
      },
      targetContext: {
        fileName: 'example-1-ver-2.xlsx',
        headers: Object.keys(buildOccurrenceRows(['Link031'])[0])
      }
    });

    expect(computed.counters.modified).toBe(0);
    expect(computed.counters.no_change).toBe(4);
    expect(
      computed.rows.every(
        (row) =>
          row.changeType === 'no_change' &&
          row.rationale.sourceStableOccurrenceKey === row.rationale.targetStableOccurrenceKey
      )
    ).toBe(true);
  });

  it('teaches mapping semantics about occurrence and object identifiers', () => {
    expect(semanticRegistryService.findExact('Occurrence Internal Name')).toEqual(
      expect.objectContaining({
        canonicalField: 'occurrence_id'
      })
    );
    expect(semanticRegistryService.findExact('Part Key')).toEqual(
      expect.objectContaining({
        canonicalField: 'object_id'
      })
    );
  });
});
