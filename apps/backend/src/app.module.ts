import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { TenantModule } from './tenant/tenant.module';
import { ConfigModule } from './config/config.module';
import { UploadsModule } from './uploads/uploads.module';
import { DatabaseModule } from './database/database.module';
import { DiffModule } from './diff/diff.module';
import { MappingModule } from './mapping/mapping.module';
import { ExportsModule } from './exports/exports.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
    TenantModule,
    UploadsModule,
    MappingModule,
    DiffModule,
    ExportsModule
  ],
  controllers: [HealthController],
  providers: []
})
export class AppModule {}
