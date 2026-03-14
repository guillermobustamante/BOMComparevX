import * as session from 'express-session';
import { DatabaseService } from '../database/database.service';

export class SqlSessionStore extends session.Store {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly ttlHours = Number(process.env.SESSION_TTL_HOURS || 168)
  ) {
    super();
  }

  override get(
    sid: string,
    callback: (err?: unknown, sessionData?: session.SessionData | null) => void
  ): void {
    void this.readSession(sid)
      .then((value) => callback(undefined, value))
      .catch((error: unknown) => callback(error));
  }

  override set(
    sid: string,
    value: session.SessionData,
    callback?: (err?: unknown) => void
  ): void {
    void this.writeSession(sid, value)
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }

  override destroy(sid: string, callback?: (err?: unknown) => void): void {
    void this.databaseService.client.appSession
      .deleteMany({ where: { sessionId: sid } })
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }

  override touch(
    sid: string,
    value: session.SessionData,
    callback?: (err?: unknown) => void
  ): void {
    void this.writeSession(sid, value, true)
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }

  private async readSession(sid: string): Promise<session.SessionData | null> {
    const row = await this.databaseService.client.appSession.findUnique({
      where: { sessionId: sid }
    });
    if (!row) return null;
    if (row.expiresAtUtc && row.expiresAtUtc.getTime() <= Date.now()) {
      await this.databaseService.client.appSession.deleteMany({ where: { sessionId: sid } });
      return null;
    }

    try {
      return JSON.parse(row.dataJson) as session.SessionData;
    } catch {
      await this.databaseService.client.appSession.deleteMany({ where: { sessionId: sid } });
      return null;
    }
  }

  private async writeSession(
    sid: string,
    value: session.SessionData,
    touchOnly = false
  ): Promise<void> {
    const now = new Date();
    const expiresAtUtc = this.resolveExpiry(value, now);
    const user = this.extractUser(value);
    await this.databaseService.client.appSession.upsert({
      where: { sessionId: sid },
      update: {
        dataJson: JSON.stringify(value),
        expiresAtUtc,
        updatedAtUtc: now,
        ...(touchOnly
          ? {}
          : {
              tenantId: user?.tenantId || null,
              userEmail: user?.email || null
            })
      },
      create: {
        sessionId: sid,
        tenantId: user?.tenantId || null,
        userEmail: user?.email || null,
        dataJson: JSON.stringify(value),
        expiresAtUtc,
        createdAtUtc: now,
        updatedAtUtc: now
      }
    });
  }

  private resolveExpiry(value: session.SessionData, now: Date): Date {
    const cookie = value.cookie as { expires?: string | Date; originalMaxAge?: number } | undefined;
    if (cookie?.expires) {
      const candidate = new Date(cookie.expires);
      if (Number.isFinite(candidate.getTime())) return candidate;
    }
    if (typeof cookie?.originalMaxAge === 'number' && cookie.originalMaxAge > 0) {
      return new Date(now.getTime() + cookie.originalMaxAge);
    }
    return new Date(now.getTime() + this.ttlHours * 60 * 60 * 1000);
  }

  private extractUser(
    value: session.SessionData
  ): { email?: string; tenantId?: string } | null {
    const user = (value as { user?: { email?: string; tenantId?: string } }).user;
    if (!user) return null;
    return {
      email: user.email,
      tenantId: user.tenantId
    };
  }
}
