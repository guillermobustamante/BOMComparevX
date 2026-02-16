import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class SecretProvider {
  abstract getSecret(secretName: string): Promise<string | undefined>;
}
