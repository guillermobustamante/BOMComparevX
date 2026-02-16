import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { AuthConfigService } from '../../config/auth-config.service';
import { AuthenticatedUser } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly authConfig: AuthConfigService) {
    super({
      clientID: authConfig.getGoogleClientId(),
      clientSecret: authConfig.getGoogleClientSecret(),
      callbackURL: authConfig.getGoogleCallbackUrl(),
      scope: ['profile', 'email']
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile
  ): Promise<AuthenticatedUser> {
    const primaryEmail = profile.emails?.[0]?.value || 'unknown@example.com';
    return {
      provider: 'google',
      email: primaryEmail,
      displayName: profile.displayName || primaryEmail
    };
  }
}
