import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthResultDto } from './dto/auth-result.dto';
import { AuthConfigService } from '../config/auth-config.service';
import { SessionAuthGuard } from './session-auth.guard';
import { SessionState } from './session-user.interface';
import { GoogleStartGuard } from './google-start.guard';
import { buildReturnToUrl, sanitizeReturnToPath } from './redirect.util';
import { TenantResolverService } from '../tenant/tenant-resolver.service';
import { AuditService } from '../audit/audit.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authConfig: AuthConfigService,
    private readonly tenantResolver: TenantResolverService,
    private readonly auditService: AuditService
  ) {}

  @Get('google/start')
  @UseGuards(GoogleStartGuard)
  googleStart(): void {
    // Guard handles redirect to Google OAuth.
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleCallback(@Req() req: Request, @Res() res: Response): void {
    const correlationId = randomUUID();
    const user = req.user as AuthResultDto | undefined;
    if (!user) {
      this.auditService.emit({
        eventType: 'auth.login.failure',
        outcome: 'failure',
        provider: 'google',
        reason: 'google_callback_user_missing',
        correlationId
      });
      res.status(401).json(this.error('AUTH_GOOGLE_CALLBACK_FAILED', 'Google login failed.', correlationId));
      return;
    }

    const session = req.session as SessionState;
    session.user = {
      provider: 'google',
      email: user.email,
      displayName: user.displayName,
      tenantId: this.tenantResolver.resolveTenantId(user.email)
    };
    this.auditService.emit({
      eventType: 'auth.login.success',
      outcome: 'success',
      actorEmail: session.user.email,
      tenantId: session.user.tenantId,
      provider: 'google',
      correlationId
    });

    const returnTo = this.consumeReturnToUrl(session);
    res.redirect(returnTo);
  }

  @Get('microsoft/start')
  async microsoftStart(
    @Req() req: Request,
    @Res() res: Response,
    @Query('returnTo') returnTo?: string
  ): Promise<void> {
    const state = randomUUID();
    const session = req.session as SessionState;
    session.oauthState = state;
    session.returnToPath = sanitizeReturnToPath(returnTo);

    const authUrl = await this.authService.createMicrosoftAuthUrl(state);
    res.redirect(authUrl);
  }

  @Get('microsoft/callback')
  async microsoftCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string
  ): Promise<void> {
    const correlationId = randomUUID();
    const session = req.session as SessionState;

    if (!code || !state || session.oauthState !== state) {
      this.auditService.emit({
        eventType: 'auth.login.failure',
        outcome: 'failure',
        provider: 'microsoft',
        reason: 'microsoft_callback_state_invalid',
        correlationId
      });
      res.status(401).json(this.error('AUTH_MICROSOFT_STATE_INVALID', 'Microsoft callback is invalid.', correlationId));
      return;
    }

    try {
      const user = await this.authService.exchangeMicrosoftCode(code);
      const tenantId = this.tenantResolver.resolveTenantId(user.email);
      session.user = {
        provider: user.provider,
        email: user.email,
        displayName: user.displayName,
        tenantId
      };
      this.auditService.emit({
        eventType: 'auth.login.success',
        outcome: 'success',
        actorEmail: session.user.email,
        tenantId: session.user.tenantId,
        provider: 'microsoft',
        correlationId
      });
      delete session.oauthState;
      const returnTo = this.consumeReturnToUrl(session);
      res.redirect(returnTo);
    } catch {
      this.auditService.emit({
        eventType: 'auth.login.failure',
        outcome: 'failure',
        provider: 'microsoft',
        reason: 'microsoft_callback_exchange_failed',
        correlationId
      });
      res.status(401).json(this.error('AUTH_MICROSOFT_CALLBACK_FAILED', 'Microsoft login failed.', correlationId));
    }
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@Req() req: Request): AuthResultDto {
    const user = (req.session as SessionState).user;
    return {
      provider: user!.provider,
      email: user!.email,
      displayName: user!.displayName,
      tenantId: user!.tenantId,
      correlationId: randomUUID()
    };
  }

  @Post('test/login')
  testLogin(
    @Req() req: Request,
    @Body()
    body: {
      email?: string;
      displayName?: string;
      provider?: 'google' | 'microsoft';
      tenantId?: string;
    }
  ) {
    this.ensureTestRoutesEnabled();
    const correlationId = randomUUID();
    const session = req.session as SessionState;
    session.user = {
      provider: body.provider || 'google',
      email: body.email || 'test.user@example.com',
      displayName: body.displayName || 'Test User',
      tenantId: body.tenantId || process.env.DEFAULT_TENANT_ID || 'dev-tenant'
    };

    this.auditService.emit({
      eventType: 'auth.login.success',
      outcome: 'success',
      actorEmail: session.user.email,
      tenantId: session.user.tenantId,
      provider: session.user.provider,
      reason: 'test_route_login',
      correlationId
    });

    return { ok: true, correlationId, user: session.user };
  }

  @Post('test/logout')
  testLogout(@Req() req: Request) {
    this.ensureTestRoutesEnabled();
    const session = req.session as SessionState;
    delete session.user;
    delete session.oauthState;
    delete session.returnToPath;
    return { ok: true };
  }

  private error(code: string, message: string, correlationId: string) {
    return { code, message, correlationId };
  }

  private consumeReturnToUrl(session: SessionState): string {
    const returnToUrl = buildReturnToUrl(this.authConfig.getWebBaseUrl(), session.returnToPath);
    delete session.returnToPath;
    return returnToUrl;
  }

  private ensureTestRoutesEnabled(): void {
    if (process.env.ENABLE_TEST_ROUTES !== 'true') {
      throw new NotFoundException();
    }
  }
}
