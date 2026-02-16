import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { TenantScopeGuard } from './tenant-scope.guard';
import { SessionState } from '../auth/session-user.interface';

@Controller('tenant')
@UseGuards(SessionAuthGuard, TenantScopeGuard)
export class TenantController {
  @Get('me')
  me(@Req() req: Request) {
    const user = (req.session as SessionState).user;
    return {
      tenantId: user?.tenantId,
      email: user?.email
    };
  }

  @Get('resource/:tenantId')
  resource(@Param('tenantId') tenantId: string) {
    return {
      tenantId,
      data: ['sample-1', 'sample-2']
    };
  }
}
