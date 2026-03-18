import { Injectable } from '@nestjs/common';
import { BomChangeTaxonomyService } from './bom-change-taxonomy.service';
import {
  CanonicalField,
  DetectedColumnCandidate,
  MappingComparisonReadiness,
  MappingConsequenceLevel,
  MappingFieldClass,
  MappingImpactReadiness,
  MappingPreviewContract,
  MappingPreviewGroupId,
  REQUIRED_CANONICAL_FIELDS
} from './mapping-contract';
import { TaxonomyPropertyFamilyService } from './taxonomy-property-family.service';

interface PresentPreviewInput {
  revisionId: string;
  tenantId: string;
  sampleRows: Array<Record<string, string | number | null>>;
  columns: DetectedColumnCandidate[];
  requiredFieldsStatus: MappingPreviewContract['requiredFieldsStatus'];
}

interface FieldPresentationMetadata {
  displayLabel: string;
  fieldRoles: string[];
  groupId: MappingPreviewGroupId;
  whyItMatters: string;
  proceedImpact: string;
  suggestedBusinessMeaning?: string;
}

const GROUP_COPY: Record<
  MappingPreviewGroupId,
  { label: string; description: string }
> = {
  required_compare: {
    label: 'Required to compare',
    description: 'These columns carry the minimum identity and quantity signals needed for a safe comparison.'
  },
  recommended_matching: {
    label: 'Recommended for better matching',
    description: 'These columns improve confidence, reduce ambiguity, and help the system align similar parts correctly.'
  },
  impact_classification: {
    label: 'Useful for impact classification',
    description: 'These columns strengthen design, compliance, sourcing, and downstream change understanding.'
  },
  preserved_unclassified: {
    label: 'Preserved but not yet understood',
    description: 'These columns are still retained for exports and review, but the system needs more guidance to use them.'
  }
};

const FIELD_METADATA: Partial<Record<CanonicalField, FieldPresentationMetadata>> = {
  part_number: {
    displayLabel: 'Part number',
    fieldRoles: ['Row identity', 'Comparison'],
    groupId: 'required_compare',
    whyItMatters: 'This is the main key used to recognize the same part across BOM revisions.',
    proceedImpact: 'If this is wrong, the comparison can match the wrong parts or miss a change entirely.',
    suggestedBusinessMeaning: 'Part identifier'
  },
  description: {
    displayLabel: 'Description',
    fieldRoles: ['Comparison', 'Display only'],
    groupId: 'required_compare',
    whyItMatters: 'This gives reviewers human-readable context and helps confirm the right part was recognized.',
    proceedImpact: 'If this stays unresolved, the comparison is harder to trust and review.'
  },
  quantity: {
    displayLabel: 'Quantity',
    fieldRoles: ['Comparison'],
    groupId: 'required_compare',
    whyItMatters: 'Quantity is required to detect count changes accurately.',
    proceedImpact: 'If this is wrong, quantity-change results can be incomplete or misleading.',
    suggestedBusinessMeaning: 'Required quantity'
  },
  revision: {
    displayLabel: 'Revision',
    fieldRoles: ['Row identity', 'Comparison'],
    groupId: 'recommended_matching',
    whyItMatters: 'Revision separates versions of the same part so replacements and updates are easier to classify.',
    proceedImpact: 'Leaving this unresolved can reduce matching confidence for versioned parts.'
  },
  occurrence_id: {
    displayLabel: 'Occurrence identifier',
    fieldRoles: ['Occurrence identity', 'Comparison'],
    groupId: 'recommended_matching',
    whyItMatters: 'This tells the system apart when the same part appears more than once in different positions.',
    proceedImpact: 'Without it, repeated parts may collapse together and movement or structure changes can be harder to trace.'
  },
  object_id: {
    displayLabel: 'Object identifier',
    fieldRoles: ['Row identity', 'Comparison'],
    groupId: 'recommended_matching',
    whyItMatters: 'This provides a durable system identifier when part numbers alone are not unique.',
    proceedImpact: 'Without it, exact lineage and instance matching can weaken.'
  },
  manufacturer_part_number: {
    displayLabel: 'Manufacturer part number',
    fieldRoles: ['Comparison', 'Classification trigger'],
    groupId: 'recommended_matching',
    whyItMatters: 'This improves matching when supplier-specific identifiers are important.',
    proceedImpact: 'Resolving it helps avoid false replacements or ambiguous matches.'
  },
  reference_designator: {
    displayLabel: 'Reference designator',
    fieldRoles: ['Occurrence identity', 'Comparison'],
    groupId: 'recommended_matching',
    whyItMatters: 'This distinguishes placements of the same component in electronics BOMs.',
    proceedImpact: 'Resolving it improves occurrence-level accuracy for duplicated components.'
  },
  supplier: {
    displayLabel: 'Supplier',
    fieldRoles: ['Business / compliance', 'Classification trigger'],
    groupId: 'impact_classification',
    whyItMatters: 'Supplier changes often matter to sourcing, approvals, and compliance reviews.',
    proceedImpact: 'Leaving it unresolved reduces downstream impact classification coverage.'
  },
  cost: {
    displayLabel: 'Cost',
    fieldRoles: ['Business / compliance', 'Classification trigger'],
    groupId: 'impact_classification',
    whyItMatters: 'Cost changes inform commercial impact and review urgency.',
    proceedImpact: 'Resolving it improves commercial-change visibility without blocking comparison.'
  },
  lifecycle_status: {
    displayLabel: 'Lifecycle status',
    fieldRoles: ['Business / compliance', 'Classification trigger'],
    groupId: 'impact_classification',
    whyItMatters: 'Lifecycle state helps flag obsolescence, release, and sourcing risk.',
    proceedImpact: 'Resolving it improves readiness for lifecycle and compliance impact classification.'
  },
  compliance_status: {
    displayLabel: 'Compliance status',
    fieldRoles: ['Business / compliance', 'Classification trigger'],
    groupId: 'impact_classification',
    whyItMatters: 'Compliance signals inform whether a change could trigger approval or regulatory work.',
    proceedImpact: 'Resolving it strengthens governance and compliance review coverage.'
  },
  rohs: {
    displayLabel: 'RoHS status',
    fieldRoles: ['Business / compliance', 'Classification trigger'],
    groupId: 'impact_classification',
    whyItMatters: 'RoHS changes can affect compliance readiness and downstream approvals.',
    proceedImpact: 'Resolving it improves compliance-focused impact classification.'
  },
  reach: {
    displayLabel: 'REACH status',
    fieldRoles: ['Business / compliance', 'Classification trigger'],
    groupId: 'impact_classification',
    whyItMatters: 'REACH-related changes can drive environmental and governance review.',
    proceedImpact: 'Resolving it strengthens compliance coverage without blocking safe comparison.'
  },
  plant: {
    displayLabel: 'Plant',
    fieldRoles: ['Business / compliance', 'Classification trigger'],
    groupId: 'impact_classification',
    whyItMatters: 'Plant data can change manufacturing applicability, routing, and supply interpretation.',
    proceedImpact: 'Resolving it helps classify operational impact more completely.'
  },
  work_center: {
    displayLabel: 'Work center',
    fieldRoles: ['Business / compliance', 'Classification trigger'],
    groupId: 'impact_classification',
    whyItMatters: 'Work center changes can affect operations and process planning.',
    proceedImpact: 'Resolving it helps the system explain manufacturing impact more clearly.'
  },
  assembly: {
    displayLabel: 'Assembly',
    fieldRoles: ['Display only'],
    groupId: 'preserved_unclassified',
    whyItMatters: 'Assembly context is preserved so reviewers can orient themselves during investigation.',
    proceedImpact: 'It is safe to proceed without it, but resolving it can improve readability.'
  },
  parent_path: {
    displayLabel: 'Parent path',
    fieldRoles: ['Display only'],
    groupId: 'preserved_unclassified',
    whyItMatters: 'Parent path is preserved for structure review and exports.',
    proceedImpact: 'It does not block comparison safety, but it can help expert review.'
  }
};

@Injectable()
export class MappingPreviewPresenterService {
  constructor(
    private readonly taxonomyPropertyFamilyService: TaxonomyPropertyFamilyService,
    private readonly bomChangeTaxonomyService: BomChangeTaxonomyService
  ) {}

  async presentPreview(input: PresentPreviewInput): Promise<MappingPreviewContract> {
    const presentedColumns = await Promise.all(
      input.columns.map(async (column) => {
        const metadata = this.resolveMetadata(column);
        const familyResolution =
          this.taxonomyPropertyFamilyService.resolve(column.sourceColumn) ||
          (metadata.displayLabel ? this.taxonomyPropertyFamilyService.resolve(metadata.displayLabel) : null);
        const taxonomyMatch = familyResolution
          ? await this.bomChangeTaxonomyService.classifyChangedProperties(input.tenantId, [
              familyResolution.classificationTag
            ])
          : null;

        return {
          ...column,
          displayLabel: metadata.displayLabel,
          sampleValues: this.resolveSampleValues(input.sampleRows, column.sourceColumn),
          canonicalFieldLabel: column.canonicalField ? this.resolveCanonicalFieldLabel(column.canonicalField) : null,
          suggestedBusinessMeaning: metadata.suggestedBusinessMeaning || familyResolution?.classificationTag || null,
          fieldRoles: metadata.fieldRoles,
          groupId: metadata.groupId,
          consequenceLevel: this.resolveConsequenceLevel(metadata.groupId, column.fieldClass),
          whyItMatters: metadata.whyItMatters,
          proceedImpact: metadata.proceedImpact,
          semanticFamily: familyResolution?.familyId || null,
          classificationTags: familyResolution ? [familyResolution.classificationTag] : [],
          likelyCategories: taxonomyMatch?.categories.map((category) => category.category) || []
        };
      })
    );

    const groups = (Object.keys(GROUP_COPY) as MappingPreviewGroupId[]).map((groupId) => {
      const groupColumns = presentedColumns.filter((column) => column.groupId === groupId);
      return {
        id: groupId,
        label: GROUP_COPY[groupId].label,
        description: GROUP_COPY[groupId].description,
        counts: {
          total: groupColumns.length,
          unresolved: groupColumns.filter((column) => !column.canonicalField).length,
          lowConfidence: groupColumns.filter((column) => column.reviewState === 'LOW_CONFIDENCE_WARNING').length
        }
      };
    });

    const lowConfidenceCriticalCount = presentedColumns.filter(
      (column) => column.groupId === 'required_compare' && column.reviewState === 'LOW_CONFIDENCE_WARNING'
    ).length;
    const unresolvedRequiredCount = input.requiredFieldsStatus.filter((status) => !status.mapped).length;
    const unresolvedCount = presentedColumns.filter((column) => !column.canonicalField).length;
    const recognizedTriggerColumns = presentedColumns.filter(
      (column) => column.classificationTags.length > 0 || column.likelyCategories.length > 0
    ).length;
    const semanticallyUnclassifiedColumns = presentedColumns
      .filter(
        (column) =>
          column.groupId !== 'required_compare' &&
          !column.semanticFamily &&
          (!column.classificationTags.length || !column.likelyCategories.length)
      )
      .map((column) => column.sourceColumn);
    const comparisonReadiness = this.resolveComparisonReadiness(unresolvedRequiredCount, lowConfidenceCriticalCount);
    const impactReadiness = this.resolveImpactReadiness(recognizedTriggerColumns, semanticallyUnclassifiedColumns.length);
    const canProceed = unresolvedRequiredCount === 0;

    return {
      contractVersion: 'v2',
      revisionId: input.revisionId,
      summary: {
        comparisonReadiness,
        impactReadiness,
        unresolvedCount,
        lowConfidenceCriticalCount,
        canProceed,
        proceedLabel: canProceed ? 'Use these mappings' : 'Resolve critical fields before comparing'
      },
      groups,
      columns: presentedColumns,
      impactReadiness: {
        recognizedTriggerColumns,
        semanticallyUnclassifiedColumns,
        likelyCoverageNotes: this.buildCoverageNotes({
          canProceed,
          impactReadiness,
          recognizedTriggerColumns,
          semanticallyUnclassifiedColumnsCount: semanticallyUnclassifiedColumns.length
        })
      },
      recommendedActions: this.buildRecommendedActions({
        canProceed,
        comparisonReadiness,
        impactReadiness,
        lowConfidenceCriticalCount,
        unresolvedRequiredCount
      }),
      sampleRows: input.sampleRows,
      requiredFieldsStatus: input.requiredFieldsStatus,
      canProceed
    };
  }

  private resolveMetadata(column: DetectedColumnCandidate): FieldPresentationMetadata {
    if (column.canonicalField && FIELD_METADATA[column.canonicalField]) {
      return FIELD_METADATA[column.canonicalField]!;
    }

    const displayLabel = column.canonicalField
      ? this.resolveCanonicalFieldLabel(column.canonicalField)
      : 'Needs review';
    const fieldClass = column.fieldClass || this.resolveFallbackFieldClass(column.canonicalField);
    const groupId =
      fieldClass === 'business_impact'
        ? 'impact_classification'
        : fieldClass === 'identity' || fieldClass === 'comparable'
          ? 'recommended_matching'
          : 'preserved_unclassified';

    return {
      displayLabel,
      fieldRoles: this.resolveFieldRoles(fieldClass),
      groupId,
      whyItMatters:
        groupId === 'impact_classification'
          ? 'This column can improve downstream impact classification and reviewer context.'
          : groupId === 'recommended_matching'
            ? 'This column can improve matching confidence and reduce ambiguity.'
            : 'This column is preserved so reviewers can inspect it even when the system has not classified it yet.',
      proceedImpact:
        groupId === 'impact_classification'
          ? 'Leaving it unresolved usually does not block comparison, but impact coverage stays partial.'
          : groupId === 'recommended_matching'
            ? 'Leaving it unresolved can weaken confidence, but safe comparison may still be possible.'
            : 'It is safe to proceed while this remains preserved-only.'
    };
  }

  private resolveCanonicalFieldLabel(field: CanonicalField): string {
    return String(field)
      .split('_')
      .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
      .join(' ');
  }

  private resolveSampleValues(
    sampleRows: Array<Record<string, string | number | null>>,
    sourceColumn: string
  ): string[] {
    const values = sampleRows
      .map((row) => row[sourceColumn])
      .filter((value): value is string | number => value !== null && value !== undefined && `${value}`.trim().length > 0)
      .map((value) => String(value).trim());
    return [...new Set(values)].slice(0, 3);
  }

  private resolveConsequenceLevel(
    groupId: MappingPreviewGroupId,
    fieldClass: MappingFieldClass | undefined
  ): MappingConsequenceLevel {
    if (groupId === 'required_compare') return 'critical';
    if (groupId === 'recommended_matching') return 'important';
    if (groupId === 'impact_classification' || fieldClass === 'business_impact') return 'helpful';
    return 'informational';
  }

  private resolveComparisonReadiness(
    unresolvedRequiredCount: number,
    lowConfidenceCriticalCount: number
  ): MappingComparisonReadiness {
    if (unresolvedRequiredCount > 0) return 'blocked';
    if (lowConfidenceCriticalCount > 0) return 'warning';
    return 'ready';
  }

  private resolveImpactReadiness(
    recognizedTriggerColumns: number,
    semanticallyUnclassifiedCount: number
  ): MappingImpactReadiness {
    if (recognizedTriggerColumns >= 3 && semanticallyUnclassifiedCount <= 1) return 'strong';
    if (recognizedTriggerColumns >= 1) return 'partial';
    return 'weak';
  }

  private buildCoverageNotes(input: {
    canProceed: boolean;
    impactReadiness: MappingImpactReadiness;
    recognizedTriggerColumns: number;
    semanticallyUnclassifiedColumnsCount: number;
  }): string[] {
    const notes: string[] = [];
    if (input.canProceed) {
      notes.push('Comparison-critical fields are understood well enough to proceed.');
    } else {
      notes.push('Resolve comparison-critical gaps before starting the comparison.');
    }
    if (input.impactReadiness === 'strong') {
      notes.push('Impact classification coverage looks strong for the fields recognized in this BOM.');
    } else if (input.impactReadiness === 'partial') {
      notes.push('Comparison can proceed, but impact classification coverage is still partial.');
    } else {
      notes.push('Very little impact-classification context was recognized yet.');
    }
    if (input.semanticallyUnclassifiedColumnsCount > 0) {
      notes.push(
        `${input.semanticallyUnclassifiedColumnsCount} preserved columns still need semantic understanding to improve downstream coverage.`
      );
    }
    if (input.recognizedTriggerColumns > 0) {
      notes.push(`${input.recognizedTriggerColumns} columns already look useful for change impact classification.`);
    }
    return notes;
  }

  private buildRecommendedActions(input: {
    canProceed: boolean;
    comparisonReadiness: MappingComparisonReadiness;
    impactReadiness: MappingImpactReadiness;
    lowConfidenceCriticalCount: number;
    unresolvedRequiredCount: number;
  }): string[] {
    const actions: string[] = [];
    if (!input.canProceed) {
      actions.push(
        `Resolve the ${input.unresolvedRequiredCount} comparison-critical field${input.unresolvedRequiredCount === 1 ? '' : 's'} before continuing.`
      );
    } else {
      actions.push('Use these mappings to continue with comparison.');
    }
    if (input.lowConfidenceCriticalCount > 0) {
      actions.push('Review the low-confidence comparison-critical suggestions before confirming.');
    }
    if (input.impactReadiness !== 'strong') {
      actions.push('Treat impact classification as partial until more semantic columns are understood.');
    }
    if (input.comparisonReadiness === 'ready') {
      actions.push('Keep expert evidence collapsed unless you need to review a suggestion in detail.');
    }
    return actions;
  }

  private resolveFallbackFieldClass(field: CanonicalField | null): MappingFieldClass | undefined {
    if (!field) return undefined;
    if (REQUIRED_CANONICAL_FIELDS.includes(field as (typeof REQUIRED_CANONICAL_FIELDS)[number])) {
      return 'identity';
    }
    return undefined;
  }

  private resolveFieldRoles(fieldClass: MappingFieldClass | undefined): string[] {
    switch (fieldClass) {
      case 'identity':
        return ['Row identity', 'Comparison'];
      case 'business_impact':
        return ['Business / compliance', 'Classification trigger'];
      case 'display':
        return ['Display only'];
      case 'comparable':
      default:
        return ['Comparison'];
    }
  }
}
