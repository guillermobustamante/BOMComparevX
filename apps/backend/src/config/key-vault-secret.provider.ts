import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { SecretProvider } from './secret-provider.interface';

export class KeyVaultSecretProvider implements SecretProvider {
  private readonly client: SecretClient;

  constructor(keyVaultUri: string) {
    this.client = new SecretClient(keyVaultUri, new DefaultAzureCredential());
  }

  async getSecret(secretName: string): Promise<string | undefined> {
    const secret = await this.client.getSecret(secretName);
    return secret.value;
  }
}
