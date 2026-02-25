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
import { SharesModule } from './shares/shares.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { RetentionModule } from './retention/retention.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
    TenantModule,
    UploadsModule,
    MappingModule,
    DiffModule,
    ExportsModule,
    SharesModule,
    NotificationsModule,
    AdminModule,
    RetentionModule
  ],
  controllers: [HealthController],
  providers: []
})
export class AppModule {}
