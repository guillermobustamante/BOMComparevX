import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionState } from '../auth/session-user.interface';
import { AuditService } from '../audit/audit.service';
import { SharesService } from './shares.service';

@Controller('shares')
export class SharesController {
  constructor(
    private readonly sharesService: SharesService,
    private readonly auditService: AuditService
  ) {}

  @Get(':comparisonId')
  @UseGuards(SessionAuthGuard)
  async listShares(
    @Req() req: Request,
    @Param('comparisonId') comparisonId: string
  ): Promise<{
    comparisonId: string;
    recipients: Array<{
      invitedEmail: string;
      permission: 'view';
      createdAtUtc: string;
      updatedAtUtc: string;
    }>;
  }> {
    this.ensureFeatureEnabled(
      'sharing_stage5_v1',
      'SHARING_STAGE5_DISABLED',
      'Stage 5 sharing is currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    const rows = await this.sharesService.listByComparison(tenantId, comparisonId, actorEmail);
    return {
      comparisonId,
      recipients: rows.map((row) => ({
        invitedEmail: row.invitedEmail,
        permission: row.permission,
        createdAtUtc: row.createdAtUtc,
        updatedAtUtc: row.updatedAtUtc
      }))
    };
  }

  @Post('invite')
  @UseGuards(SessionAuthGuard)
  async invite(
    @Req() req: Request,
    @Body()
    body: { comparisonId?: string; invitedEmails?: string[] }
  ): Promise<{
    comparisonId: string;
    invited: Array<{ invitedEmail: string; permission: 'view'; createdAtUtc: string }>;
  }> {
    this.ensureFeatureEnabled(
      'sharing_stage5_v1',
      'SHARING_STAGE5_DISABLED',
      'Stage 5 sharing is currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    const comparisonId = (body.comparisonId || '').trim();
    const invitedEmails = Array.isArray(body.invitedEmails) ? body.invitedEmails : [];

    const invited = await this.sharesService.inviteRecipients({
      tenantId,
      comparisonId,
      actorEmail,
      invitedEmails
    });
    this.auditService.emit({
      eventType: 'share.invite',
      outcome: 'success',
      actorEmail,
      tenantId,
      reason: `comparison=${comparisonId};count=${invited.length}`,
      correlationId: comparisonId
    });
    return {
      comparisonId,
      invited: invited.map((row) => ({
        invitedEmail: row.invitedEmail,
        permission: row.permission,
        createdAtUtc: row.createdAtUtc
      }))
    };
  }

  @Post('revoke')
  @UseGuards(SessionAuthGuard)
  async revoke(
    @Req() req: Request,
    @Body()
    body: { comparisonId?: string; invitedEmails?: string[] }
  ): Promise<{
    comparisonId: string;
    revoked: Array<{ invitedEmail: string; revokedAtUtc: string | null }>;
  }> {
    this.ensureFeatureEnabled(
      'sharing_stage5_v1',
      'SHARING_STAGE5_DISABLED',
      'Stage 5 sharing is currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    const comparisonId = (body.comparisonId || '').trim();
    const invitedEmails = Array.isArray(body.invitedEmails) ? body.invitedEmails : [];

    const revoked = await this.sharesService.revokeRecipients({
      tenantId,
      comparisonId,
      actorEmail,
      invitedEmails
    });
    this.auditService.emit({
      eventType: 'share.revoke',
      outcome: 'success',
      actorEmail,
      tenantId,
      reason: `comparison=${comparisonId};count=${revoked.length}`,
      correlationId: comparisonId
    });
    return {
      comparisonId,
      revoked: revoked.map((row) => ({
        invitedEmail: row.invitedEmail,
        revokedAtUtc: row.revokedAtUtc
      }))
    };
  }

  private ensureFeatureEnabled(flagName: string, code: string, message: string): void {
    if (this.flagEnabled(flagName)) return;
    throw new HttpException(
      {
        code,
        message,
        correlationId: randomUUID(),
        featureFlag: flagName
      },
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }

  private flagEnabled(flagName: string): boolean {
    const candidateKeys = [flagName, flagName.toUpperCase()];
    const raw = candidateKeys.map((key) => process.env[key]).find((value) => value !== undefined);
    if (!raw) return true;
    const normalized = raw.trim().toLowerCase();
    return !['false', '0', 'off', 'no'].includes(normalized);
  }
}
