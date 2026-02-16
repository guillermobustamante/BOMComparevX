import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { SessionState } from './session-user.interface';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly auditService: AuditService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const session = request.session as SessionState | undefined;

    if (!session?.user) {
      const correlationId = randomUUID();
      this.auditService.emit({
        eventType: 'auth.access.denied',
        outcome: 'denied',
        reason: 'auth_required',
        correlationId
      });
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Authentication is required to access this resource.',
        correlationId
      });
    }

    return true;
  }
}
