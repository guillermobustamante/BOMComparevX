import { config as loadDotEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import * as session from 'express-session';
import * as passport from 'passport';
import { AppModule } from './app.module';
import { AuthConfigService } from './config/auth-config.service';

function loadEnvironment(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env.local'),
    path.resolve(process.cwd(), '../../.env')
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      loadDotEnv({ path: candidate, override: false });
    }
  }
}

async function preloadOAuthSecretsFromKeyVault(): Promise<void> {
  const keyVaultUri = process.env.AZURE_KEY_VAULT_URI;
  if (!keyVaultUri) return;

  const secretClient = new SecretClient(keyVaultUri, new DefaultAzureCredential());
  const mappings: Array<{ envKey: string; secretNameEnvKey: string }> = [
    { envKey: 'GOOGLE_CLIENT_ID', secretNameEnvKey: 'GOOGLE_CLIENT_ID_SECRET_NAME' },
    { envKey: 'GOOGLE_CLIENT_SECRET', secretNameEnvKey: 'GOOGLE_CLIENT_SECRET_SECRET_NAME' },
    { envKey: 'MICROSOFT_CLIENT_ID', secretNameEnvKey: 'MICROSOFT_CLIENT_ID_SECRET_NAME' },
    { envKey: 'MICROSOFT_CLIENT_SECRET', secretNameEnvKey: 'MICROSOFT_CLIENT_SECRET_SECRET_NAME' }
  ];

  for (const mapping of mappings) {
    if (process.env[mapping.envKey]) continue;
    const secretName = process.env[mapping.secretNameEnvKey];
    if (!secretName) continue;
    try {
      const secret = await secretClient.getSecret(secretName);
      if (secret.value) {
        process.env[mapping.envKey] = secret.value;
      }
    } catch {
      // Keep fallback behavior; AuthConfigService will validate required config later.
    }
  }
}

async function bootstrap() {
  loadEnvironment();
  await preloadOAuthSecretsFromKeyVault();

  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-session-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false
      }
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  const authConfig = app.get(AuthConfigService);
  await authConfig.initialize();

  app.setGlobalPrefix('api');
  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}/api`);
}

bootstrap();
