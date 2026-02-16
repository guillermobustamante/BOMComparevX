import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { SessionAuthGuard } from './session-auth.guard';
import { GoogleStartGuard } from './google-start.guard';
import { TenantModule } from '../tenant/tenant.module';
import { ConfigModule } from '../config/config.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PassportModule.register({ session: true }), TenantModule, ConfigModule, AuditModule],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, SessionAuthGuard, GoogleStartGuard],
  exports: [SessionAuthGuard]
})
export class AuthModule {}
