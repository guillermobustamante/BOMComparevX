import { Controller, ForbiddenException, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
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
    private readonly sharesService: SharesService
  ) {}

  @Get('csv/:comparisonId')
  @UseGuards(SessionAuthGuard)
  async downloadComparisonCsv(
    @Req() req: Request,
    @Param('comparisonId') comparisonId: string,
    @Res({ passthrough: true }) response: Response
  ): Promise<string> {
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const requestedBy = session.user?.email || 'unknown-user';
    await this.ensureExportAccess(comparisonId, tenantId, requestedBy);
    const payload = this.exportsService.buildComparisonCsv({
      comparisonId,
      tenantId
    });

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);
    response.setHeader('Cache-Control', 'no-store');
    return payload.content;
  }

  @Get('excel/:comparisonId')
  @UseGuards(SessionAuthGuard)
  async downloadComparisonExcel(
    @Req() req: Request,
    @Param('comparisonId') comparisonId: string,
    @Res() response: Response
  ): Promise<void> {
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const requestedBy = session.user?.email || 'unknown-user';
    await this.ensureExportAccess(comparisonId, tenantId, requestedBy);
    const payload = this.exportsService.buildComparisonExcel({
      comparisonId,
      tenantId
    });

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    response.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);
    response.setHeader('Cache-Control', 'no-store');
    response.send(payload.content);
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
}
