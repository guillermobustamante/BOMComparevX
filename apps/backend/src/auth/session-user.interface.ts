export interface SessionUser {
  provider: 'google' | 'microsoft';
  email: string;
  displayName: string;
}

export interface SessionState {
  oauthState?: string;
  returnToPath?: string;
  user?: SessionUser;
}
