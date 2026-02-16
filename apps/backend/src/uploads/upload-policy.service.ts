import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

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
}

@Injectable()
export class UploadPolicyService {
  private readonly userPolicyState = new Map<string, UploadPolicyState>();

  registerAcceptedValidation(userKey: string): UploadPolicySnapshot {
    const current = this.userPolicyState.get(userKey) || {
      comparisonsUsed: 0,
      cooldownUntilUtc: null
    };
    const nowMs = Date.now();
    const cooldownMs = this.cooldownMs();

    if (current.comparisonsUsed >= UNRESTRICTED_COMPARISON_LIMIT) {
      if (!current.cooldownUntilUtc) {
        const cooldownUntilUtc = new Date(nowMs + cooldownMs).toISOString();
        this.userPolicyState.set(userKey, {
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
    this.userPolicyState.set(userKey, next);

    return {
      comparisonsUsed: next.comparisonsUsed,
      unrestrictedComparisonsRemaining: Math.max(0, UNRESTRICTED_COMPARISON_LIMIT - next.comparisonsUsed),
      cooldownUntilUtc: next.cooldownUntilUtc
    };
  }

  getPolicy(userKey: string): UploadPolicySnapshot {
    const current = this.userPolicyState.get(userKey) || {
      comparisonsUsed: 0,
      cooldownUntilUtc: null
    };

    return {
      comparisonsUsed: current.comparisonsUsed,
      unrestrictedComparisonsRemaining: Math.max(0, UNRESTRICTED_COMPARISON_LIMIT - current.comparisonsUsed),
      cooldownUntilUtc: current.cooldownUntilUtc
    };
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
}
