import {
  Controller,
  Get,
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

interface SessionState {
  oauthState?: string;
  user?: {
    provider: 'google' | 'microsoft';
    email: string;
    displayName: string;
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authConfig: AuthConfigService
  ) {}

  @Get('google/start')
  @UseGuards(AuthGuard('google'))
  googleStart(): void {
    // Guard handles redirect to Google OAuth.
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleCallback(@Req() req: Request, @Res() res: Response): void {
    const correlationId = randomUUID();
    const user = req.user as AuthResultDto | undefined;
    if (!user) {
      res.status(401).json(this.error('AUTH_GOOGLE_CALLBACK_FAILED', 'Google login failed.', correlationId));
      return;
    }

    const session = req.session as SessionState;
    session.user = {
      provider: 'google',
      email: user.email,
      displayName: user.displayName
    };

    const returnTo = `${this.authConfig.getWebBaseUrl()}/upload`;
    res.redirect(returnTo);
  }

  @Get('microsoft/start')
  async microsoftStart(@Req() req: Request, @Res() res: Response): Promise<void> {
    const state = randomUUID();
    (req.session as SessionState).oauthState = state;

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
      res.status(401).json(this.error('AUTH_MICROSOFT_STATE_INVALID', 'Microsoft callback is invalid.', correlationId));
      return;
    }

    try {
      const user = await this.authService.exchangeMicrosoftCode(code);
      session.user = user;
      delete session.oauthState;
      const returnTo = `${this.authConfig.getWebBaseUrl()}/upload`;
      res.redirect(returnTo);
    } catch {
      res.status(401).json(this.error('AUTH_MICROSOFT_CALLBACK_FAILED', 'Microsoft login failed.', correlationId));
    }
  }

  private error(code: string, message: string, correlationId: string) {
    return { code, message, correlationId };
  }
}
