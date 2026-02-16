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

  it('google start endpoint redirects to provider', async () => {
    const response = await request(app.getHttpServer()).get('/api/auth/google/start').expect(302);
    expect(response.headers.location).toContain('accounts.google.com');
  });

  it('microsoft start endpoint redirects to provider', async () => {
    const response = await request(app.getHttpServer()).get('/api/auth/microsoft/start').expect(302);
    expect(response.headers.location).toContain('login.microsoftonline.com');
  });

  it('microsoft callback rejects invalid state', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/microsoft/callback?code=demo-code&state=bad-state')
      .expect(401);
    expect(response.body.code).toBe('AUTH_MICROSOFT_STATE_INVALID');
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

  it('authenticated session can read /api/auth/me', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'signedin@example.com', tenantId: 'tenant-a', provider: 'microsoft' })
      .expect(201);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.email).toBe('signedin@example.com');
    expect(me.body.provider).toBe('microsoft');
    expect(me.body.tenantId).toBe('tenant-a');
  });

  it('upload validate rejects invalid file type', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'uploader@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const response = await agent
      .post('/api/uploads/validate')
      .attach('fileA', Buffer.from('not-valid'), { filename: 'parts.txt', contentType: 'text/plain' })
      .attach('fileB', Buffer.from('a,b\n1,2\n'), { filename: 'parts.csv', contentType: 'text/csv' })
      .expect(400);

    expect(response.body.code).toBe('UPLOAD_FILE_TYPE_INVALID');
  });

  it('upload validate requires authentication', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/uploads/validate')
      .attach('fileA', Buffer.from('a,b\n1,2\n'), { filename: 'bom-a.csv', contentType: 'text/csv' })
      .attach('fileB', Buffer.from('a,b\n3,4\n'), { filename: 'bom-b.csv', contentType: 'text/csv' })
      .expect(401);

    expect(response.body.code).toBe('AUTH_REQUIRED');
  });

  it('upload validate rejects oversized file', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'uploader@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const oversized = Buffer.alloc(30 * 1024 * 1024 + 1, 0x61);
    const response = await agent
      .post('/api/uploads/validate')
      .attach('fileA', oversized, {
        filename: 'huge.csv',
        contentType: 'text/csv'
      })
      .attach('fileB', Buffer.from('a,b\n1,2\n'), { filename: 'parts.csv', contentType: 'text/csv' })
      .expect(400);

    expect(response.body.code).toBe('UPLOAD_FILE_SIZE_EXCEEDED');
  });

  it('upload validate rejects invalid file count', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'uploader@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const response = await agent
      .post('/api/uploads/validate')
      .attach('fileA', Buffer.from('a,b\n1,2\n'), { filename: 'parts.csv', contentType: 'text/csv' })
      .expect(400);

    expect(response.body.code).toBe('UPLOAD_FILE_COUNT_INVALID');
  });

  it('upload validate accepts two valid files', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'uploader@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const response = await agent
      .post('/api/uploads/validate')
      .attach('fileA', Buffer.from('a,b\n1,2\n'), { filename: 'bom-a.csv', contentType: 'text/csv' })
      .attach('fileB', Buffer.from('PK\x03\x04'), {
        filename: 'bom-b.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      .expect(201);

    expect(response.body.accepted).toBe(true);
    expect(response.body.files.fileA.name).toBe('bom-a.csv');
    expect(response.body.files.fileB.name).toBe('bom-b.xlsx');
  });
});
