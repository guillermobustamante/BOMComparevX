import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { ComparisonAccessResult, ComparisonShareRecord } from './share-record.interface';

interface OwnerContext {
  tenantId: string;
  ownerEmail: string;
}

@Injectable()
export class SharesService {
  constructor(private readonly databaseService: DatabaseService) {}

  private readonly sharesByKey = new Map<string, ComparisonShareRecord>();
  private readonly comparisonOwners = new Map<string, OwnerContext>();

  registerOwnerContext(input: { tenantId: string; comparisonId: string; ownerEmail: string }): void {
    this.comparisonOwners.set(input.comparisonId, {
      tenantId: input.tenantId,
      ownerEmail: this.normalizeEmail(input.ownerEmail)
    });
  }

  async listByComparison(
    tenantId: string,
    comparisonId: string,
    actorEmail: string
  ): Promise<ComparisonShareRecord[]> {
    await this.assertOwnerAccess(tenantId, comparisonId, actorEmail);
    const records = await this.loadComparisonRecords(tenantId, comparisonId);
    return records
      .filter((row) => !row.revokedAtUtc)
      .sort((a, b) => a.invitedEmail.localeCompare(b.invitedEmail));
  }

  async inviteRecipients(input: {
    tenantId: string;
    comparisonId: string;
    actorEmail: string;
    invitedEmails: string[];
  }): Promise<ComparisonShareRecord[]> {
    const ownerEmail = await this.assertOwnerAccess(input.tenantId, input.comparisonId, input.actorEmail);
    const now = new Date().toISOString();
    const normalized = this.normalizeEmailList(input.invitedEmails).filter((email) => email !== ownerEmail);
    const affected: ComparisonShareRecord[] = [];

    for (const invitedEmail of normalized) {
      const key = this.shareKey(input.tenantId, input.comparisonId, invitedEmail);
      const existing = this.sharesByKey.get(key);
      const next: ComparisonShareRecord = existing
        ? {
            ...existing,
            ownerEmail,
            permission: 'view',
            revokedAtUtc: null,
            revokedBy: null,
            updatedAtUtc: now
          }
        : {
            shareId: randomUUID(),
            tenantId: input.tenantId,
            comparisonId: input.comparisonId,
            ownerEmail,
            invitedEmail,
            permission: 'view',
            createdAtUtc: now,
            updatedAtUtc: now,
            revokedAtUtc: null,
            createdBy: this.normalizeEmail(input.actorEmail),
            revokedBy: null
          };
      this.sharesByKey.set(key, next);
      affected.push(next);

      if (this.databaseService.enabled) {
        await this.databaseService.client.comparisonShare.upsert({
          where: {
            tenantId_comparisonId_invitedEmail: {
              tenantId: input.tenantId,
              comparisonId: input.comparisonId,
              invitedEmail
            }
          },
          update: {
            ownerEmail,
            permission: 'view',
            revokedAtUtc: null,
            revokedBy: null,
            updatedAtUtc: new Date(now)
          },
          create: {
            shareId: next.shareId,
            tenantId: input.tenantId,
            comparisonId: input.comparisonId,
            ownerEmail,
            invitedEmail,
            permission: 'view',
            createdAtUtc: new Date(now),
            updatedAtUtc: new Date(now),
            createdBy: this.normalizeEmail(input.actorEmail)
          }
        });
      }
    }

    return affected;
  }

  async revokeRecipients(input: {
    tenantId: string;
    comparisonId: string;
    actorEmail: string;
    invitedEmails: string[];
  }): Promise<ComparisonShareRecord[]> {
    await this.assertOwnerAccess(input.tenantId, input.comparisonId, input.actorEmail);
    const now = new Date().toISOString();
    const normalized = this.normalizeEmailList(input.invitedEmails);
    const affected: ComparisonShareRecord[] = [];

    for (const invitedEmail of normalized) {
      const key = this.shareKey(input.tenantId, input.comparisonId, invitedEmail);
      const existing = this.sharesByKey.get(key);
      if (!existing) continue;
      const revoked: ComparisonShareRecord = {
        ...existing,
        revokedAtUtc: now,
        revokedBy: this.normalizeEmail(input.actorEmail),
        updatedAtUtc: now
      };
      this.sharesByKey.set(key, revoked);
      affected.push(revoked);

      if (this.databaseService.enabled) {
        await this.databaseService.client.comparisonShare.updateMany({
          where: {
            tenantId: input.tenantId,
            comparisonId: input.comparisonId,
            invitedEmail
          },
          data: {
            revokedAtUtc: new Date(now),
            revokedBy: this.normalizeEmail(input.actorEmail),
            updatedAtUtc: new Date(now)
          }
        });
      }
    }

    return affected;
  }

  async canAccessComparison(
    tenantId: string,
    comparisonId: string,
    actorEmail: string
  ): Promise<ComparisonAccessResult> {
    const normalizedActor = this.normalizeEmail(actorEmail);
    const owner = await this.getOwnerContext(tenantId, comparisonId);
    if (owner && owner.ownerEmail === normalizedActor) {
      return { allowed: true, role: 'owner' };
    }

    const key = this.shareKey(tenantId, comparisonId, normalizedActor);
    const inMemory = this.sharesByKey.get(key);
    if (inMemory && !inMemory.revokedAtUtc) {
      return { allowed: true, role: 'invitee' };
    }

    if (this.databaseService.enabled) {
      const row = await this.databaseService.client.comparisonShare.findFirst({
        where: {
          tenantId,
          comparisonId,
          invitedEmail: normalizedActor,
          revokedAtUtc: null
        }
      });
      if (row) {
        const mapped = this.fromRow(row);
        this.sharesByKey.set(key, mapped);
        return { allowed: true, role: 'invitee' };
      }
    }

    return { allowed: false, role: null };
  }

  async assertOwnerAccess(tenantId: string, comparisonId: string, actorEmail: string): Promise<string> {
    const owner = await this.getOwnerContext(tenantId, comparisonId);
    if (!owner) {
      throw new NotFoundException({
        code: 'SHARE_COMPARISON_NOT_FOUND',
        message: 'Comparison cannot be shared because it was not found.',
        correlationId: randomUUID()
      });
    }

    const normalizedActor = this.normalizeEmail(actorEmail);
    if (owner.tenantId !== tenantId) {
      throw new ForbiddenException({
        code: 'TENANT_ACCESS_DENIED',
        message: 'Cross-tenant access is not allowed.',
        correlationId: randomUUID()
      });
    }
    if (owner.ownerEmail !== normalizedActor) {
      throw new ForbiddenException({
        code: 'SHARE_OWNER_REQUIRED',
        message: 'Only the comparison owner can manage sharing.',
        correlationId: randomUUID()
      });
    }
    return owner.ownerEmail;
  }

  async purgeRevokedRecords(cutoffUtcIso?: string): Promise<number> {
    const cutoff = cutoffUtcIso ? new Date(cutoffUtcIso) : null;
    let removed = 0;

    for (const [key, row] of this.sharesByKey.entries()) {
      if (!row.revokedAtUtc) continue;
      if (cutoff && new Date(row.revokedAtUtc) >= cutoff) continue;
      this.sharesByKey.delete(key);
      removed += 1;
    }

    if (this.databaseService.enabled) {
      const result = await this.databaseService.client.comparisonShare.deleteMany({
        where: {
          revokedAtUtc: cutoff ? { lt: cutoff } : { not: null }
        }
      });
      return result.count;
    }

    return removed;
  }

  async purgeByComparison(tenantId: string, comparisonId: string): Promise<number> {
    const keysToDelete = [...this.sharesByKey.keys()].filter((key) =>
      key.startsWith(`${tenantId}::${comparisonId}::`)
    );
    for (const key of keysToDelete) {
      this.sharesByKey.delete(key);
    }
    this.comparisonOwners.delete(comparisonId);

    if (this.databaseService.enabled) {
      const result = await this.databaseService.client.comparisonShare.deleteMany({
        where: {
          tenantId,
          comparisonId
        }
      });
      return result.count;
    }

    return keysToDelete.length;
  }

  private async getOwnerContext(tenantId: string, comparisonId: string): Promise<OwnerContext | null> {
    const context = this.comparisonOwners.get(comparisonId);
    if (context && context.tenantId === tenantId) {
      return context;
    }

    const knownRows = await this.loadComparisonRecords(tenantId, comparisonId);
    if (knownRows.length === 0) {
      return null;
    }
    const ownerEmail = knownRows[0].ownerEmail;
    const next = { tenantId, ownerEmail };
    this.comparisonOwners.set(comparisonId, next);
    return next;
  }

  private async loadComparisonRecords(
    tenantId: string,
    comparisonId: string
  ): Promise<ComparisonShareRecord[]> {
    const matches = [...this.sharesByKey.values()].filter(
      (row) => row.tenantId === tenantId && row.comparisonId === comparisonId
    );
    if (matches.length > 0 || !this.databaseService.enabled) {
      return matches;
    }

    const rows = await this.databaseService.client.comparisonShare.findMany({
      where: {
        tenantId,
        comparisonId
      }
    });
    const mapped = rows.map((row: Parameters<typeof this.fromRow>[0]) => this.fromRow(row));
    for (const row of mapped) {
      this.sharesByKey.set(this.shareKey(row.tenantId, row.comparisonId, row.invitedEmail), row);
    }
    return mapped;
  }

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
  }

  private normalizeEmailList(values: string[]): string[] {
    const unique = new Set<string>();
    for (const value of values) {
      const normalized = this.normalizeEmail(value);
      if (!normalized) continue;
      unique.add(normalized);
    }
    return [...unique];
  }

  private shareKey(tenantId: string, comparisonId: string, invitedEmail: string): string {
    return `${tenantId}::${comparisonId}::${this.normalizeEmail(invitedEmail)}`;
  }

  private fromRow(row: {
    shareId: string;
    tenantId: string;
    comparisonId: string;
    ownerEmail: string;
    invitedEmail: string;
    permission: string;
    createdAtUtc: Date;
    updatedAtUtc: Date;
    revokedAtUtc: Date | null;
    createdBy: string | null;
    revokedBy: string | null;
  }): ComparisonShareRecord {
    return {
      shareId: row.shareId,
      tenantId: row.tenantId,
      comparisonId: row.comparisonId,
      ownerEmail: row.ownerEmail,
      invitedEmail: row.invitedEmail,
      permission: row.permission === 'view' ? 'view' : 'view',
      createdAtUtc: row.createdAtUtc.toISOString(),
      updatedAtUtc: row.updatedAtUtc.toISOString(),
      revokedAtUtc: row.revokedAtUtc ? row.revokedAtUtc.toISOString() : null,
      createdBy: row.createdBy,
      revokedBy: row.revokedBy
    };
  }
}
