import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { sanitizeReturnToPath } from './redirect.util';
import { SessionState } from './session-user.interface';

@Injectable()
export class GoogleStartGuard extends AuthGuard('google') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const session = request.session as SessionState;
    const returnTo = typeof request.query.returnTo === 'string' ? request.query.returnTo : undefined;
    session.returnToPath = sanitizeReturnToPath(returnTo);
    return super.canActivate(context);
  }
}
