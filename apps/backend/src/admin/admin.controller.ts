import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { AuditGovernanceService } from '../audit/audit-governance.service';
import { AuditService } from '../audit/audit.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionState } from '../auth/session-user.interface';
import { RetentionService } from '../retention/retention.service';
import { UploadPolicyService } from '../uploads/upload-policy.service';
import { BomChangeTaxonomyCategory, BomChangeTaxonomyService } from '../mapping/bom-change-taxonomy.service';
import { MappingAliasLearningService } from '../mapping/mapping-alias-learning.service';
import { AdminRoleService } from './admin-role.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminRoleService: AdminRoleService,
    private readonly uploadPolicyService: UploadPolicyService,
    private readonly auditService: AuditService,
    private readonly retentionService: RetentionService,
    private readonly auditGovernanceService: AuditGovernanceService,
    private readonly mappingAliasLearningService: MappingAliasLearningService,
    private readonly bomChangeTaxonomyService: BomChangeTaxonomyService
  ) {}

  @Get('me')
  @UseGuards(SessionAuthGuard)
  async me(@Req() req: Request): Promise<{ isAdmin: boolean; canBootstrapAdmin: boolean }> {
    this.ensureFeatureEnabled(
      'admin_policy_ui_stage5_v1',
      'ADMIN_STAGE5_DISABLED',
      'Stage 5 admin policy controls are currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    const isAdmin = await this.adminRoleService.hasAdminRole(tenantId, actorEmail);
    const activeAdmins = await this.adminRoleService.countActiveAdmins(tenantId);
    return {
      isAdmin,
      canBootstrapAdmin: !isAdmin && activeAdmins === 0
    };
  }

  @Get('roles')
  @UseGuards(SessionAuthGuard)
  async roles(@Req() req: Request): Promise<{ roles: Array<{ email: string; role: 'admin'; isActive: true }> }> {
    this.ensureFeatureEnabled(
      'admin_policy_ui_stage5_v1',
      'ADMIN_STAGE5_DISABLED',
      'Stage 5 admin policy controls are currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    await this.ensureAdmin(tenantId, actorEmail);
    const roles = await this.adminRoleService.listActiveAdmins(tenantId);
    return {
      roles: roles.map((role) => ({
        email: role.userEmail,
        role: 'admin' as const,
        isActive: true as const
      }))
    };
  }

  @Post('roles/grant')
  @UseGuards(SessionAuthGuard)
  async grantRole(
    @Req() req: Request,
    @Body() body: { userEmail?: string }
  ): Promise<{ ok: true; userEmail: string; role: 'admin' }> {
    this.ensureFeatureEnabled(
      'admin_policy_ui_stage5_v1',
      'ADMIN_STAGE5_DISABLED',
      'Stage 5 admin policy controls are currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    const userEmail = (body.userEmail || actorEmail).trim().toLowerCase();
    await this.ensureAdminOrBootstrap(tenantId, actorEmail, userEmail);
    await this.adminRoleService.grantAdminRole({
      tenantId,
      userEmail,
      actorEmail
    });
    this.auditService.emit({
      eventType: 'admin.role.grant',
      outcome: 'success',
      actorEmail,
      tenantId,
      reason: `granted=${userEmail}`,
      correlationId: randomUUID()
    });
    return { ok: true, userEmail, role: 'admin' };
  }

  @Post('roles/revoke')
  @UseGuards(SessionAuthGuard)
  async revokeRole(
    @Req() req: Request,
    @Body() body: { userEmail?: string }
  ): Promise<{ ok: true; userEmail: string; role: 'admin' }> {
    this.ensureFeatureEnabled(
      'admin_policy_ui_stage5_v1',
      'ADMIN_STAGE5_DISABLED',
      'Stage 5 admin policy controls are currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    const userEmail = (body.userEmail || '').trim().toLowerCase();
    await this.ensureAdmin(tenantId, actorEmail);
    await this.preventRevokingLastAdmin(tenantId, userEmail);
    await this.adminRoleService.revokeAdminRole({
      tenantId,
      userEmail,
      actorEmail
    });
    this.auditService.emit({
      eventType: 'admin.role.revoke',
      outcome: 'success',
      actorEmail,
      tenantId,
      reason: `revoked=${userEmail}`,
      correlationId: randomUUID()
    });
    return { ok: true, userEmail, role: 'admin' };
  }

  @Get('users')
  @UseGuards(SessionAuthGuard)
  async users(
    @Req() req: Request,
    @Query('query') query?: string
  ): Promise<{
    users: Array<{
      email: string;
      isAdmin: boolean;
      policy: {
        comparisonsUsed: number;
        unrestrictedComparisonsRemaining: number;
        cooldownUntilUtc: string | null;
        isUnlimited: boolean;
      };
    }>;
  }> {
    this.ensureFeatureEnabled(
      'admin_policy_ui_stage5_v1',
      'ADMIN_STAGE5_DISABLED',
      'Stage 5 admin policy controls are currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    await this.ensureAdmin(tenantId, actorEmail);

    const emails = await this.uploadPolicyService.listKnownUsers(tenantId, query);
    const users = await Promise.all(
      emails.map(async (email) => ({
        email,
        isAdmin: await this.adminRoleService.hasAdminRole(tenantId, email),
        policy: await this.uploadPolicyService.getPolicy(email, tenantId)
      }))
    );
    return { users };
  }

  @Post('upload-policy/reset')
  @UseGuards(SessionAuthGuard)
  async resetPolicy(
    @Req() req: Request,
    @Body() body: { userEmail?: string }
  ): Promise<{
    ok: true;
    userEmail: string;
    policy: {
      comparisonsUsed: number;
      unrestrictedComparisonsRemaining: number;
      cooldownUntilUtc: string | null;
      isUnlimited: boolean;
    };
  }> {
    this.ensureFeatureEnabled(
      'admin_policy_ui_stage5_v1',
      'ADMIN_STAGE5_DISABLED',
      'Stage 5 admin policy controls are currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    await this.ensureAdmin(tenantId, actorEmail);

    const userEmail = (body.userEmail || '').trim().toLowerCase();
    const policy = await this.uploadPolicyService.resetPolicyForUser(tenantId, userEmail);
    this.auditService.emit({
      eventType: 'admin.policy.reset',
      outcome: 'success',
      actorEmail,
      tenantId,
      reason: `user=${userEmail}`,
      correlationId: randomUUID()
    });

    return { ok: true, userEmail, policy };
  }

  @Post('upload-policy/override')
  @UseGuards(SessionAuthGuard)
  async overridePolicy(
    @Req() req: Request,
    @Body() body: { userEmail?: string; isUnlimited?: boolean; reason?: string }
  ): Promise<{
    ok: true;
    userEmail: string;
    policy: {
      comparisonsUsed: number;
      unrestrictedComparisonsRemaining: number;
      cooldownUntilUtc: string | null;
      isUnlimited: boolean;
    };
  }> {
    this.ensureFeatureEnabled(
      'admin_policy_ui_stage5_v1',
      'ADMIN_STAGE5_DISABLED',
      'Stage 5 admin policy controls are currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    await this.ensureAdmin(tenantId, actorEmail);

    const userEmail = (body.userEmail || '').trim().toLowerCase();
    const isUnlimited = Boolean(body.isUnlimited);
    const policy = await this.uploadPolicyService.setAdminOverride({
      tenantId,
      userKey: userEmail,
      isUnlimited,
      reason: body.reason,
      actorEmail
    });
    this.auditService.emit({
      eventType: 'admin.policy.override',
      outcome: 'success',
      actorEmail,
      tenantId,
      reason: `user=${userEmail};isUnlimited=${isUnlimited}`,
      correlationId: randomUUID()
    });

    return { ok: true, userEmail, policy };
  }

  @Post('retention/run')
  @UseGuards(SessionAuthGuard)
  async runRetentionSweep(
    @Req() req: Request,
    @Body() body: { nowUtcIso?: string }
  ): Promise<{
    ok: true;
    deletedExportArtifacts: number;
    deletedNotifications: number;
    deletedRevokedShares: number;
    exportArtifactsCutoffUtc: string;
    notificationsCutoffUtc: string;
    sweptAtUtc: string;
  }> {
    this.ensureFeatureEnabled(
      'admin_policy_ui_stage5_v1',
      'ADMIN_STAGE5_DISABLED',
      'Stage 5 admin policy controls are currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    await this.ensureAdmin(tenantId, actorEmail);

    const result = await this.retentionService.runSweep({
      nowUtcIso: body.nowUtcIso,
      actorEmail,
      tenantId,
      trigger: 'manual'
    });
    return {
      ok: true,
      ...result
    };
  }

  @Get('audit/export')
  @UseGuards(SessionAuthGuard)
  async exportAuditEvents(
    @Req() req: Request,
    @Query('format') format: string | undefined,
    @Query('fromUtcIso') fromUtcIso: string | undefined,
    @Query('toUtcIso') toUtcIso: string | undefined,
    @Query('actionType') actionType: string | undefined,
    @Query('outcome') outcome: string | undefined,
    @Query('actorEmail') actorEmail: string | undefined,
    @Query('limit') limit: string | undefined,
    @Res({ passthrough: true }) response: Response
  ): Promise<string> {
    this.ensureFeatureEnabled(
      'audit_export_stage8_v1',
      'AUDIT_EXPORT_STAGE8_DISABLED',
      'Stage 8 audit export is currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const requestedBy = session.user?.email || 'unknown-user';
    await this.ensureAdmin(tenantId, requestedBy);

    const resolvedFormat = (format || 'csv').trim().toLowerCase() === 'ndjson' ? 'ndjson' : 'csv';

    try {
      const payload = await this.auditGovernanceService.exportTenantAudit({
        tenantId,
        format: resolvedFormat,
        fromUtcIso,
        toUtcIso,
        actionType: actionType || undefined,
        outcome: outcome || undefined,
        actorEmail: actorEmail || undefined,
        limit: limit ? Number(limit) : undefined
      });

      response.setHeader('Content-Type', payload.contentType);
      response.setHeader('Content-Disposition', `attachment; filename="${payload.fileName}"`);
      response.setHeader('Cache-Control', 'no-store');

      this.auditService.emit({
        eventType: 'audit.export',
        outcome: 'success',
        actorEmail: requestedBy,
        tenantId,
        reason: `format=${resolvedFormat};rows=${payload.rowCount}`,
        correlationId: randomUUID()
      });
      return payload.content;
    } catch (error) {
      this.auditService.emit({
        eventType: 'audit.export',
        outcome: 'failure',
        actorEmail: requestedBy,
        tenantId,
        reason: `format=${resolvedFormat}`,
        correlationId: randomUUID()
      });
      throw error;
    }
  }

  @Post('audit/archive/run')
  @UseGuards(SessionAuthGuard)
  async runAuditArchive(
    @Req() req: Request,
    @Body() body: { nowUtcIso?: string }
  ): Promise<{
    ok: true;
    archive: {
      archiveId: string;
      tenantId: string;
      archiveDateUtc: string;
      triggeredAtUtc: string;
      triggeredBy: string;
      storageTarget: 'local' | 'azure_blob_grs';
      artifactUri: string;
      manifestUri: string;
      appendOnly: true;
      recordCount: number;
      payloadBytes: number;
      sha256: string;
      retentionYears: number;
    };
  }> {
    this.ensureFeatureEnabled(
      'audit_archive_stage8_v1',
      'AUDIT_ARCHIVE_STAGE8_DISABLED',
      'Stage 8 audit archive is currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    await this.ensureAdmin(tenantId, actorEmail);

    const archive = await this.auditGovernanceService.runDailyArchive({
      tenantId,
      actorEmail,
      nowUtcIso: body.nowUtcIso
    });
    this.auditService.emit({
      eventType: 'audit.archive.run',
      outcome: 'success',
      actorEmail,
      tenantId,
      reason: `date=${archive.archiveDateUtc};records=${archive.recordCount};target=${archive.storageTarget}`,
      correlationId: randomUUID()
    });
    return { ok: true, archive };
  }

  @Get('audit/archive/runs')
  @UseGuards(SessionAuthGuard)
  async listAuditArchiveRuns(
    @Req() req: Request,
    @Query('limit') limit?: string
  ): Promise<{
    runs: Array<{
      archiveId: string;
      tenantId: string;
      archiveDateUtc: string;
      triggeredAtUtc: string;
      triggeredBy: string;
      storageTarget: 'local' | 'azure_blob_grs';
      artifactUri: string;
      manifestUri: string;
      appendOnly: true;
      recordCount: number;
      payloadBytes: number;
      sha256: string;
      retentionYears: number;
    }>;
  }> {
    this.ensureFeatureEnabled(
      'audit_archive_stage8_v1',
      'AUDIT_ARCHIVE_STAGE8_DISABLED',
      'Stage 8 audit archive is currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    await this.ensureAdmin(tenantId, actorEmail);

    const runs = await this.auditGovernanceService.listArchiveRuns({
      tenantId,
      limit: limit ? Number(limit) : undefined
    });
    return { runs };
  }

  @Get('mapping-governance/aliases')
  @UseGuards(SessionAuthGuard)
  async listTenantAliases(
    @Req() req: Request,
    @Query('query') query?: string
  ): Promise<{
    aliases: Array<{
      normalizedSourceColumn: string;
      canonicalField: string;
      confirmations: number;
      isEnabled: boolean;
      confidenceBand: 'emerging' | 'trusted' | 'established';
    }>;
  }> {
    this.ensureFeatureEnabled(
      'admin_policy_ui_stage5_v1',
      'ADMIN_STAGE5_DISABLED',
      'Stage 5 admin policy controls are currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    await this.ensureAdmin(tenantId, actorEmail);

    const normalizedQuery = (query || '').trim().toLowerCase();
    const aliases = await this.mappingAliasLearningService.getTenantAliasesForReview(tenantId);
    return {
      aliases: aliases.filter((alias) =>
        !normalizedQuery ||
        alias.normalizedSourceColumn.includes(normalizedQuery) ||
        alias.canonicalField.includes(normalizedQuery)
      )
    };
  }

  @Post('mapping-governance/aliases/state')
  @UseGuards(SessionAuthGuard)
  async setTenantAliasState(
    @Req() req: Request,
    @Body()
    body: {
      normalizedSourceColumn?: string;
      canonicalField?: string;
      isEnabled?: boolean;
    }
  ): Promise<{ ok: true }> {
    this.ensureFeatureEnabled(
      'admin_policy_ui_stage5_v1',
      'ADMIN_STAGE5_DISABLED',
      'Stage 5 admin policy controls are currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    await this.ensureAdmin(tenantId, actorEmail);

    await this.mappingAliasLearningService.setAliasEnabled({
      tenantId,
      normalizedSourceColumn: body.normalizedSourceColumn || '',
      canonicalField: body.canonicalField || '',
      isEnabled: Boolean(body.isEnabled),
      actorEmail
    });
    return { ok: true };
  }

  @Get('mapping-governance/taxonomy')
  @UseGuards(SessionAuthGuard)
  async getTenantTaxonomy(
    @Req() req: Request,
    @Query('industry') industry?: string
  ): Promise<{
    defaultIndustry: string;
    availableIndustries: string[];
    taxonomy: {
      industry: string;
      categories: BomChangeTaxonomyCategory[];
    };
  }> {
    this.ensureFeatureEnabled(
      'admin_policy_ui_stage5_v1',
      'ADMIN_STAGE5_DISABLED',
      'Stage 5 admin policy controls are currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    await this.ensureAdmin(tenantId, actorEmail);

    const defaultIndustry = await this.bomChangeTaxonomyService.getDefaultIndustry(tenantId);
    const taxonomy = await this.bomChangeTaxonomyService.getTaxonomy(tenantId, industry);
    return {
      defaultIndustry,
      availableIndustries: this.bomChangeTaxonomyService.listIndustries(),
      taxonomy
    };
  }

  @Post('mapping-governance/taxonomy/default-industry')
  @UseGuards(SessionAuthGuard)
  async setTenantDefaultIndustry(
    @Req() req: Request,
    @Body() body: { defaultIndustry?: string }
  ): Promise<{ defaultIndustry: string }> {
    this.ensureFeatureEnabled(
      'admin_policy_ui_stage5_v1',
      'ADMIN_STAGE5_DISABLED',
      'Stage 5 admin policy controls are currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    await this.ensureAdmin(tenantId, actorEmail);

    return this.bomChangeTaxonomyService.setDefaultIndustry({
      tenantId,
      defaultIndustry: body.defaultIndustry || '',
      actorEmail
    });
  }

  @Post('mapping-governance/taxonomy')
  @UseGuards(SessionAuthGuard)
  async saveTenantTaxonomy(
    @Req() req: Request,
    @Body()
    body: {
      industry?: string;
      categories?: BomChangeTaxonomyCategory[];
    }
  ): Promise<{
    taxonomy: {
      industry: string;
      categories: BomChangeTaxonomyCategory[];
    };
  }> {
    this.ensureFeatureEnabled(
      'admin_policy_ui_stage5_v1',
      'ADMIN_STAGE5_DISABLED',
      'Stage 5 admin policy controls are currently disabled by feature flag.'
    );
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    await this.ensureAdmin(tenantId, actorEmail);

    const taxonomy = await this.bomChangeTaxonomyService.saveTaxonomy({
      tenantId,
      industry: body.industry || '',
      categories: body.categories || [],
      actorEmail
    });
    return { taxonomy };
  }

  @Post('test/grant-role')
  @UseGuards(SessionAuthGuard)
  async testGrantRole(
    @Req() req: Request,
    @Body() body: { userEmail?: string }
  ): Promise<{ ok: true; userEmail: string; role: 'admin' }> {
    this.ensureTestRoutesEnabled();
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    const userEmail = (body.userEmail || actorEmail).trim().toLowerCase();
    await this.adminRoleService.grantAdminRole({
      tenantId,
      userEmail,
      actorEmail
    });
    this.auditService.emit({
      eventType: 'admin.role.grant',
      outcome: 'success',
      actorEmail,
      tenantId,
      reason: `granted=${userEmail}`,
      correlationId: randomUUID()
    });
    return {
      ok: true,
      userEmail,
      role: 'admin'
    };
  }

  private async ensureAdminOrBootstrap(
    tenantId: string,
    actorEmail: string,
    targetEmail: string
  ): Promise<void> {
    if (await this.adminRoleService.hasAdminRole(tenantId, actorEmail)) {
      return;
    }
    const activeAdmins = await this.adminRoleService.countActiveAdmins(tenantId);
    if (activeAdmins === 0 && actorEmail.trim().toLowerCase() === targetEmail.trim().toLowerCase()) {
      return;
    }
    throw new ForbiddenException({
      code: 'ADMIN_REQUIRED',
      message: 'Admin role is required for this action.',
      correlationId: randomUUID()
    });
  }

  private async ensureAdmin(tenantId: string, actorEmail: string): Promise<void> {
    const isAdmin = await this.adminRoleService.hasAdminRole(tenantId, actorEmail);
    if (isAdmin) return;
    throw new ForbiddenException({
      code: 'ADMIN_REQUIRED',
      message: 'Admin role is required for this action.',
      correlationId: randomUUID()
    });
  }

  private async preventRevokingLastAdmin(tenantId: string, userEmail: string): Promise<void> {
    const isTargetAdmin = await this.adminRoleService.hasAdminRole(tenantId, userEmail);
    if (!isTargetAdmin) return;
    const activeAdmins = await this.adminRoleService.countActiveAdmins(tenantId);
    if (activeAdmins > 1) return;
    throw new ForbiddenException({
      code: 'ADMIN_LAST_ROLE_REVOKE_BLOCKED',
      message: 'At least one active admin must remain assigned to the tenant.',
      correlationId: randomUUID()
    });
  }

  private ensureTestRoutesEnabled(): void {
    if (process.env.ENABLE_TEST_ROUTES !== 'true') {
      throw new NotFoundException();
    }
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
