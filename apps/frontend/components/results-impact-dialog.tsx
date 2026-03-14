'use client';

import { CloseIcon } from '@/components/mission-icons';
import { DiffImpactCategory, DiffRow, ImpactCriticality } from './results-grid-contract';

function impactCriticalityBadgeClass(value: ImpactCriticality | null | undefined): string {
  if (!value) return 'taxonomyCriticalityBadge';
  return `taxonomyCriticalityBadge taxonomyCriticalityBadge${value}`;
}

function renderChipList(
  values: string[],
  keyPrefix: string,
  className?: (value: string) => string
): JSX.Element {
  if (!values.length) {
    return <span className="chip">None</span>;
  }

  return (
    <>
      {values.map((value) => (
        <span className={className?.(value) || 'chip'} key={`${keyPrefix}-${value}`}>
          {value}
        </span>
      ))}
    </>
  );
}

function renderCategoryPropertyClass(category: DiffImpactCategory, value: string): string {
  const matched = category.matchedProperties.some((property) => property === value);
  return `chip ${matched ? 'chipReview impactCategoryPropertyMatched' : 'impactCategoryPropertyMuted'}`;
}

interface ResultsImpactDialogProps {
  row: DiffRow;
  onClose: () => void;
}

export function ResultsImpactDialog({ row, onClose }: ResultsImpactDialogProps) {
  return (
    <div className="screenModalLayer" role="presentation">
      <button
        type="button"
        className="screenModalBackdrop"
        aria-label="Close change impact dialog"
        onClick={onClose}
      />
      <section
        className="screenModalCard panel impactDialogModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="results-impact-dialog-title"
        data-testid="results-impact-dialog"
      >
        <div className="screenModalHeader impactDialogModalHeader">
          <div className="impactDialogTitleGroup">
            <p className="missionShellEyebrow">Change Impact Classification</p>
            <h2 className="adminSectionTitle" id="results-impact-dialog-title">
              {row.keyFields.partNumber || row.rowId}
            </h2>
            <p className="p impactDialogTitleDescription">{row.keyFields.description || 'No description'}</p>
          </div>
          <button
            className="adminIconButton"
            type="button"
            aria-label="Close change impact dialog"
            title="Close"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="impactDialogHero">
          <div className="impactDialogHeroSummaryColumn">
            <div className="impactDialogHeroBlock">
              <span className="impactDialogLabel">Impact criticality</span>
              <span className={impactCriticalityBadgeClass(row.impactClassification?.impactCriticality)}>
                {row.impactClassification?.impactCriticality || 'None'}
              </span>
            </div>
            <div className="impactDialogHeroBlock">
              <span className="impactDialogLabel">Impact class</span>
              <strong>{row.impactClassification?.highestImpactClass || '-'}</strong>
            </div>
          </div>
          <div className="impactDialogHeroBlock impactDialogHeroBlockWide">
            <span className="impactDialogLabel">Changed properties</span>
            <div className="cellChips">
              {renderChipList(row.rationale.changedFields, row.rowId)}
            </div>
          </div>
        </div>

        <div className="impactDialogGrid">
          {(row.impactClassification?.categories || []).map((category) => (
            <article className="impactDialogCard" key={`${row.rowId}-${category.category}`}>
              <div className="impactDialogCardHeader">
                <div className="impactDialogCardTitleGroup">
                  <h3 className="impactDialogCardTitle">{category.category}</h3>
                  <p className="p impactDialogCardDescription">{category.changeDescription}</p>
                </div>
              </div>
              <div className="impactDialogDetailGrid">
                <div className="impactDialogSectionBlock impactDialogSectionBlockWide">
                  <h4 className="taxonomySectionTitle">Properties in this Category</h4>
                  <div className="cellChips">
                    {renderChipList(category.triggerProperties, `${category.category}-trigger`, (value) =>
                      renderCategoryPropertyClass(category, value)
                    )}
                  </div>
                </div>
                <div className="impactDialogSectionBlock">
                  <h4 className="taxonomySectionTitle">Internal reviewers</h4>
                  <div className="cellChips">
                    {renderChipList(category.internalApprovingRoles, `${category.category}-internal`)}
                  </div>
                </div>
                <div className="impactDialogSectionBlock">
                  <h4 className="taxonomySectionTitle">External reviewers</h4>
                  <div className="cellChips">
                    {renderChipList(category.externalApprovingRoles, `${category.category}-external`)}
                  </div>
                </div>
                <div className="impactDialogSectionBlock">
                  <h4 className="taxonomySectionTitle">Compliance trigger</h4>
                  <strong>{category.complianceTrigger || '-'}</strong>
                </div>
                <div className="impactDialogSectionBlock">
                  <h4 className="taxonomySectionTitle">Control path</h4>
                  <strong>{category.controlPath || '-'}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
