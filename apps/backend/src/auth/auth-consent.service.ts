import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

export interface ConsentStatus {
  consentTrackingEnabled: boolean;
  consentRequired: boolean;
  termsVersion: string;
  privacyVersion: string;
  termsUrl: string;
  privacyUrl: string;
  acceptedAtUtc: string | null;
}

@Injectable()
export class AuthConsentService {
  private readonly inMemoryAcceptances = new Map<string, string>();

  constructor(private readonly databaseService: DatabaseService) {}

  async getStatus(tenantId: string, userEmail: string): Promise<ConsentStatus> {
    const termsVersion = this.getTermsVersion();
    const privacyVersion = this.getPrivacyVersion();
    const termsUrl = this.getTermsUrl();
    const privacyUrl = this.getPrivacyUrl();

    if (!this.isEnabled()) {
      return {
        consentTrackingEnabled: false,
        consentRequired: false,
        termsVersion,
        privacyVersion,
        termsUrl,
        privacyUrl,
        acceptedAtUtc: null
      };
    }

    const acceptedAtUtc = await this.getAcceptanceTimestampUtc(
      tenantId,
      userEmail,
      termsVersion,
      privacyVersion
    );
    return {
      consentTrackingEnabled: true,
      consentRequired: !acceptedAtUtc,
      termsVersion,
      privacyVersion,
      termsUrl,
      privacyUrl,
      acceptedAtUtc
    };
  }

  async acceptCurrentVersions(tenantId: string, userEmail: string): Promise<ConsentStatus> {
    const termsVersion = this.getTermsVersion();
    const privacyVersion = this.getPrivacyVersion();
    const acceptedAtUtc = new Date().toISOString();

    if (this.isEnabled()) {
      if (this.databaseService.enabled) {
        const existing = await this.databaseService.client.consentAcceptance.findFirst({
          where: {
            tenantId,
            userEmail,
            termsVersion,
            privacyVersion
          },
          orderBy: {
            acceptedAtUtc: 'desc'
          }
        });

        if (!existing) {
          await this.databaseService.client.consentAcceptance.create({
            data: {
              consentId: randomUUID(),
              tenantId,
              userEmail,
              termsVersion,
              privacyVersion,
              acceptedAtUtc: new Date(acceptedAtUtc)
            }
          });
        }
      } else {
        this.inMemoryAcceptances.set(
          this.memoryKey(tenantId, userEmail, termsVersion, privacyVersion),
          acceptedAtUtc
        );
      }
    }

    return this.getStatus(tenantId, userEmail);
  }

  private isEnabled(): boolean {
    const raw = process.env.CONSENT_TRACKING_V1;
    if (!raw) return false;
    const normalized = raw.trim().toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }

  private getTermsVersion(): string {
    return process.env.TERMS_VERSION?.trim() || 'v1';
  }

  private getPrivacyVersion(): string {
    return process.env.PRIVACY_VERSION?.trim() || 'v1';
  }

  private getTermsUrl(): string {
    return process.env.TERMS_URL?.trim() || '/terms';
  }

  private getPrivacyUrl(): string {
    return process.env.PRIVACY_URL?.trim() || '/privacy';
  }

  private async getAcceptanceTimestampUtc(
    tenantId: string,
    userEmail: string,
    termsVersion: string,
    privacyVersion: string
  ): Promise<string | null> {
    if (this.databaseService.enabled) {
      const existing = await this.databaseService.client.consentAcceptance.findFirst({
        where: {
          tenantId,
          userEmail,
          termsVersion,
          privacyVersion
        },
        orderBy: {
          acceptedAtUtc: 'desc'
        }
      });
      return existing ? existing.acceptedAtUtc.toISOString() : null;
    }

    return (
      this.inMemoryAcceptances.get(
        this.memoryKey(tenantId, userEmail, termsVersion, privacyVersion)
      ) || null
    );
  }

  private memoryKey(
    tenantId: string,
    userEmail: string,
    termsVersion: string,
    privacyVersion: string
  ): string {
    return `${tenantId.toLowerCase()}::${userEmail.toLowerCase()}::${termsVersion}::${privacyVersion}`;
  }
}

