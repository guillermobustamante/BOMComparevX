import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionState } from '../auth/session-user.interface';
import { MappingPreviewContract } from './mapping-contract';
import { MappingPreviewService } from './mapping-preview.service';

@Controller('mappings')
export class MappingController {
  constructor(private readonly mappingPreviewService: MappingPreviewService) {}

  @Get('preview/:revisionId')
  @UseGuards(SessionAuthGuard)
  async preview(
    @Req() req: Request,
    @Param('revisionId') revisionId: string
  ): Promise<MappingPreviewContract> {
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    return this.mappingPreviewService.getPreview(revisionId, tenantId);
  }
}
