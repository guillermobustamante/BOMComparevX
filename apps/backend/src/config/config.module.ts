import { Module } from '@nestjs/common';
import { AuthConfigService } from './auth-config.service';
import { SecretProvider } from './secret-provider.interface';
import { KeyVaultSecretProvider } from './key-vault-secret.provider';
import { LocalSecretProvider } from './local-secret.provider';

@Module({
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
export class ConfigModule {}
