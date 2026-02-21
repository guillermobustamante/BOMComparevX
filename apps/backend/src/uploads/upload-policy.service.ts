import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

const UNRESTRICTED_COMPARISON_LIMIT = 3;
const DEFAULT_COOLDOWN_MS = 48 * 60 * 60 * 1000;

interface UploadPolicyState {
  comparisonsUsed: number;
  cooldownUntilUtc: string | null;
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

  async registerAcceptedValidation(userKey: string, tenantId = 'unknown-tenant'): Promise<UploadPolicySnapshot> {
    const current = await this.getState(userKey, tenantId);
    const isUnlimited = this.isUnlimitedUser(userKey);
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
    const isUnlimited = this.isUnlimitedUser(userKey);

    return {
      comparisonsUsed: current.comparisonsUsed,
      unrestrictedComparisonsRemaining: isUnlimited
        ? Number.MAX_SAFE_INTEGER
        : Math.max(0, UNRESTRICTED_COMPARISON_LIMIT - current.comparisonsUsed),
      cooldownUntilUtc: isUnlimited ? null : current.cooldownUntilUtc,
      isUnlimited
    };
  }

  private isUnlimitedUser(userKey: string): boolean {
    const normalized = userKey.trim().toLowerCase();
    if (!normalized) return false;
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
}
