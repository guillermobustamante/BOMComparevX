import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as session from 'express-session';
import * as passport from 'passport';
import { AppModule } from '../src/app.module';

describe('Stage 1 API baseline (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.use(
      session({
        secret: 'test-session-secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          sameSite: 'lax',
          secure: false
        }
      })
    );
    app.use(passport.initialize());
    app.use(passport.session());
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns ok', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /api/auth/me requires authentication', async () => {
    const response = await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    expect(response.body.code).toBe('AUTH_REQUIRED');
  });

  it('tenant endpoint denies cross-tenant access', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/api/auth/test/login')
      .send({ email: 'user@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    await agent.get('/api/tenant/resource/tenant-a').expect(200);

    const denied = await agent.get('/api/tenant/resource/tenant-b').expect(403);
    expect(denied.body.code).toBe('TENANT_ACCESS_DENIED');
  });
});
