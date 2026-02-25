import {
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionState } from '../auth/session-user.interface';
import { DiffJobService } from '../diff/diff-job.service';
import { SharesService } from '../shares/shares.service';
import { ExportsService } from './exports.service';

@Controller('exports')
export class ExportsController {
  constructor(
    private readonly exportsService: ExportsService,
    private readonly diffJobService: DiffJobService,
    private readonly sharesService: SharesService,
    private readonly auditService: AuditService
  ) {}

  @Get('csv/:comparisonId')
  @UseGuards(SessionAuthGuard)
  async downloadComparisonCsv(
    @Req() req: Request,
    @Param('comparisonId') comparisonId: string,
    @Res({ passthrough: true }) response: Response
  ): Promise<string> {
    this.ensureFeatureEnabled(
      'export_stage5_v1',
      'EXPORT_STAGE5_DISABLED',
      'Stage 5 exports are currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const requestedBy = session.user?.email || 'unknown-user';
    try {
      await this.ensureExportAccess(comparisonId, tenantId, requestedBy);
      const payload = await this.exportsService.buildComparisonCsv({
        comparisonId,
        tenantId,
        requestedBy
      });

      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);
      response.setHeader('Cache-Control', 'no-store');

      this.auditService.emit({
        eventType: 'export.download',
        outcome: 'success',
        actorEmail: requestedBy,
        tenantId,
        reason: `format=csv;comparison=${comparisonId}`,
        correlationId: randomUUID()
      });

      return payload.content;
    } catch (error) {
      this.auditService.emit({
        eventType: 'export.download',
        outcome: 'failure',
        actorEmail: requestedBy,
        tenantId,
        reason: `format=csv;comparison=${comparisonId}`,
        correlationId: randomUUID()
      });
      throw error;
    }
  }

  @Get('excel/:comparisonId')
  @UseGuards(SessionAuthGuard)
  async downloadComparisonExcel(
    @Req() req: Request,
    @Param('comparisonId') comparisonId: string,
    @Res() response: Response
  ): Promise<void> {
    this.ensureFeatureEnabled(
      'export_stage5_v1',
      'EXPORT_STAGE5_DISABLED',
      'Stage 5 exports are currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const requestedBy = session.user?.email || 'unknown-user';
    try {
      await this.ensureExportAccess(comparisonId, tenantId, requestedBy);
      const payload = await this.exportsService.buildComparisonExcel({
        comparisonId,
        tenantId,
        requestedBy
      });

      response.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      response.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);
      response.setHeader('Cache-Control', 'no-store');
      response.send(payload.content);

      this.auditService.emit({
        eventType: 'export.download',
        outcome: 'success',
        actorEmail: requestedBy,
        tenantId,
        reason: `format=excel;comparison=${comparisonId}`,
        correlationId: randomUUID()
      });
    } catch (error) {
      this.auditService.emit({
        eventType: 'export.download',
        outcome: 'failure',
        actorEmail: requestedBy,
        tenantId,
        reason: `format=excel;comparison=${comparisonId}`,
        correlationId: randomUUID()
      });
      throw error;
    }
  }

  private async ensureExportAccess(
    comparisonId: string,
    tenantId: string,
    actorEmail: string
  ): Promise<void> {
    const ownerEmail = this.diffJobService.getOwnerEmail(comparisonId, tenantId);
    if (ownerEmail === actorEmail) return;
    const shareAccess = await this.sharesService.canAccessComparison(tenantId, comparisonId, actorEmail);
    if (shareAccess.allowed) return;

    throw new ForbiddenException({
      code: 'EXPORT_ACCESS_DENIED',
      message: 'Access to this comparison export is not allowed.',
      correlationId: randomUUID()
    });
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
