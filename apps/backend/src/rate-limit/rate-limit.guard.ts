import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { SessionState } from '../auth/session-user.interface';
import { RateLimitService } from './rate-limit.service';

interface EffectivePolicy {
  name: 'baseline' | 'upload' | 'diff' | 'export';
  limit: number;
}

interface RequestIdentity {
  key: string;
  scope: 'tenant' | 'ip';
  actorEmail?: string;
  tenantId?: string;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly auditService: AuditService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    if (!this.isEnabled()) {
      return true;
    }

    const identity = this.resolveIdentity(request);
    if (this.isExempt(identity)) {
      this.auditService.emit({
        eventType: 'rate_limit.exempt',
        outcome: 'success',
        actorEmail: identity.actorEmail,
        tenantId: identity.tenantId,
        reason: `keyScope=${identity.scope}`,
        correlationId: randomUUID()
      });
      return true;
    }

    const routePath = this.getRoutePath(request);
    const policy = this.resolvePolicy(routePath);
    const decision = this.rateLimitService.consume(
      `${policy.name}:${identity.scope}:${identity.key}`,
      policy.limit
    );

    if (decision.allowed) {
      return true;
    }

    const now = Date.now();
    const retryAfterSeconds = Math.max(1, Math.ceil((decision.resetAtMs - now) / 1_000));
    response.setHeader('Retry-After', String(retryAfterSeconds));

    const correlationId = randomUUID();
    this.auditService.emit({
      eventType: 'rate_limit.exceeded',
      outcome: 'denied',
      actorEmail: identity.actorEmail,
      tenantId: identity.tenantId,
      reason: `policy=${policy.name};limit=${decision.limit};route=${routePath};keyScope=${identity.scope};retryAfterSec=${retryAfterSeconds}`,
      correlationId
    });

    throw new HttpException(
      {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Request rate limit exceeded. Try again later.',
        correlationId,
        policy: {
          name: policy.name,
          keyScope: identity.scope,
          limit: decision.limit,
          windowSec: 60,
          retryAfterSec: retryAfterSeconds
        }
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  private isEnabled(): boolean {
    if (!this.flagEnabled('RATE_LIMITING_V1', true)) return false;
    if (process.env.NODE_ENV === 'test' && !this.flagEnabled('RATE_LIMITING_IN_TEST', false)) {
      return false;
    }
    return true;
  }

  private flagEnabled(key: string, defaultValue: boolean): boolean {
    const raw = process.env[key];
    if (!raw) return defaultValue;
    const normalized = raw.trim().toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }

  private resolvePolicy(routePath: string): EffectivePolicy {
    const baseline = this.parsePositiveInt(process.env.RATE_LIMIT_BASELINE_RPM, 100);
    const upload = this.parsePositiveInt(process.env.RATE_LIMIT_UPLOAD_RPM, 80);
    const diff = this.parsePositiveInt(process.env.RATE_LIMIT_DIFF_RPM, 90);
    const exportLimit = this.parsePositiveInt(process.env.RATE_LIMIT_EXPORT_RPM, 60);

    if (routePath.startsWith('/api/uploads/')) {
      return { name: 'upload', limit: Math.min(baseline, upload) };
    }
    if (routePath.startsWith('/api/diff-jobs')) {
      return { name: 'diff', limit: Math.min(baseline, diff) };
    }
    if (routePath.startsWith('/api/exports/')) {
      return { name: 'export', limit: Math.min(baseline, exportLimit) };
    }
    return { name: 'baseline', limit: baseline };
  }

  private resolveIdentity(request: Request): RequestIdentity {
    const session = request.session as SessionState | undefined;
    const tenantId = session?.user?.tenantId?.trim();
    const actorEmail = session?.user?.email?.trim();
    if (tenantId) {
      return {
        key: tenantId.toLowerCase(),
        scope: 'tenant',
        actorEmail,
        tenantId
      };
    }
    return {
      key: this.extractClientIp(request),
      scope: 'ip'
    };
  }

  private isExempt(identity: RequestIdentity): boolean {
    const exemptTenantIds = this.csvSet('RATE_LIMIT_EXEMPT_TENANT_IDS');
    const exemptEmails = this.csvSet('RATE_LIMIT_EXEMPT_EMAILS');

    if (identity.tenantId && exemptTenantIds.has(identity.tenantId.toLowerCase())) return true;
    if (identity.actorEmail && exemptEmails.has(identity.actorEmail.toLowerCase())) return true;
    return false;
  }

  private csvSet(key: string): Set<string> {
    const raw = process.env[key];
    if (!raw?.trim()) return new Set();
    return new Set(
      raw
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0)
    );
  }

  private getRoutePath(request: Request): string {
    const original = request.originalUrl || request.url || '/';
    const routePath = original.split('?')[0];
    return routePath.startsWith('/') ? routePath : `/${routePath}`;
  }

  private extractClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const firstForwarded = forwardedValue?.split(',')[0]?.trim();
    const rawIp = firstForwarded || request.ip || request.socket.remoteAddress || 'unknown-ip';
    return rawIp.replace(/^::ffff:/, '').toLowerCase();
  }

  private parsePositiveInt(raw: string | undefined, fallback: number): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
  }
}
