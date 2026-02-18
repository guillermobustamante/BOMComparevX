import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionState } from '../auth/session-user.interface';
import { MappingConfirmationContract, MappingPreviewContract, MappingSnapshotContract } from './mapping-contract';
import { MappingAuditService } from './mapping-audit.service';
import { MappingPersistenceService } from './mapping-persistence.service';
import { MappingPreviewService } from './mapping-preview.service';

@Controller('mappings')
export class MappingController {
  constructor(
    private readonly mappingPreviewService: MappingPreviewService,
    private readonly mappingPersistenceService: MappingPersistenceService,
    private readonly mappingAuditService: MappingAuditService
  ) {}

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

  @Post('confirm')
  @UseGuards(SessionAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async confirm(
    @Req() req: Request,
    @Body() payload: Omit<MappingConfirmationContract, 'actor'>
  ): Promise<{
    mappingId: string;
    revisionId: string;
    immutable: true;
    confirmedAtUtc: string;
  }> {
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actor = session.user?.email || 'unknown-user';
    const correlationId = randomUUID();
    const confirmed = await this.mappingPersistenceService.confirmRevisionMapping({
      tenantId,
      actor,
      payload: {
        ...payload,
        actor
      }
    });
    await this.mappingAuditService.recordConfirmation({
      tenantId,
      revisionId: payload.revisionId,
      actor,
      correlationId,
      payload: {
        ...payload,
        actor
      }
    });

    return {
      mappingId: confirmed.mappingId,
      revisionId: confirmed.revisionId,
      immutable: true,
      confirmedAtUtc: confirmed.confirmedAtUtc
    };
  }

  @Get(':revisionId')
  @UseGuards(SessionAuthGuard)
  async getRevisionSnapshot(
    @Req() req: Request,
    @Param('revisionId') revisionId: string
  ): Promise<MappingSnapshotContract> {
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    return this.mappingPersistenceService.getRevisionMapping(tenantId, revisionId);
  }
}
