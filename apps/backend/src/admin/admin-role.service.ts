import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

interface RoleClaim {
  claimId: string;
  tenantId: string;
  userEmail: string;
  role: 'admin';
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  createdBy: string | null;
}

@Injectable()
export class AdminRoleService {
  constructor(private readonly databaseService: DatabaseService) {}

  private readonly claimsByKey = new Map<string, RoleClaim>();

  async hasAdminRole(tenantId: string, userEmail: string): Promise<boolean> {
    const normalized = this.normalizeEmail(userEmail);
    const key = this.claimKey(tenantId, normalized, 'admin');
    const inMemory = this.claimsByKey.get(key);
    if (inMemory && inMemory.isActive) return true;

    if (!this.databaseService.enabled) return false;
    const row = await this.databaseService.client.adminRoleClaim.findUnique({
      where: {
        tenantId_userEmail_role: {
          tenantId,
          userEmail: normalized,
          role: 'admin'
        }
      }
    });
    if (!row) return false;
    const mapped = this.fromRow(row);
    this.claimsByKey.set(key, mapped);
    return mapped.isActive;
  }

  async countActiveAdmins(tenantId: string): Promise<number> {
    if (!this.databaseService.enabled) {
      return [...this.claimsByKey.values()].filter((claim) => claim.tenantId === tenantId && claim.isActive).length;
    }

    return this.databaseService.client.adminRoleClaim.count({
      where: {
        tenantId,
        role: 'admin',
        isActive: true
      }
    });
  }

  async listActiveAdmins(tenantId: string): Promise<RoleClaim[]> {
    if (!this.databaseService.enabled) {
      return [...this.claimsByKey.values()]
        .filter((claim) => claim.tenantId === tenantId && claim.isActive)
        .sort((a, b) => a.userEmail.localeCompare(b.userEmail));
    }

    const rows = await this.databaseService.client.adminRoleClaim.findMany({
      where: {
        tenantId,
        role: 'admin',
        isActive: true
      },
      orderBy: { userEmail: 'asc' }
    });
    const claims = rows.map((row: Parameters<typeof this.fromRow>[0]) => this.fromRow(row));
    for (const claim of claims) {
      this.claimsByKey.set(this.claimKey(claim.tenantId, claim.userEmail, claim.role), claim);
    }
    return claims;
  }

  async grantAdminRole(input: {
    tenantId: string;
    userEmail: string;
    actorEmail?: string;
  }): Promise<void> {
    const normalized = this.normalizeEmail(input.userEmail);
    const now = new Date().toISOString();
    const key = this.claimKey(input.tenantId, normalized, 'admin');
    const next: RoleClaim = {
      claimId: randomUUID(),
      tenantId: input.tenantId,
      userEmail: normalized,
      role: 'admin',
      isActive: true,
      createdAtUtc: now,
      updatedAtUtc: now,
      createdBy: input.actorEmail ? this.normalizeEmail(input.actorEmail) : null
    };
    this.claimsByKey.set(key, next);

    if (this.databaseService.enabled) {
      await this.databaseService.client.adminRoleClaim.upsert({
        where: {
          tenantId_userEmail_role: {
            tenantId: input.tenantId,
            userEmail: normalized,
            role: 'admin'
          }
        },
        update: {
          isActive: true,
          updatedAtUtc: new Date(now),
          createdBy: next.createdBy
        },
        create: {
          claimId: next.claimId,
          tenantId: input.tenantId,
          userEmail: normalized,
          role: 'admin',
          isActive: true,
          createdAtUtc: new Date(now),
          updatedAtUtc: new Date(now),
          createdBy: next.createdBy
        }
      });
    }
  }

  async revokeAdminRole(input: {
    tenantId: string;
    userEmail: string;
    actorEmail?: string;
  }): Promise<void> {
    const normalized = this.normalizeEmail(input.userEmail);
    const now = new Date().toISOString();
    const key = this.claimKey(input.tenantId, normalized, 'admin');
    const existing = this.claimsByKey.get(key);
    if (existing) {
      this.claimsByKey.set(key, {
        ...existing,
        isActive: false,
        updatedAtUtc: now,
        createdBy: input.actorEmail ? this.normalizeEmail(input.actorEmail) : existing.createdBy
      });
    }

    if (this.databaseService.enabled) {
      await this.databaseService.client.adminRoleClaim.upsert({
        where: {
          tenantId_userEmail_role: {
            tenantId: input.tenantId,
            userEmail: normalized,
            role: 'admin'
          }
        },
        update: {
          isActive: false,
          updatedAtUtc: new Date(now),
          createdBy: input.actorEmail ? this.normalizeEmail(input.actorEmail) : null
        },
        create: {
          claimId: randomUUID(),
          tenantId: input.tenantId,
          userEmail: normalized,
          role: 'admin',
          isActive: false,
          createdAtUtc: new Date(now),
          updatedAtUtc: new Date(now),
          createdBy: input.actorEmail ? this.normalizeEmail(input.actorEmail) : null
        }
      });
    }
  }

  private claimKey(tenantId: string, userEmail: string, role: 'admin'): string {
    return `${tenantId}::${this.normalizeEmail(userEmail)}::${role}`;
  }

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
  }

  private fromRow(row: {
    claimId: string;
    tenantId: string;
    userEmail: string;
    role: string;
    isActive: boolean;
    createdAtUtc: Date;
    updatedAtUtc: Date;
    createdBy: string | null;
  }): RoleClaim {
    return {
      claimId: row.claimId,
      tenantId: row.tenantId,
      userEmail: row.userEmail,
      role: 'admin',
      isActive: row.isActive,
      createdAtUtc: row.createdAtUtc.toISOString(),
      updatedAtUtc: row.updatedAtUtc.toISOString(),
      createdBy: row.createdBy
    };
  }
}
