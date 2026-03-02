export interface AuthResultDto {
  provider: 'google' | 'microsoft';
  email: string;
  displayName: string;
  tenantId: string;
  correlationId: string;
  consentTrackingEnabled?: boolean;
  consentRequired?: boolean;
  consent?: {
    termsVersion: string;
    privacyVersion: string;
    termsUrl: string;
    privacyUrl: string;
    acceptedAtUtc: string | null;
  };
}
