import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly clientInstance: PrismaClient | null;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      this.clientInstance = null;
      return;
    }

    this.clientInstance = new PrismaClient({
      datasources: {
        db: { url }
      }
    });
  }

  get enabled(): boolean {
    return this.clientInstance !== null;
  }

  get client(): PrismaClient {
    if (!this.clientInstance) {
      throw new Error('Database client is not enabled. Set DATABASE_URL first.');
    }
    return this.clientInstance;
  }

  async connectIfEnabled(): Promise<void> {
    if (!this.clientInstance) return;
    await this.clientInstance.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.clientInstance) return;
    await this.clientInstance.$disconnect();
  }
}
