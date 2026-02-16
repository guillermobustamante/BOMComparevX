import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as session from 'express-session';
import * as passport from 'passport';
import { AppModule } from '../src/app.module';
import { UploadHistoryService } from '../src/uploads/upload-history.service';
import { UploadJobService } from '../src/uploads/upload-job.service';

describe('Stage 1 API baseline (e2e)', () => {
  let app: INestApplication;
  let uploadHistoryService: UploadHistoryService;
  let uploadJobService: UploadJobService;

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
    uploadHistoryService = moduleFixture.get(UploadHistoryService);
    uploadJobService = moduleFixture.get(UploadJobService);
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
    expect(response.body.policy.comparisonsUsed).toBe(1);
    expect(response.body.policy.unrestrictedComparisonsRemaining).toBe(2);
  });

  it('upload intake accepts valid files and returns accepted job metadata', async () => {
    const email = `intake.user.${Date.now()}@example.com`;
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email, tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const response = await agent
      .post('/api/uploads/intake')
      .attach('fileA', Buffer.from('a,b\n1,2\n'), { filename: 'bom-a.csv', contentType: 'text/csv' })
      .attach('fileB', Buffer.from('a,b\n3,4\n'), { filename: 'bom-b.csv', contentType: 'text/csv' })
      .expect(202);

    expect(response.body.status).toBe('accepted');
    expect(response.body.jobId).toBeDefined();
    expect(response.body.sessionId).toBeDefined();
    expect(response.body.historyId).toBeDefined();
    expect(response.body.correlationId).toBeDefined();
    expect(response.body.idempotentReplay).toBe(false);
  });

  it('upload intake is idempotent by Idempotency-Key and does not create duplicate jobs', async () => {
    const email = `idempotency.user.${Date.now()}@example.com`;
    const idempotencyKey = `idem-${Date.now()}`;
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email, tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const first = await agent
      .post('/api/uploads/intake')
      .set('Idempotency-Key', idempotencyKey)
      .attach('fileA', Buffer.from('a,b\n1,2\n'), { filename: 'bom-a.csv', contentType: 'text/csv' })
      .attach('fileB', Buffer.from('a,b\n3,4\n'), { filename: 'bom-b.csv', contentType: 'text/csv' })
      .expect(202);

    const second = await agent
      .post('/api/uploads/intake')
      .set('Idempotency-Key', idempotencyKey)
      .attach('fileA', Buffer.from('a,b\n1,2\n'), { filename: 'bom-a.csv', contentType: 'text/csv' })
      .attach('fileB', Buffer.from('a,b\n3,4\n'), { filename: 'bom-b.csv', contentType: 'text/csv' })
      .expect(202);

    expect(second.body.idempotentReplay).toBe(true);
    expect(second.body.jobId).toBe(first.body.jobId);
    expect(second.body.sessionId).toBe(first.body.sessionId);
    expect(second.body.historyId).toBe(first.body.historyId);
  });

  it('upload intake creates history entry linked to job and session', async () => {
    const email = `history.user.${Date.now()}@example.com`;
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email, tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const response = await agent
      .post('/api/uploads/intake')
      .attach('fileA', Buffer.from('a,b\n1,2\n'), { filename: 'bom-a.csv', contentType: 'text/csv' })
      .attach('fileB', Buffer.from('a,b\n3,4\n'), { filename: 'bom-b.csv', contentType: 'text/csv' })
      .expect(202);

    const history = uploadHistoryService.findByJobId(response.body.jobId);
    expect(history).toBeDefined();
    expect(history?.historyId).toBe(response.body.historyId);
    expect(history?.sessionId).toBe(response.body.sessionId);
    expect(history?.status).toBe('queued');
    expect(history?.initiatorEmail).toBe(email);

    const job = uploadJobService.findByJobId(response.body.jobId);
    expect(job?.status).toBe('queued');
  });

  it('upload intake routes failed enqueue attempts to dead-letter after retries', async () => {
    const email = `queue.fail.${Date.now()}@example.com`;
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email, tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const response = await agent
      .post('/api/uploads/intake')
      .set('x-test-queue-fail', 'always')
      .attach('fileA', Buffer.from('a,b\n1,2\n'), { filename: 'bom-a.csv', contentType: 'text/csv' })
      .attach('fileB', Buffer.from('a,b\n3,4\n'), { filename: 'bom-b.csv', contentType: 'text/csv' })
      .expect(503);

    expect(response.body.code).toBe('UPLOAD_QUEUE_ENQUEUE_FAILED');
    expect(response.body.correlationId).toBeDefined();
  });

  it('upload policy allows first three comparisons unrestricted and tracks usage', async () => {
    const email = `policy.user.${Date.now()}@example.com`;
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email, tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const one = await agent
      .post('/api/uploads/validate')
      .attach('fileA', Buffer.from('a,b\n1,2\n'), { filename: 'bom-1.csv', contentType: 'text/csv' })
      .attach('fileB', Buffer.from('a,b\n3,4\n'), { filename: 'bom-2.csv', contentType: 'text/csv' })
      .expect(201);
    expect(one.body.policy.comparisonsUsed).toBe(1);
    expect(one.body.policy.unrestrictedComparisonsRemaining).toBe(2);

    const two = await agent
      .post('/api/uploads/validate')
      .attach('fileA', Buffer.from('a,b\n5,6\n'), { filename: 'bom-3.csv', contentType: 'text/csv' })
      .attach('fileB', Buffer.from('a,b\n7,8\n'), { filename: 'bom-4.csv', contentType: 'text/csv' })
      .expect(201);
    expect(two.body.policy.comparisonsUsed).toBe(2);
    expect(two.body.policy.unrestrictedComparisonsRemaining).toBe(1);

    const three = await agent
      .post('/api/uploads/validate')
      .attach('fileA', Buffer.from('a,b\n9,10\n'), { filename: 'bom-5.csv', contentType: 'text/csv' })
      .attach('fileB', Buffer.from('a,b\n11,12\n'), { filename: 'bom-6.csv', contentType: 'text/csv' })
      .expect(201);
    expect(three.body.policy.comparisonsUsed).toBe(3);
    expect(three.body.policy.unrestrictedComparisonsRemaining).toBe(0);
  });

  it('upload policy blocks the 4th attempt during cooldown and allows after expiry', async () => {
    const email = `cooldown.user.${Date.now()}@example.com`;
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email, tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const postValidPair = () =>
      agent
        .post('/api/uploads/validate')
        .attach('fileA', Buffer.from('a,b\n1,2\n'), { filename: 'cool-1.csv', contentType: 'text/csv' })
        .attach('fileB', Buffer.from('a,b\n3,4\n'), { filename: 'cool-2.csv', contentType: 'text/csv' });

    await postValidPair().expect(201);
    await postValidPair().expect(201);
    await postValidPair().expect(201);

    const blocked = await postValidPair().expect(429);
    expect(blocked.body.code).toBe('UPLOAD_COOLDOWN_ACTIVE');
    expect(blocked.body.cooldownUntilUtc).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 150));
    const acceptedAfterCooldown = await postValidPair().expect(201);
    expect(acceptedAfterCooldown.body.policy.comparisonsUsed).toBe(4);
    expect(acceptedAfterCooldown.body.policy.unrestrictedComparisonsRemaining).toBe(0);
  });
});
