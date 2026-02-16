import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { SessionState } from '../auth/session-user.interface';

@Injectable()
export class TenantScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const session = request.session as SessionState | undefined;
    const sessionTenantId = session?.user?.tenantId;

    if (!sessionTenantId) {
      throw new ForbiddenException({
        code: 'TENANT_CONTEXT_MISSING',
        message: 'Tenant context is required for this resource.',
        correlationId: randomUUID()
      });
    }

    const requestedTenantId = this.getRequestedTenantId(request);
    if (!requestedTenantId) {
      return true;
    }

    if (requestedTenantId !== sessionTenantId) {
      throw new ForbiddenException({
        code: 'TENANT_ACCESS_DENIED',
        message: 'Cross-tenant access is not allowed.',
        correlationId: randomUUID()
      });
    }

    return true;
  }

  private getRequestedTenantId(request: Request): string | undefined {
    const paramTenant = request.params?.tenantId;
    if (typeof paramTenant === 'string' && paramTenant) return paramTenant;

    const queryTenant = request.query?.tenantId;
    if (typeof queryTenant === 'string' && queryTenant) return queryTenant;

    const bodyTenant = (request.body as { tenantId?: unknown } | undefined)?.tenantId;
    if (typeof bodyTenant === 'string' && bodyTenant) return bodyTenant;

    const headerTenant = request.headers['x-tenant-id'];
    if (typeof headerTenant === 'string' && headerTenant) return headerTenant;

    return undefined;
  }
}
