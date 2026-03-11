import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionState } from '../auth/session-user.interface';
import { MappingAliasLearningService } from './mapping-alias-learning.service';
import { MappingConfirmationContract, MappingPreviewContract, MappingProfile, MappingSnapshotContract } from './mapping-contract';
import { MappingAuditService } from './mapping-audit.service';
import { MappingPersistenceService } from './mapping-persistence.service';
import { MappingPreviewService } from './mapping-preview.service';

@Controller('mappings')
export class MappingController {
  constructor(
    private readonly mappingPreviewService: MappingPreviewService,
    private readonly mappingPersistenceService: MappingPersistenceService,
    private readonly mappingAuditService: MappingAuditService,
    private readonly mappingAliasLearningService: MappingAliasLearningService
  ) {}

  @Get()
  @UseGuards(SessionAuthGuard)
  async listSnapshots(
    @Req() req: Request
  ): Promise<{
    snapshots: Array<{
      mappingId: string;
      revisionId: string;
      confirmedAtUtc: string;
      createdBy: string;
      sourceColumnCount: number;
      mappedColumnCount: number;
      averageConfidence: number | null;
    }>;
  }> {
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const limit = Number(req.query.limit || 25);
    const snapshots = await this.mappingPersistenceService.listSnapshots({
      tenantId,
      limit
    });
    return { snapshots };
  }

  @Get('preview/:revisionId')
  @UseGuards(SessionAuthGuard)
  async preview(
    @Req() req: Request,
    @Param('revisionId') revisionId: string
  ): Promise<MappingPreviewContract> {
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const rawProfile = req.query.profile;
    const profiles = this.normalizeProfiles(rawProfile);
    return this.mappingPreviewService.getPreview(revisionId, tenantId, {
      profiles
    });
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
    await this.mappingAliasLearningService.recordConfirmation(
      tenantId,
      payload.mappings.map((mapping) => ({
        sourceColumn: mapping.sourceColumn,
        canonicalField: mapping.canonicalField === '__unmapped__' ? null : mapping.canonicalField
      }))
    );

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

  private normalizeProfiles(raw: unknown): MappingProfile[] {
    if (!raw) return [];
    const values = Array.isArray(raw) ? raw : [raw];
    return values
      .flatMap((value) => String(value).split(','))
      .map((value) => value.trim())
      .filter((value): value is MappingProfile => value.length > 0) as MappingProfile[];
  }
}
