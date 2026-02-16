export interface AuthResultDto {
  provider: 'google' | 'microsoft';
  email: string;
  displayName: string;
  tenantId: string;
  correlationId: string;
}
