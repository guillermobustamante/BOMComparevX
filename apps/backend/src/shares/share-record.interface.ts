export interface ComparisonShareRecord {
  shareId: string;
  tenantId: string;
  comparisonId: string;
  ownerEmail: string;
  invitedEmail: string;
  permission: 'view';
  createdAtUtc: string;
  updatedAtUtc: string;
  revokedAtUtc: string | null;
  createdBy: string | null;
  revokedBy: string | null;
}

export interface ComparisonAccessResult {
  allowed: boolean;
  role: 'owner' | 'invitee' | null;
}
