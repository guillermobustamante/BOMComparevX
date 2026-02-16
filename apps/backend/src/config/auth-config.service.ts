import { Inject, Injectable } from '@nestjs/common';
import { SecretProvider } from './secret-provider.interface';

@Injectable()
export class AuthConfigService {
  private initialized = false;
  private googleClientId = '';
  private googleClientSecret = '';
  private microsoftClientId = '';
  private microsoftClientSecret = '';

  constructor(@Inject(SecretProvider) private readonly secretProvider: SecretProvider) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.googleClientId = await this.resolveSecret(
      process.env.GOOGLE_CLIENT_ID_SECRET_NAME,
      process.env.GOOGLE_CLIENT_ID
    );
    this.googleClientSecret = await this.resolveSecret(
      process.env.GOOGLE_CLIENT_SECRET_SECRET_NAME,
      process.env.GOOGLE_CLIENT_SECRET
    );
    this.microsoftClientId = await this.resolveSecret(
      process.env.MICROSOFT_CLIENT_ID_SECRET_NAME,
      process.env.MICROSOFT_CLIENT_ID
    );
    this.microsoftClientSecret = await this.resolveSecret(
      process.env.MICROSOFT_CLIENT_SECRET_SECRET_NAME,
      process.env.MICROSOFT_CLIENT_SECRET
    );

    if (!this.googleClientId || !this.googleClientSecret) {
      throw new Error('Google OAuth configuration is missing.');
    }
    if (!this.microsoftClientId || !this.microsoftClientSecret) {
      throw new Error('Microsoft OAuth configuration is missing.');
    }

    this.initialized = true;
  }

  getGoogleClientId(): string {
    return this.googleClientId || process.env.GOOGLE_CLIENT_ID || '';
  }

  getGoogleClientSecret(): string {
    return this.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET || '';
  }

  getMicrosoftClientId(): string {
    return this.microsoftClientId || process.env.MICROSOFT_CLIENT_ID || '';
  }

  getMicrosoftClientSecret(): string {
    return this.microsoftClientSecret || process.env.MICROSOFT_CLIENT_SECRET || '';
  }

  getGoogleCallbackUrl(): string {
    return process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback';
  }

  getMicrosoftCallbackUrl(): string {
    return process.env.MICROSOFT_CALLBACK_URL || 'http://localhost:4000/api/auth/microsoft/callback';
  }

  getWebBaseUrl(): string {
    return process.env.WEB_BASE_URL || 'http://localhost:3000';
  }

  private async resolveSecret(secretName: string | undefined, localValue: string | undefined): Promise<string> {
    if (secretName) {
      const secretValue = await this.secretProvider.getSecret(secretName);
      if (secretValue) return secretValue;
    }
    return localValue || '';
  }
}
