import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionState } from '../auth/session-user.interface';
import { ExportsService } from './exports.service';

@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get('csv/:comparisonId')
  @UseGuards(SessionAuthGuard)
  downloadComparisonCsv(
    @Req() req: Request,
    @Param('comparisonId') comparisonId: string,
    @Res({ passthrough: true }) response: Response
  ): string {
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const requestedBy = session.user?.email || 'unknown-user';
    const payload = this.exportsService.buildComparisonCsv({
      comparisonId,
      tenantId,
      requestedBy
    });

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);
    response.setHeader('Cache-Control', 'no-store');
    return payload.content;
  }

  @Get('excel/:comparisonId')
  @UseGuards(SessionAuthGuard)
  downloadComparisonExcel(
    @Req() req: Request,
    @Param('comparisonId') comparisonId: string,
    @Res() response: Response
  ): void {
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const requestedBy = session.user?.email || 'unknown-user';
    const payload = this.exportsService.buildComparisonExcel({
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
  }
}
