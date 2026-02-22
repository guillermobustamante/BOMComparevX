import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { SessionState } from '../auth/session-user.interface';
import { UploadPolicyService } from '../uploads/upload-policy.service';
import { AdminRoleService } from './admin-role.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminRoleService: AdminRoleService,
    private readonly uploadPolicyService: UploadPolicyService,
    private readonly auditService: AuditService
  ) {}

  @Get('me')
  @UseGuards(SessionAuthGuard)
  async me(@Req() req: Request): Promise<{ isAdmin: boolean }> {
    const session = req.session as SessionState;
    const tenantId = session.user?.tenantId || 'unknown-tenant';
    const actorEmail = session.user?.email || 'unknown-user';
    const isAdmin = await this.adminRoleService.hasAdminRole(tenantId, actorEmail);
    return { isAdmin };
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

  private async ensureAdmin(tenantId: string, actorEmail: string): Promise<void> {
    const isAdmin = await this.adminRoleService.hasAdminRole(tenantId, actorEmail);
    if (isAdmin) return;
    throw new ForbiddenException({
      code: 'ADMIN_REQUIRED',
      message: 'Admin role is required for this action.',
      correlationId: randomUUID()
    });
  }

  private ensureTestRoutesEnabled(): void {
    if (process.env.ENABLE_TEST_ROUTES !== 'true') {
      throw new NotFoundException();
    }
  }
}
