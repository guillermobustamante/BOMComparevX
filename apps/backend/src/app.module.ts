import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { AuthConfigService } from './config/auth-config.service';
import { SecretProvider } from './config/secret-provider.interface';
import { KeyVaultSecretProvider } from './config/key-vault-secret.provider';
import { LocalSecretProvider } from './config/local-secret.provider';

@Module({
  imports: [AuthModule],
  controllers: [HealthController],
  providers: [
    AuthConfigService,
    {
      provide: SecretProvider,
      useFactory: () => {
        const keyVaultUri = process.env.AZURE_KEY_VAULT_URI;
        if (keyVaultUri) {
          return new KeyVaultSecretProvider(keyVaultUri);
        }
        return new LocalSecretProvider();
      }
    }
  ],
  exports: [AuthConfigService, SecretProvider]
})
export class AppModule {}
