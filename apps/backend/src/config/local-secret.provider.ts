import { SecretProvider } from './secret-provider.interface';

export class LocalSecretProvider implements SecretProvider {
  async getSecret(secretName: string): Promise<string | undefined> {
    return process.env[secretName];
  }
}
