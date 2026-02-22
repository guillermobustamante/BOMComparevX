import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

const UNRESTRICTED_COMPARISON_LIMIT = 3;
const DEFAULT_COOLDOWN_MS = 48 * 60 * 60 * 1000;

interface UploadPolicyState {
  comparisonsUsed: number;
  cooldownUntilUtc: string | null;
}

interface UploadPolicyOverrideState {
  isUnlimited: boolean;
  updatedAtUtc: string;
}

export interface UploadPolicySnapshot {
  comparisonsUsed: number;
  unrestrictedComparisonsRemaining: number;
  cooldownUntilUtc: string | null;
  isUnlimited: boolean;
}

@Injectable()
export class UploadPolicyService {
  constructor(private readonly databaseService: DatabaseService) {}

  private readonly userPolicyState = new Map<string, UploadPolicyState>();
  private readonly userPolicyOverrideState = new Map<string, UploadPolicyOverrideState>();

  async registerAcceptedValidation(userKey: string, tenantId = 'unknown-tenant'): Promise<UploadPolicySnapshot> {
    const current = await this.getState(userKey, tenantId);
    const isUnlimited = await this.isUnlimitedUser(userKey, tenantId);
    const nowMs = Date.now();
    const cooldownMs = this.cooldownMs();

    if (isUnlimited) {
      const next: UploadPolicyState = {
        comparisonsUsed: current.comparisonsUsed + 1,
        cooldownUntilUtc: null
      };
      await this.persistState(userKey, tenantId, next);
      return {
        comparisonsUsed: next.comparisonsUsed,
        unrestrictedComparisonsRemaining: Number.MAX_SAFE_INTEGER,
        cooldownUntilUtc: null,
        isUnlimited: true
      };
    }

    if (current.comparisonsUsed >= UNRESTRICTED_COMPARISON_LIMIT) {
      if (!current.cooldownUntilUtc) {
        const cooldownUntilUtc = new Date(nowMs + cooldownMs).toISOString();
        await this.persistState(userKey, tenantId, {
          ...current,
          cooldownUntilUtc
        });
        this.cooldownError(current.comparisonsUsed, cooldownUntilUtc);
      }

      const cooldownUntilMs = Date.parse(current.cooldownUntilUtc);
      if (!Number.isNaN(cooldownUntilMs) && nowMs < cooldownUntilMs) {
        this.cooldownError(current.comparisonsUsed, current.cooldownUntilUtc);
      }
    }

    const next: UploadPolicyState = {
      comparisonsUsed: current.comparisonsUsed + 1,
      cooldownUntilUtc:
        current.comparisonsUsed + 1 > UNRESTRICTED_COMPARISON_LIMIT
          ? new Date(nowMs + cooldownMs).toISOString()
          : current.cooldownUntilUtc
    };
    await this.persistState(userKey, tenantId, next);

    return {
      comparisonsUsed: next.comparisonsUsed,
      unrestrictedComparisonsRemaining: Math.max(0, UNRESTRICTED_COMPARISON_LIMIT - next.comparisonsUsed),
      cooldownUntilUtc: next.cooldownUntilUtc,
      isUnlimited: false
    };
  }

  async getPolicy(userKey: string, tenantId = 'unknown-tenant'): Promise<UploadPolicySnapshot> {
    const current = await this.getState(userKey, tenantId);
    const isUnlimited = await this.isUnlimitedUser(userKey, tenantId);

    return {
      comparisonsUsed: current.comparisonsUsed,
      unrestrictedComparisonsRemaining: isUnlimited
        ? Number.MAX_SAFE_INTEGER
        : Math.max(0, UNRESTRICTED_COMPARISON_LIMIT - current.comparisonsUsed),
      cooldownUntilUtc: isUnlimited ? null : current.cooldownUntilUtc,
      isUnlimited
    };
  }

  async setAdminOverride(input: {
    tenantId: string;
    userKey: string;
    isUnlimited: boolean;
    reason?: string;
    actorEmail?: string;
  }): Promise<UploadPolicySnapshot> {
    const normalizedUser = input.userKey.trim().toLowerCase();
    const updatedAtUtc = new Date().toISOString();
    const key = this.overrideMapKey(input.tenantId, normalizedUser);
    this.userPolicyOverrideState.set(key, {
      isUnlimited: input.isUnlimited,
      updatedAtUtc
    });

    if (this.databaseService.enabled) {
      await this.databaseService.client.uploadPolicyOverride.upsert({
        where: {
          tenantId_userKey: {
            tenantId: input.tenantId,
            userKey: normalizedUser
          }
        },
        update: {
          isUnlimited: input.isUnlimited,
          reason: input.reason || null,
          createdBy: input.actorEmail || null,
          updatedAtUtc: new Date(updatedAtUtc)
        },
        create: {
          overrideId: randomUUID(),
          tenantId: input.tenantId,
          userKey: normalizedUser,
          isUnlimited: input.isUnlimited,
          reason: input.reason || null,
          createdBy: input.actorEmail || null,
          createdAtUtc: new Date(updatedAtUtc),
          updatedAtUtc: new Date(updatedAtUtc)
        }
      });
    }

    return this.getPolicy(normalizedUser, input.tenantId);
  }

  async resetPolicyForUser(tenantId: string, userKey: string): Promise<UploadPolicySnapshot> {
    const normalizedUser = userKey.trim().toLowerCase();
    const reset: UploadPolicyState = {
      comparisonsUsed: 0,
      cooldownUntilUtc: null
    };
    await this.persistState(normalizedUser, tenantId, reset);
    return this.getPolicy(normalizedUser, tenantId);
  }

  async listKnownUsers(tenantId: string, query?: string): Promise<string[]> {
    const q = (query || '').trim().toLowerCase();
    const users = new Set<string>();

    for (const [key] of this.userPolicyState) {
      if (!q || key.includes(q)) users.add(key);
    }

    for (const key of this.userPolicyOverrideState.keys()) {
      const [tenant, userKey] = key.split('::');
      if (tenant !== tenantId) continue;
      if (!q || userKey.includes(q)) users.add(userKey);
    }

    if (this.databaseService.enabled) {
      const [policyRows, overrideRows, jobRows] = await Promise.all([
        this.databaseService.client.uploadPolicy.findMany({
          where: {
            tenantId,
            ...(q ? { userKey: { contains: q } } : {})
          },
          select: { userKey: true }
        }),
        this.databaseService.client.uploadPolicyOverride.findMany({
          where: {
            tenantId,
            ...(q ? { userKey: { contains: q } } : {})
          },
          select: { userKey: true }
        }),
        this.databaseService.client.jobRun.findMany({
          where: {
            tenantId,
            ...(q ? { requestedBy: { contains: q } } : {})
          },
          select: { requestedBy: true }
        })
      ]);
      for (const row of policyRows) users.add(row.userKey.toLowerCase());
      for (const row of overrideRows) users.add(row.userKey.toLowerCase());
      for (const row of jobRows) users.add(row.requestedBy.toLowerCase());
    }

    return [...users].sort((a, b) => a.localeCompare(b));
  }

  private async isUnlimitedUser(userKey: string, tenantId: string): Promise<boolean> {
    const normalized = userKey.trim().toLowerCase();
    if (!normalized) return false;

    const override = await this.getOverride(tenantId, normalized);
    if (override) return override.isUnlimited;

    const raw = process.env.UPLOAD_UNLIMITED_USER_EMAILS || '';
    const allowed = raw
      .split(/[,\n;]+/)
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0);
    return allowed.includes(normalized);
  }

  private cooldownMs(): number {
    const raw = process.env.UPLOAD_COOLDOWN_MS;
    if (!raw) return DEFAULT_COOLDOWN_MS;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_COOLDOWN_MS;
    return parsed;
  }

  private cooldownError(comparisonsUsed: number, cooldownUntilUtc: string): never {
    throw new HttpException(
      {
        code: 'UPLOAD_COOLDOWN_ACTIVE',
        message: 'Uploads are blocked by cooldown policy.',
        correlationId: randomUUID(),
        comparisonsUsed,
        unrestrictedComparisonsRemaining: 0,
        cooldownUntilUtc
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  private async getState(userKey: string, tenantId: string): Promise<UploadPolicyState> {
    const inMemory = this.userPolicyState.get(userKey);
    if (inMemory && !this.databaseService.enabled) return inMemory;

    if (this.databaseService.enabled) {
      const persisted = await this.databaseService.client.uploadPolicy.findFirst({
        where: { tenantId, userKey }
      });
      if (persisted) {
        const mapped = {
          comparisonsUsed: persisted.comparisonsUsed,
          cooldownUntilUtc: persisted.cooldownUntilUtc ? persisted.cooldownUntilUtc.toISOString() : null
        };
        this.userPolicyState.set(userKey, mapped);
        return mapped;
      }
    }

    const initial = {
      comparisonsUsed: 0,
      cooldownUntilUtc: null
    };
    this.userPolicyState.set(userKey, initial);
    return initial;
  }

  private async persistState(userKey: string, tenantId: string, state: UploadPolicyState): Promise<void> {
    this.userPolicyState.set(userKey, state);
    if (!this.databaseService.enabled) return;

    await this.databaseService.client.uploadPolicy.upsert({
      where: {
        tenantId_userKey: {
          tenantId,
          userKey
        }
      },
      update: {
        comparisonsUsed: state.comparisonsUsed,
        cooldownUntilUtc: state.cooldownUntilUtc ? new Date(state.cooldownUntilUtc) : null,
        updatedAtUtc: new Date()
      },
      create: {
        id: randomUUID(),
        tenantId,
        userKey,
        comparisonsUsed: state.comparisonsUsed,
        cooldownUntilUtc: state.cooldownUntilUtc ? new Date(state.cooldownUntilUtc) : null,
        updatedAtUtc: new Date()
      }
    });
  }

  private async getOverride(tenantId: string, userKey: string): Promise<UploadPolicyOverrideState | null> {
    const key = this.overrideMapKey(tenantId, userKey);
    const inMemory = this.userPolicyOverrideState.get(key);
    if (inMemory && !this.databaseService.enabled) return inMemory;

    if (this.databaseService.enabled) {
      const row = await this.databaseService.client.uploadPolicyOverride.findUnique({
        where: {
          tenantId_userKey: {
            tenantId,
            userKey
          }
        }
      });
      if (!row) return null;
      const mapped = {
        isUnlimited: row.isUnlimited,
        updatedAtUtc: row.updatedAtUtc.toISOString()
      };
      this.userPolicyOverrideState.set(key, mapped);
      return mapped;
    }

    return inMemory || null;
  }

  private overrideMapKey(tenantId: string, userKey: string): string {
    return `${tenantId}::${userKey.trim().toLowerCase()}`;
  }
}
