import { Injectable } from '@nestjs/common';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { AuthConfigService } from '../config/auth-config.service';

export interface AuthenticatedUser {
  provider: 'google' | 'microsoft';
  email: string;
  displayName: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly authConfig: AuthConfigService) {}

  async createMicrosoftAuthUrl(state: string): Promise<string> {
    const msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: this.authConfig.getMicrosoftClientId(),
        clientSecret: this.authConfig.getMicrosoftClientSecret(),
        authority: 'https://login.microsoftonline.com/common'
      }
    });

    return msalClient.getAuthCodeUrl({
      scopes: ['openid', 'profile', 'email', 'User.Read'],
      redirectUri: this.authConfig.getMicrosoftCallbackUrl(),
      state
    });
  }

  async exchangeMicrosoftCode(code: string): Promise<AuthenticatedUser> {
    const msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: this.authConfig.getMicrosoftClientId(),
        clientSecret: this.authConfig.getMicrosoftClientSecret(),
        authority: 'https://login.microsoftonline.com/common'
      }
    });

    const tokenResponse = await msalClient.acquireTokenByCode({
      code,
      scopes: ['openid', 'profile', 'email', 'User.Read'],
      redirectUri: this.authConfig.getMicrosoftCallbackUrl()
    });

    const account = tokenResponse?.account;
    return {
      provider: 'microsoft',
      email: account?.username || 'unknown@example.com',
      displayName: account?.name || 'Unknown User'
    };
  }
}
