export interface AuthResultDto {
  provider: 'google' | 'microsoft';
  email: string;
  displayName: string;
  correlationId: string;
}
