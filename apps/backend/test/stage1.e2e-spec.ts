import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as session from 'express-session';
import * as passport from 'passport';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import * as XLSX from 'xlsx';
import { AppModule } from '../src/app.module';
import { UploadHistoryService } from '../src/uploads/upload-history.service';
import { UploadJobService } from '../src/uploads/upload-job.service';
import {
  CONFIDENCE_BANDS,
  CONDITIONAL_CANONICAL_FIELDS,
  DETECTION_CONFLICT_POLICY,
  EXTENDED_CANONICAL_FIELDS,
  MAPPING_CONTRACT_VERSION,
  MAPPING_EDIT_POLICY,
  OPTIONAL_CANONICAL_FIELDS,
  REQUIRED_CANONICAL_FIELDS,
  resolveReviewState
} from '../src/mapping/mapping-contract';
import { MappingDetectionService } from '../src/mapping/mapping-detection.service';
import { MappingAuditService } from '../src/mapping/mapping-audit.service';
import { MappingFieldPolicyService } from '../src/mapping/mapping-field-policy.service';
import { MappingPersistenceService } from '../src/mapping/mapping-persistence.service';
import { SemanticRegistryService } from '../src/mapping/semantic-registry.service';
import {
  ATTRIBUTE_CONCORDANCE_ORDER,
  CHANGE_TAXONOMY,
  DIFF_CONTRACT_VERSION,
  MATCH_STRATEGY_ORDER,
  MatchDecision,
  NEAR_TIE_DELTA,
  TIE_BREAK_ORDER
} from '../src/diff/diff-contract';
import { MatcherService } from '../src/diff/matcher.service';
import { NormalizationService } from '../src/diff/normalization.service';
import { ClassificationService } from '../src/diff/classification.service';
import { DiffComputationService } from '../src/diff/diff-computation.service';
import { ProfileAdapterService } from '../src/diff/profile-adapter.service';
import { S14_MAPPING_FIXTURES } from './fixtures/mapping-s14-fixtures';

const binaryParser = (res: any, callback: (err: Error | null, body: Buffer) => void): void => {
  const data: Buffer[] = [];
  res.on('data', (chunk: Buffer | string) => {
    data.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  res.on('end', () => callback(null, Buffer.concat(data)));
  res.on('error', (err: Error) => callback(err, Buffer.alloc(0)));
};

describe('Stage 1 API baseline (e2e)', () => {
  let app: INestApplication;
  let uploadHistoryService: UploadHistoryService;
  let uploadJobService: UploadJobService;
  let semanticRegistryService: SemanticRegistryService;
  let mappingDetectionService: MappingDetectionService;
  let mappingPersistenceService: MappingPersistenceService;
  let mappingAuditService: MappingAuditService;
  let mappingFieldPolicyService: MappingFieldPolicyService;
  let normalizationService: NormalizationService;
  let matcherService: MatcherService;
  let classificationService: ClassificationService;
  let diffComputationService: DiffComputationService;
  let profileAdapterService: ProfileAdapterService;

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
    semanticRegistryService = moduleFixture.get(SemanticRegistryService);
    mappingDetectionService = moduleFixture.get(MappingDetectionService);
    mappingPersistenceService = moduleFixture.get(MappingPersistenceService);
    mappingAuditService = moduleFixture.get(MappingAuditService);
    mappingFieldPolicyService = moduleFixture.get(MappingFieldPolicyService);
    normalizationService = moduleFixture.get(NormalizationService);
    matcherService = moduleFixture.get(MatcherService);
    classificationService = moduleFixture.get(ClassificationService);
    diffComputationService = moduleFixture.get(DiffComputationService);
    profileAdapterService = moduleFixture.get(ProfileAdapterService);
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

  it('consent tracking requires acceptance and re-prompts on version changes', async () => {
    const previousConsentTracking = process.env.CONSENT_TRACKING_V1;
    const previousTermsVersion = process.env.TERMS_VERSION;
    const previousPrivacyVersion = process.env.PRIVACY_VERSION;
    const previousTermsUrl = process.env.TERMS_URL;
    const previousPrivacyUrl = process.env.PRIVACY_URL;

    process.env.CONSENT_TRACKING_V1 = 'true';
    process.env.TERMS_VERSION = '2026-03';
    process.env.PRIVACY_VERSION = '2026-03';
    process.env.TERMS_URL = 'https://example.com/terms/2026-03';
    process.env.PRIVACY_URL = 'https://example.com/privacy/2026-03';

    const agent = request.agent(app.getHttpServer());

    try {
      await agent
        .post('/api/auth/test/login')
        .send({ email: 'consent.user@example.com', tenantId: 'tenant-consent', provider: 'google' })
        .expect(201);

      const initialStatus = await agent.get('/api/auth/consent/status').expect(200);
      expect(initialStatus.body.consentTrackingEnabled).toBe(true);
      expect(initialStatus.body.consentRequired).toBe(true);
      expect(initialStatus.body.termsVersion).toBe('2026-03');
      expect(initialStatus.body.privacyVersion).toBe('2026-03');

      const meBefore = await agent.get('/api/auth/me').expect(200);
      expect(meBefore.body.consentRequired).toBe(true);

      const accepted = await agent.post('/api/auth/consent/accept').expect(201);
      expect(accepted.body.accepted).toBe(true);
      expect(accepted.body.consentRequired).toBe(false);
      expect(accepted.body.acceptedAtUtc).toBeTruthy();

      const statusAfterAccept = await agent.get('/api/auth/consent/status').expect(200);
      expect(statusAfterAccept.body.consentRequired).toBe(false);
      expect(statusAfterAccept.body.acceptedAtUtc).toBeTruthy();

      process.env.TERMS_VERSION = '2026-04';
      const statusAfterVersionBump = await agent.get('/api/auth/consent/status').expect(200);
      expect(statusAfterVersionBump.body.consentRequired).toBe(true);
      expect(statusAfterVersionBump.body.termsVersion).toBe('2026-04');
    } finally {
      process.env.CONSENT_TRACKING_V1 = previousConsentTracking;
      process.env.TERMS_VERSION = previousTermsVersion;
      process.env.PRIVACY_VERSION = previousPrivacyVersion;
      process.env.TERMS_URL = previousTermsUrl;
      process.env.PRIVACY_URL = previousPrivacyUrl;
    }
  });

  it('rate limiting is bypassed in test env unless explicitly enabled', async () => {
    const previousRateLimitingV1 = process.env.RATE_LIMITING_V1;
    const previousRateLimitingInTest = process.env.RATE_LIMITING_IN_TEST;
    const previousRateLimitBaseline = process.env.RATE_LIMIT_BASELINE_RPM;

    process.env.RATE_LIMITING_V1 = 'true';
    delete process.env.RATE_LIMITING_IN_TEST;
    process.env.RATE_LIMIT_BASELINE_RPM = '1';

    try {
      await request(app.getHttpServer()).get('/api/health').expect(200);
      await request(app.getHttpServer()).get('/api/health').expect(200);
      await request(app.getHttpServer()).get('/api/health').expect(200);
    } finally {
      process.env.RATE_LIMITING_V1 = previousRateLimitingV1;
      process.env.RATE_LIMITING_IN_TEST = previousRateLimitingInTest;
      process.env.RATE_LIMIT_BASELINE_RPM = previousRateLimitBaseline;
    }
  });

  it('rate limiting returns 429 when explicitly enabled in test env', async () => {
    const previousRateLimitingV1 = process.env.RATE_LIMITING_V1;
    const previousRateLimitingInTest = process.env.RATE_LIMITING_IN_TEST;
    const previousRateLimitBaseline = process.env.RATE_LIMIT_BASELINE_RPM;

    process.env.RATE_LIMITING_V1 = 'true';
    process.env.RATE_LIMITING_IN_TEST = 'true';
    process.env.RATE_LIMIT_BASELINE_RPM = '2';

    try {
      await request(app.getHttpServer()).get('/api/health').expect(200);
      await request(app.getHttpServer()).get('/api/health').expect(200);
      const blocked = await request(app.getHttpServer()).get('/api/health').expect(429);
      expect(blocked.body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(blocked.body.policy.limit).toBe(2);
      expect(blocked.headers['retry-after']).toBeDefined();
    } finally {
      process.env.RATE_LIMITING_V1 = previousRateLimitingV1;
      process.env.RATE_LIMITING_IN_TEST = previousRateLimitingInTest;
      process.env.RATE_LIMIT_BASELINE_RPM = previousRateLimitBaseline;
    }
  });

  it('rate-limit allowlist bypasses throttling for exempt tenant', async () => {
    const previousRateLimitingV1 = process.env.RATE_LIMITING_V1;
    const previousRateLimitingInTest = process.env.RATE_LIMITING_IN_TEST;
    const previousRateLimitBaseline = process.env.RATE_LIMIT_BASELINE_RPM;
    const previousExemptTenants = process.env.RATE_LIMIT_EXEMPT_TENANT_IDS;

    const exemptAgent = request.agent(app.getHttpServer());
    

    try {
      process.env.RATE_LIMITING_V1 = 'false';
      await exemptAgent
        .post('/api/auth/test/login')
        .send({ email: 'rate.exempt@example.com', tenantId: 'tenant-rate-exempt', provider: 'google' })
        .expect(201);

      process.env.RATE_LIMITING_V1 = 'true';
      process.env.RATE_LIMITING_IN_TEST = 'true';
      process.env.RATE_LIMIT_BASELINE_RPM = '1';
      process.env.RATE_LIMIT_EXEMPT_TENANT_IDS = 'tenant-rate-exempt';

      await exemptAgent.get('/api/auth/me').expect(200);
      await exemptAgent.get('/api/auth/me').expect(200);
      await exemptAgent.get('/api/auth/me').expect(200);
    } finally {
      process.env.RATE_LIMITING_V1 = previousRateLimitingV1;
      process.env.RATE_LIMITING_IN_TEST = previousRateLimitingInTest;
      process.env.RATE_LIMIT_BASELINE_RPM = previousRateLimitBaseline;
      process.env.RATE_LIMIT_EXEMPT_TENANT_IDS = previousExemptTenants;
    }
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
    const email = `uploader.${Date.now()}@example.com`;
    await agent
      .post('/api/auth/test/login')
      //.send({ email: 'uploader@example.com', tenantId: 'tenant-a', provider: 'google' })
      .send({ email, tenantId: 'tenant-a', provider: 'google' })
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
      .attach('fileA', Buffer.from('part_number,description,quantity\nBOM-A,Widget A,2\n'), {
        filename: 'bom-a.csv',
        contentType: 'text/csv'
      })
      .attach('fileB', Buffer.from('part_number,description,quantity\nBOM-A,Widget A,3\n'), {
        filename: 'bom-b.csv',
        contentType: 'text/csv'
      })
      .expect(202);

    expect(response.body.status).toBe('accepted');
    expect(response.body.jobId).toBeDefined();
    expect(response.body.sessionId).toBeDefined();
    expect(response.body.leftRevisionId).toBeDefined();
    expect(response.body.rightRevisionId).toBeDefined();
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
      .attach('fileA', Buffer.from('part_number,description,quantity\nBOM-A,Widget A,2\n'), {
        filename: 'bom-a.csv',
        contentType: 'text/csv'
      })
      .attach('fileB', Buffer.from('part_number,description,quantity\nBOM-A,Widget A,3\n'), {
        filename: 'bom-b.csv',
        contentType: 'text/csv'
      })
      .expect(202);

    const second = await agent
      .post('/api/uploads/intake')
      .set('Idempotency-Key', idempotencyKey)
      .attach('fileA', Buffer.from('part_number,description,quantity\nBOM-A,Widget A,2\n'), {
        filename: 'bom-a.csv',
        contentType: 'text/csv'
      })
      .attach('fileB', Buffer.from('part_number,description,quantity\nBOM-A,Widget A,3\n'), {
        filename: 'bom-b.csv',
        contentType: 'text/csv'
      })
      .expect(202);

    expect(second.body.idempotentReplay).toBe(true);
    expect(second.body.jobId).toBe(first.body.jobId);
    expect(second.body.sessionId).toBe(first.body.sessionId);
    expect(second.body.leftRevisionId).toBe(first.body.leftRevisionId);
    expect(second.body.rightRevisionId).toBe(first.body.rightRevisionId);
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
      .attach('fileA', Buffer.from('part_number,description,quantity\nBOM-A,Widget A,2\n'), {
        filename: 'bom-a.csv',
        contentType: 'text/csv'
      })
      .attach('fileB', Buffer.from('part_number,description,quantity\nBOM-A,Widget A,3\n'), {
        filename: 'bom-b.csv',
        contentType: 'text/csv'
      })
      .expect(202);

    const history = await uploadHistoryService.findByJobId(response.body.jobId);
    expect(history).toBeDefined();
    expect(history?.historyId).toBe(response.body.historyId);
    expect(history?.sessionId).toBe(response.body.sessionId);
    expect(history?.status).toBe('queued');
    expect(history?.initiatorEmail).toBe(email);

    const job = await uploadJobService.findByJobId(response.body.jobId);
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
      .attach('fileA', Buffer.from('part_number,description,quantity\nBOM-A,Widget A,2\n'), {
        filename: 'bom-a.csv',
        contentType: 'text/csv'
      })
      .attach('fileB', Buffer.from('part_number,description,quantity\nBOM-A,Widget A,3\n'), {
        filename: 'bom-b.csv',
        contentType: 'text/csv'
      })
      .expect(503);

    expect(response.body.code).toBe('UPLOAD_QUEUE_ENQUEUE_FAILED');
    expect(response.body.correlationId).toBeDefined();
  });

  it('upload intake rejects corrupt xlsx with structured parse error', async () => {
    const email = `parse.fail.${Date.now()}@example.com`;
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email, tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const response = await agent
      .post('/api/uploads/intake')
      .attach('fileA', Buffer.from('PK\x03\x04not-a-real-workbook'), {
        filename: 'broken-a.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      .attach('fileB', Buffer.from('PK\x03\x04also-broken'), {
        filename: 'broken-b.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      .expect(400);

    expect(response.body.code).toBe('UPLOAD_PARSE_WORKBOOK_INVALID');
    expect(response.body.correlationId).toBeDefined();
    expect(response.body.parserMode).toBe('xlsx');
  });

  it('history parity supports list, rename, tag, and soft-delete for owner only', async () => {
    const ownerEmail = `history.owner.${Date.now()}@example.com`;
    const ownerAgent = request.agent(app.getHttpServer());
    await ownerAgent
      .post('/api/auth/test/login')
      .send({ email: ownerEmail, tenantId: 'tenant-history', provider: 'google' })
      .expect(201);

    const intake = await ownerAgent
      .post('/api/uploads/intake')
      .attach('fileA', Buffer.from('part_number,description,quantity\nBOM-H,Widget H,2\n'), {
        filename: 'history-a.csv',
        contentType: 'text/csv'
      })
      .attach('fileB', Buffer.from('part_number,description,quantity\nBOM-H,Widget H,3\n'), {
        filename: 'history-b.csv',
        contentType: 'text/csv'
      })
      .expect(202);

    const historyId = intake.body.historyId as string;
    expect(historyId).toBeDefined();

    const listed = await ownerAgent.get('/api/history/sessions').expect(200);
    const existing = (listed.body.sessions as Array<{ historyId: string }>).find(
      (entry) => entry.historyId === historyId
    );
    expect(existing).toBeDefined();

    const renamed = await ownerAgent
      .post(`/api/history/sessions/${historyId}/rename`)
      .send({ sessionName: 'Release Compare A' })
      .expect(201);
    expect(renamed.body.session.sessionName).toBe('Release Compare A');

    const tagged = await ownerAgent
      .post(`/api/history/sessions/${historyId}/tag`)
      .send({ tagLabel: 'release-a' })
      .expect(201);
    expect(tagged.body.session.tagLabel).toBe('release-a');

    const otherAgent = request.agent(app.getHttpServer());
    await otherAgent
      .post('/api/auth/test/login')
      .send({ email: `history.other.${Date.now()}@example.com`, tenantId: 'tenant-history', provider: 'google' })
      .expect(201);
    await otherAgent
      .post(`/api/history/sessions/${historyId}/rename`)
      .send({ sessionName: 'HACK' })
      .expect(404);

    await ownerAgent.post(`/api/history/sessions/${historyId}/delete`).expect(201);
    const afterDelete = await ownerAgent.get('/api/history/sessions').expect(200);
    expect(
      (afterDelete.body.sessions as Array<{ historyId: string }>).some(
        (entry) => entry.historyId === historyId
      )
    ).toBe(false);
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

  it('upload policy allows configured unlimited users without cooldown blocking', async () => {
    const email = `unlimited.user.${Date.now()}@example.com`;
    const previous = process.env.UPLOAD_UNLIMITED_USER_EMAILS;
    process.env.UPLOAD_UNLIMITED_USER_EMAILS = email.toUpperCase();

    try {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/api/auth/test/login')
        .send({ email, tenantId: 'tenant-a', provider: 'google' })
        .expect(201);

      const postValidPair = () =>
        agent
          .post('/api/uploads/validate')
          .attach('fileA', Buffer.from('part_number,quantity\nA,1\n'), {
            filename: 'allow-a.csv',
            contentType: 'text/csv'
          })
          .attach('fileB', Buffer.from('part_number,quantity\nB,1\n'), {
            filename: 'allow-b.csv',
            contentType: 'text/csv'
          });

      for (let i = 0; i < 5; i += 1) {
        const response = await postValidPair().expect(201);
        expect(response.body.policy.isUnlimited).toBe(true);
        expect(response.body.policy.cooldownUntilUtc).toBeNull();
      }
    } finally {
      if (previous === undefined) {
        delete process.env.UPLOAD_UNLIMITED_USER_EMAILS;
      } else {
        process.env.UPLOAD_UNLIMITED_USER_EMAILS = previous;
      }
    }
  });

  it('stage 3 mapping contract exposes canonical fields and confidence bands', () => {
    expect(MAPPING_CONTRACT_VERSION).toBe('v1');
    expect(DETECTION_CONFLICT_POLICY).toBe('fresh_detection_precedence');
    expect(MAPPING_EDIT_POLICY).toBe('owner_only');
    expect(REQUIRED_CANONICAL_FIELDS).toEqual(['part_number', 'description', 'quantity']);
    expect(CONDITIONAL_CANONICAL_FIELDS).toEqual(['revision']);
    expect(OPTIONAL_CANONICAL_FIELDS).toEqual(['supplier', 'cost', 'lifecycle_status']);
    expect(EXTENDED_CANONICAL_FIELDS).toEqual(
      expect.arrayContaining([
        'unit_of_measure',
        'find_number',
        'assembly',
        'parent_path',
        'plant',
        'make_buy',
        'material',
        'finish',
        'weight',
        'effectivity_from',
        'effectivity_to',
        'serial_range',
        'drawing_number',
        'manufacturer_part_number',
        'customer_part_number',
        'compliance_status',
        'hazard_class',
        'location',
        'discipline',
        'program',
        'reference_designator',
        'asset_id',
        'ifc_class'
      ])
    );
    expect(CONFIDENCE_BANDS.autoMapMin).toBe(0.9);
    expect(CONFIDENCE_BANDS.reviewRequiredMin).toBe(0.7);
    expect(resolveReviewState(0.95)).toBe('AUTO');
    expect(resolveReviewState(0.75)).toBe('REVIEW_REQUIRED');
    expect(resolveReviewState(0.65)).toBe('LOW_CONFIDENCE_WARNING');
  });

  it('stage 3 semantic registry resolves multilingual aliases with metadata', () => {
    const match = semanticRegistryService.findExact('Número de parte', {
      domains: ['electronics'],
      languages: ['es']
    });

    expect(match).toBeDefined();
    expect(match?.canonicalField).toBe('part_number');
    expect(match?.language).toBe('es');
    expect(match?.domain).toBe('electronics');
    expect(match?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('stage 3 semantic registry resolves explicit profile aliases beyond legacy domains', () => {
    const automotive = semanticRegistryService.findExact('PPAP Status', {
      domains: ['automotive'],
      languages: ['en']
    });
    const construction = semanticRegistryService.findExact('IFC Class', {
      domains: ['ifc_schedule'],
      languages: ['en']
    });

    expect(automotive?.canonicalField).toBe('ppap_status');
    expect(automotive?.domain).toBe('automotive');
    expect(construction?.canonicalField).toBe('ifc_class');
    expect(construction?.domain).toBe('ifc_schedule');
  });

  it('stage 3 semantic registry covers representative industry and source-system aliases', () => {
    expect(
      semanticRegistryService.findExact('Work Center', { domains: ['manufacturing'], languages: ['en'] })?.canonicalField
    ).toBe('work_center');
    expect(
      semanticRegistryService.findExact('Drawing Number', { domains: ['aerospace'], languages: ['en'] })?.canonicalField
    ).toBe('drawing_number');
    expect(
      semanticRegistryService.findExact('Manufacturer Part Number', { domains: ['electronics'], languages: ['en'] })?.canonicalField
    ).toBe('manufacturer_part_number');
    expect(
      semanticRegistryService.findExact('Discipline', { domains: ['construction'], languages: ['en'] })?.canonicalField
    ).toBe('discipline');
    expect(
      semanticRegistryService.findExact('Reference Designator', { domains: ['ipc_bom'], languages: ['en'] })?.canonicalField
    ).toBe('reference_designator');
    expect(
      semanticRegistryService.findExact('Unit of Measure', { domains: ['erp_generic'], languages: ['en'] })?.canonicalField
    ).toBe('unit_of_measure');
    expect(
      semanticRegistryService.findExact('Find No', { domains: ['sap_bom'], languages: ['en'] })?.canonicalField
    ).toBe('find_number');
    expect(
      semanticRegistryService.findExact('Assembly Path', { domains: ['teamcenter_bom'], languages: ['en'] })?.canonicalField
    ).toBe('parent_path');
    expect(
      semanticRegistryService.findExact('Parent Path', { domains: ['plm_generic'], languages: ['en'] })?.canonicalField
    ).toBe('parent_path');
  });

  it('stage 3 pass-1 detection runs exact before fuzzy and keeps deterministic strategies', () => {
    const pass1 = mappingDetectionService.detectPass1(['Part Number', 'Part Numbr'], {
      domains: ['electronics'],
      languages: ['en']
    });

    const exact = pass1.candidates.find((candidate) => candidate.sourceColumn === 'Part Number');
    const fuzzy = pass1.candidates.find((candidate) => candidate.sourceColumn === 'Part Numbr');

    expect(exact?.strategy).toBe('REGISTRY_EXACT');
    expect(exact?.confidence).toBeGreaterThanOrEqual(CONFIDENCE_BANDS.autoMapMin);
    expect(fuzzy?.strategy).toBe('REGISTRY_FUZZY');
    expect(fuzzy?.confidence).toBeGreaterThanOrEqual(CONFIDENCE_BANDS.reviewRequiredMin);
    expect(pass1.unmappedColumns).toEqual([]);
  });

  it('stage 3 pass-2 heuristic maps likely columns and marks unresolved as warning state', () => {
    const detected = mappingDetectionService.detectColumns(
      ['Needed Count', 'Mystery Header'],
      {
        sampleRows: [
          { 'Needed Count': 12, 'Mystery Header': 'abc' },
          { 'Needed Count': 5, 'Mystery Header': 'def' }
        ]
      }
    );

    const heuristicMatch = detected.find((candidate) => candidate.sourceColumn === 'Needed Count');
    const unresolved = detected.find((candidate) => candidate.sourceColumn === 'Mystery Header');

    expect(heuristicMatch?.strategy).toBe('HEURISTIC');
    expect(heuristicMatch?.canonicalField).toBe('quantity');
    expect(heuristicMatch?.confidence).toBeGreaterThanOrEqual(CONFIDENCE_BANDS.reviewRequiredMin);
    expect(unresolved?.strategy).toBe('HEURISTIC');
    expect(unresolved?.canonicalField).toBeNull();
    expect(unresolved?.reviewState).toBe('LOW_CONFIDENCE_WARNING');
  });

  it('stage 3 pass-2 heuristics use profiles and sample-value patterns for industry fields', () => {
    const detected = mappingDetectionService.detectColumns(
      ['RefDes', 'Install Phase', 'UOM'],
      {
        profiles: ['ipc_bom', 'construction'],
        sampleRows: [
          { RefDes: 'R12', 'Install Phase': 'Rough-In', UOM: 'EA' },
          { RefDes: 'C7', 'Install Phase': 'Final', UOM: 'PCS' }
        ]
      }
    );

    expect(detected.find((candidate) => candidate.sourceColumn === 'RefDes')).toEqual(
      expect.objectContaining({
        canonicalField: 'reference_designator',
        reviewState: 'REVIEW_REQUIRED'
      })
    );
    expect(detected.find((candidate) => candidate.sourceColumn === 'Install Phase')).toEqual(
      expect.objectContaining({
        canonicalField: 'install_phase'
      })
    );
    expect(detected.find((candidate) => candidate.sourceColumn === 'UOM')).toEqual(
      expect.objectContaining({
        canonicalField: 'unit_of_measure'
      })
    );
  });

  it('stage 3 negative rules suppress false quantity and construction lifecycle mappings', () => {
    const quantityLike = mappingDetectionService.detectColumns(
      ['Line Qty'],
      {
        sampleRows: [
          { 'Line Qty': 10 },
          { 'Line Qty': 20 },
          { 'Line Qty': 30 }
        ]
      }
    )[0];

    const constructionStatus = mappingDetectionService.detectColumns(
      ['Status'],
      {
        profiles: ['construction'],
        sampleRows: [
          { Status: 'Open' },
          { Status: 'Closed' },
          { Status: 'For Review' }
        ]
      }
    )[0];

    expect(quantityLike.canonicalField).not.toBe('quantity');
    expect(quantityLike.evidence?.negativeSignals).toEqual(
      expect.arrayContaining(['negative_rule_line_number_vs_quantity', 'negative_rule_sequential_numeric_values'])
    );
    expect(constructionStatus.canonicalField).toBeNull();
    expect(constructionStatus.evidence?.negativeSignals).toEqual(
      expect.arrayContaining(['negative_rule_construction_workflow_status'])
    );
  });

  it('GET /api/mappings/preview/:revisionId requires authentication', async () => {
    const response = await request(app.getHttpServer()).get('/api/mappings/preview/rev-s3-preview').expect(401);
    expect(response.body.code).toBe('AUTH_REQUIRED');
  });

  it('GET /api/mappings/preview/:revisionId returns deterministic preview payload', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'mapping.preview@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const response = await agent.get('/api/mappings/preview/rev-s3-preview').expect(200);
    expect(response.body.contractVersion).toBe(MAPPING_CONTRACT_VERSION);
    expect(response.body.revisionId).toBe('rev-s3-preview');
    expect(Array.isArray(response.body.columns)).toBe(true);
    expect(Array.isArray(response.body.sampleRows)).toBe(true);
    expect(Array.isArray(response.body.requiredFieldsStatus)).toBe(true);
    expect(response.body.canProceed).toBe(true);

    expect(response.body.columns.map((column: { sourceColumn: string }) => column.sourceColumn)).toEqual([
      'Part Number',
      'Descriptin',
      'Needed Count',
      'Mystery Header'
    ]);
    expect(response.body.columns.map((column: { strategy: string }) => column.strategy)).toEqual([
      'REGISTRY_EXACT',
      'REGISTRY_FUZZY',
      'HEURISTIC',
      'HEURISTIC'
    ]);
    expect(response.body.columns[0].evidence.reasons).toEqual(expect.arrayContaining(['exact_alias']));
    expect(response.body.columns[2].evidence.reasons).toEqual(expect.arrayContaining(['regex-quantity']));

    const requiredStatuses = response.body.requiredFieldsStatus.reduce(
      (acc: Record<string, { mapped: boolean; warning: boolean }>, status: { field: string; mapped: boolean; warning: boolean }) => {
        acc[status.field] = { mapped: status.mapped, warning: status.warning };
        return acc;
      },
      {}
    );
    expect(requiredStatuses.part_number?.mapped).toBe(true);
    expect(requiredStatuses.description?.mapped).toBe(true);
    expect(requiredStatuses.quantity?.mapped).toBe(true);
  });

  it('GET /api/mappings/preview/:revisionId accepts profile hints and returns profile-weighted evidence', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'mapping.profile@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const response = await agent
      .get('/api/mappings/preview/rev-s3-preview?profile=manufacturing')
      .expect(200);

    expect(response.body.columns[0].evidence.profile).toBe('manufacturing');
    expect(response.body.columns[0].fieldClass).toBe('identity');
    expect(response.body.columns[0].evidence.reasons).toEqual(
      expect.arrayContaining(['industry_template'])
    );
  });

  it('mapping preview reuses tenant-confirmed aliases without leaking to other tenants', async () => {
    const tenantA = request.agent(app.getHttpServer());
    const tenantB = request.agent(app.getHttpServer());

    await tenantA
      .post('/api/auth/test/login')
      .send({ email: 'mapping.learn.a@example.com', tenantId: 'tenant-learn-a', provider: 'google' })
      .expect(201);
    await tenantB
      .post('/api/auth/test/login')
      .send({ email: 'mapping.learn.b@example.com', tenantId: 'tenant-learn-b', provider: 'google' })
      .expect(201);

    for (const revisionId of ['rev-s14-tenant-learning-1', 'rev-s14-tenant-learning-2', 'rev-s14-tenant-learning-3']) {
      await tenantA
        .post('/api/mappings/confirm')
        .send({
          contractVersion: 'v1',
          revisionId,
          explicitWarningAcknowledged: true,
          mappings: [
            {
              sourceColumn: 'MFG Plant Code',
              canonicalField: 'plant',
              reviewState: 'REVIEW_REQUIRED'
            }
          ]
        })
        .expect(201);
    }

    const learned = await tenantA.get('/api/mappings/preview/rev-s14-tenant-learning-preview').expect(200);
    const learnedColumn = learned.body.columns.find(
      (column: { sourceColumn: string }) => column.sourceColumn === 'MFG Plant Code'
    );
    expect(learnedColumn).toEqual(
      expect.objectContaining({
        canonicalField: 'plant',
        strategy: 'TENANT_PACK',
        reviewState: 'AUTO'
      })
    );
    expect(learnedColumn.evidence.reasons).toEqual(expect.arrayContaining(['tenant_confirmation']));

    const isolated = await tenantB.get('/api/mappings/preview/rev-s14-tenant-learning-preview').expect(200);
    const isolatedColumn = isolated.body.columns.find(
      (column: { sourceColumn: string }) => column.sourceColumn === 'MFG Plant Code'
    );
    expect(isolatedColumn.strategy).not.toBe('TENANT_PACK');
  });

  it('stage 14 field policy classifies canonical fields conservatively by profile', () => {
    expect(mappingFieldPolicyService.classifyField('part_number', ['manufacturing'])).toBe('identity');
    expect(mappingFieldPolicyService.classifyField('plant', ['manufacturing'])).toBe('business_impact');
    expect(mappingFieldPolicyService.classifyField('assembly', ['manufacturing'])).toBe('display');
    expect(mappingFieldPolicyService.classifyField('manufacturer_part_number', ['ipc_bom'])).toBe('identity');
    expect(mappingFieldPolicyService.classifyField('reference_designator', ['electronics'])).toBe('identity');
    expect(mappingFieldPolicyService.classifyField('drawing_number', ['aerospace'])).toBe('identity');
    expect(mappingFieldPolicyService.classifyField('effectivity', ['aerospace'])).toBe('business_impact');
    expect(mappingFieldPolicyService.classifyField('description', ['construction'])).toBe('comparable');
  });

  it('stage 14 diff profile policies include business-impact fields without changing existing identity rules', () => {
    const sap = profileAdapterService.adaptRows({
      rows: [
        {
          rowId: 'r1',
          partNumber: 'PN-1',
          description: 'Bracket',
          quantity: 1,
          supplier: 'SUP-1',
          plant: 'PL01'
        }
      ],
      context: { headers: ['Component Number', 'Path Predecessor', 'Plant'], fileName: 'sap_export.xlsx' }
    });

    expect(sap.profileName).toBe('sap');
    expect(sap.fieldPolicy.identity).toEqual(expect.arrayContaining(['stableOccurrenceKey', 'snapshotRowKey']));
    expect(sap.fieldPolicy.comparable).toEqual(expect.arrayContaining(['plant', 'supplier', 'cost']));
    expect(sap.fieldPolicy.businessImpact).toEqual(expect.arrayContaining(['plant', 'supplier', 'cost', 'quantity']));
    expect(sap.fieldPolicy.identity).not.toEqual(expect.arrayContaining(['plant']));
  });

  it.each(S14_MAPPING_FIXTURES)(
    'stage 14 industry mapping fixture $name maps expected headers deterministically',
    (fixture) => {
      const detected = mappingDetectionService.detectColumns(fixture.headers, {
        profiles: fixture.profiles as any,
        sampleRows: fixture.sampleRows
      });

      const simplified = fixture.expected.map((expected) => ({
        sourceColumn: expected.sourceColumn,
        canonicalField: detected.find((candidate) => candidate.sourceColumn === expected.sourceColumn)?.canonicalField ?? null
      }));

      expect(simplified).toEqual(fixture.expected);

      for (const expected of fixture.expected) {
        const candidate = detected.find((row) => row.sourceColumn === expected.sourceColumn);
        expect(candidate?.evidence?.reasons?.length || 0).toBeGreaterThan(0);
      }
    }
  );

  it('stage 14 regression matrix remains deterministic across repeated mapping runs', () => {
    for (const fixture of S14_MAPPING_FIXTURES) {
      const first = mappingDetectionService.detectColumns(fixture.headers, {
        profiles: fixture.profiles as any,
        sampleRows: fixture.sampleRows
      });
      const second = mappingDetectionService.detectColumns(fixture.headers, {
        profiles: fixture.profiles as any,
        sampleRows: fixture.sampleRows
      });

      expect(first).toEqual(second);
    }
  });

  it('POST /api/mappings/confirm requires authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/mappings/confirm')
      .send({
        contractVersion: 'v1',
        revisionId: 'rev-unauth',
        explicitWarningAcknowledged: true,
        mappings: [{ sourceColumn: 'Part Number', canonicalField: 'part_number', reviewState: 'AUTO' }]
      })
      .expect(401);
  });

  it('mapping confirm persists immutable snapshot and retrieval returns stored mapping', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'mapping.confirm@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const confirm = await agent
      .post('/api/mappings/confirm')
      .send({
        contractVersion: 'v1',
        revisionId: 'rev-s3-immutable',
        explicitWarningAcknowledged: true,
        mappings: [
          {
            sourceColumn: 'Part Number',
            canonicalField: 'part_number',
            reviewState: 'AUTO',
            strategy: 'REGISTRY_EXACT',
            confidence: 1
          },
          {
            sourceColumn: 'Mystery Header',
            canonicalField: '__unmapped__',
            reviewState: 'LOW_CONFIDENCE_WARNING',
            strategy: 'HEURISTIC',
            confidence: 0.5
          }
        ]
      })
      .expect(201);

    expect(confirm.body.mappingId).toBeDefined();
    expect(confirm.body.revisionId).toBe('rev-s3-immutable');
    expect(confirm.body.immutable).toBe(true);

    const fetchSaved = await agent.get('/api/mappings/rev-s3-immutable').expect(200);
    expect(fetchSaved.body.mappingId).toBe(confirm.body.mappingId);
    expect(fetchSaved.body.immutable).toBe(true);
    expect(fetchSaved.body.mappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceColumn: 'Part Number', canonicalField: 'part_number' }),
        expect.objectContaining({ sourceColumn: 'Mystery Header', canonicalField: null })
      ])
    );
  });

  it('mapping confirm rejects second confirmation for same tenant/revision', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'mapping.conflict@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const payload = {
      contractVersion: 'v1',
      revisionId: 'rev-s3-conflict',
      explicitWarningAcknowledged: true,
      mappings: [{ sourceColumn: 'Part Number', canonicalField: 'part_number', reviewState: 'AUTO' }]
    };

    await agent.post('/api/mappings/confirm').send(payload).expect(201);
    const conflict = await agent.post('/api/mappings/confirm').send(payload).expect(409);
    expect(conflict.body.code).toBe('MAPPING_IMMUTABLE_ALREADY_CONFIRMED');
  });

  it('mapping preview/confirm appends tenant-scoped audit entries queryable by revision', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'mapping.audit@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    await agent.get('/api/mappings/preview/rev-s3-audit-preview').expect(200);

    await agent
      .post('/api/mappings/confirm')
      .send({
        contractVersion: 'v1',
        revisionId: 'rev-s3-audit-preview',
        explicitWarningAcknowledged: true,
        mappings: [
          {
            sourceColumn: 'Part Number',
            canonicalField: 'part_number',
            originalCanonicalField: 'part_number',
            reviewState: 'AUTO',
            strategy: 'REGISTRY_EXACT',
            confidence: 1
          },
          {
            sourceColumn: 'Mystery Header',
            canonicalField: 'supplier',
            originalCanonicalField: null,
            reviewState: 'LOW_CONFIDENCE_WARNING',
            strategy: 'HEURISTIC',
            confidence: 0.5
          }
        ]
      })
      .expect(201);

    const audits = await mappingAuditService.getByRevision('tenant-a', 'rev-s3-audit-preview');
    expect(audits.length).toBeGreaterThan(0);
    expect(audits.some((entry) => entry.strategy === 'HEURISTIC')).toBe(true);
    expect(audits.some((entry) => entry.strategy === 'MANUAL' && entry.changedTo === 'supplier')).toBe(true);

    await expect(mappingPersistenceService.getRevisionMapping('tenant-a', 'rev-s3-audit-preview')).resolves.toBeDefined();
  });

  it('stage 4 deterministic contract constants are locked in order', () => {
    expect(DIFF_CONTRACT_VERSION).toBe('v1');
    expect(MATCH_STRATEGY_ORDER).toEqual([
      'INTERNAL_ID',
      'PART_NUMBER_REVISION',
      'PART_NUMBER',
      'FUZZY',
      'NO_MATCH'
    ]);
    expect(TIE_BREAK_ORDER).toEqual([
      'UNIQUENESS_FIRST',
      'HIGHEST_SCORE',
      'ATTRIBUTE_CONCORDANCE',
      'STABLE_FALLBACK_INDEX',
      'NEAR_TIE_REVIEW_REQUIRED'
    ]);
    expect(ATTRIBUTE_CONCORDANCE_ORDER).toEqual(['description', 'quantity', 'supplier']);
    expect(NEAR_TIE_DELTA).toBe(0.01);
    expect(CHANGE_TAXONOMY).toEqual([
      'added',
      'removed',
      'replaced',
      'modified',
      'moved',
      'quantity_change',
      'no_change'
    ]);
  });

  it('stage 4 normalization rules canonicalize text, part numbers, numeric and units', () => {
    const normalized = normalizationService.normalizeRow({
      rowId: 's-1',
      partNumber: ' pn-001 ',
      description: '  Motor   Assembly ',
      quantity: Number('01.000'),
      supplier: ' Acme  Corp '
    });
    expect(normalized.row.partNumber).toBe('PN001');
    expect(normalized.row.description).toBe('MOTOR ASSEMBLY');
    expect(normalized.row.quantity).toBe(1);
    expect(normalized.row.supplier).toBe('ACME CORP');
    expect(normalized.metadata.length).toBeGreaterThan(0);

    const uom = normalizationService.normalizeWithUom(1, 'm');
    expect(uom.value).toBe(1000);
    expect(uom.unit).toBe('MM');
  });

  it('stage 4 matcher enforces one-to-one lock and deterministic strategy order', () => {
    const source = [
      { rowId: 's1', internalId: 'X1', partNumber: 'pn-1', revision: 'a', description: 'Bracket', quantity: 2 },
      { rowId: 's2', internalId: 'X1', partNumber: 'pn-1', revision: 'a', description: 'Bracket', quantity: 2 }
    ];
    const target = [
      { rowId: 't1', internalId: 'X1', partNumber: 'pn-1', revision: 'a', description: 'Bracket', quantity: 2 }
    ];
    const result = matcherService.match(source, target);
    const matched = result.matches.filter((m) => !!m.targetRowId);
    expect(matched.length).toBe(1);
    expect(matched[0].strategy).toBe('INTERNAL_ID');
    expect(result.unmatchedSourceIds).toEqual(['s2']);
  });

  it('stage 4 matcher marks near-tie ambiguous fuzzy candidates as review-required', () => {
    const source = [{ rowId: 's1', description: 'gear plate', quantity: 1 }];
    const target = [
      { rowId: 't1', description: 'gear-plate', quantity: 1 },
      { rowId: 't2', description: 'gear plate ', quantity: 1 }
    ];
    const result = matcherService.match(source, target);
    const decision = result.matches[0];
    expect(decision.strategy).toBe('FUZZY');
    expect(decision.reviewRequired).toBe(true);
    expect(decision.targetRowId).toBeNull();
    expect(decision.reasonCode).toBe('near_tie_review_required');
  });

  it('stage 4 classification emits taxonomy rows with rationale metadata', () => {
    const source = [
      { rowId: 's-nochange', partNumber: 'PN-1', revision: 'A', description: 'A', quantity: 1, parentPath: '/root' },
      { rowId: 's-qty', partNumber: 'PN-2', revision: 'A', description: 'B', quantity: 1, parentPath: '/root' },
      { rowId: 's-moved', partNumber: 'PN-3', revision: 'A', description: 'C', quantity: 2, parentPath: '/left' },
      { rowId: 's-removed', partNumber: 'PN-4', revision: 'A', description: 'D', quantity: 1, parentPath: '/root' },
      { rowId: 's-replaced', partNumber: 'OLD-9', revision: 'A', description: 'SWITCH', quantity: 1, parentPath: '/p', position: '10' }
    ];
    const target = [
      { rowId: 't-nochange', partNumber: 'PN-1', revision: 'A', description: 'A', quantity: 1, parentPath: '/root' },
      { rowId: 't-qty', partNumber: 'PN-2', revision: 'A', description: 'B', quantity: 3, parentPath: '/root' },
      { rowId: 't-moved', partNumber: 'PN-3', revision: 'A', description: 'C', quantity: 2, parentPath: '/right' },
      { rowId: 't-added', partNumber: 'PN-5', revision: 'A', description: 'E', quantity: 1, parentPath: '/root' },
      { rowId: 't-replaced', partNumber: 'NEW-9', revision: 'A', description: 'SWITCH', quantity: 1, parentPath: '/p', position: '10' }
    ];

    const matches: MatchDecision[] = [
      { sourceRowId: 's-nochange', targetRowId: 't-nochange', strategy: 'PART_NUMBER_REVISION', score: 0.98, reviewRequired: false, tieBreakTrace: ['UNIQUENESS_FIRST'], reasonCode: 'ok' },
      { sourceRowId: 's-qty', targetRowId: 't-qty', strategy: 'PART_NUMBER_REVISION', score: 0.98, reviewRequired: false, tieBreakTrace: ['UNIQUENESS_FIRST'], reasonCode: 'ok' },
      { sourceRowId: 's-moved', targetRowId: 't-moved', strategy: 'PART_NUMBER_REVISION', score: 0.98, reviewRequired: false, tieBreakTrace: ['UNIQUENESS_FIRST'], reasonCode: 'ok' }
    ];

    const classified = classificationService.classify({
      sourceRows: source,
      targetRows: target,
      matches: [...matches],
      unmatchedSourceIds: ['s-removed', 's-replaced'],
      unmatchedTargetIds: ['t-added', 't-replaced']
    });

    const byType = (type: string) => classified.filter((row) => row.changeType === type);
    expect(byType('no_change').length).toBe(1);
    expect(byType('quantity_change').length).toBe(1);
    expect(byType('moved').length).toBe(1);
    expect(byType('removed').length).toBe(1);
    expect(byType('added').length).toBe(1);
    expect(byType('replaced').length).toBe(1);
    expect(classified.some((row) => row.cells.length >= 0 && !!row.reasonCode)).toBe(true);
  });

  it('stage 7 adapter contract emits stable/snapshot keys with SAP profile detection', () => {
    const adapted = profileAdapterService.adaptRows({
      context: {
        fileName: 'example-sap.xlsx',
        headers: ['Component Number', 'Path predecessor', 'Explosion level', 'Plant', 'Item node']
      },
      rows: [
        {
          rowId: 'A-1',
          partNumber: '22K203AF',
          description: 'BRKT - BRK CLIP',
          parentPath: 'IDX:1',
          hierarchyLevel: 2,
          position: '0010'
        }
      ]
    });

    expect(adapted.profileName).toBe('sap');
    expect(adapted.confidence).toBeGreaterThanOrEqual(0.5);
    expect(adapted.rows[0].stableOccurrenceKey).toContain('sap|');
    expect(adapted.rows[0].snapshotRowKey).toContain('|row:');
    expect(adapted.rows[0].internalId).toBe(adapted.rows[0].stableOccurrenceKey);
  });

  it('stage 7 generic adapter fallback is deterministic across runs for unknown formats', () => {
    const inputRows = [
      {
        rowId: 'A-10',
        partNumber: 'ABC-100',
        description: 'Widget',
        parentPath: '/root',
        position: '10'
      },
      {
        rowId: 'A-11',
        partNumber: 'ABC-100',
        description: 'Widget',
        parentPath: '/root',
        position: '20'
      }
    ];

    const first = profileAdapterService
      .adaptRows({
        context: {
          fileName: 'mystery.xlsx',
          headers: ['My PN', 'My Description', 'My Qty']
        },
        rows: inputRows
      })
      .rows.map((row) => ({
        stableOccurrenceKey: row.stableOccurrenceKey,
        snapshotRowKey: row.snapshotRowKey
      }));

    const second = profileAdapterService
      .adaptRows({
        context: {
          fileName: 'mystery.xlsx',
          headers: ['My PN', 'My Description', 'My Qty']
        },
        rows: inputRows
      })
      .rows.map((row) => ({
        stableOccurrenceKey: row.stableOccurrenceKey,
        snapshotRowKey: row.snapshotRowKey
      }));

    expect(first).toEqual(second);
    expect(first.every((row) => !!row.stableOccurrenceKey)).toBe(true);
  });

  it('stage 7 profile field policy keeps Plant as comparable delta (not identity break)', () => {
    const computed = diffComputationService.compute({
      sourceRows: [
        {
          rowId: 's1',
          partNumber: '22K203AF',
          description: 'BRKT - BRK CLIP',
          parentPath: 'IDX:1',
          position: '0010',
          plant: '1862'
        }
      ],
      targetRows: [
        {
          rowId: 't1',
          partNumber: '22K203AF',
          description: 'BRKT - BRK CLIP',
          parentPath: 'IDX:1',
          position: '0010',
          plant: '1863'
        }
      ],
      sourceContext: {
        fileName: 'example-sap.xlsx',
        headers: ['Component Number', 'Path predecessor', 'Plant']
      },
      targetContext: {
        fileName: 'example-sap.xlsx',
        headers: ['Component Number', 'Path predecessor', 'Plant']
      }
    });

    expect(computed.rows.length).toBe(1);
    expect(computed.rows[0].changeType).toBe('modified');
    expect(computed.rows[0].rationale.changedFields).toContain('plant');
    expect(computed.counters.replaced).toBe(0);
  });

  it('stage 7 strict ambiguity gate suppresses ambiguous replacement pairing', () => {
    const previousStrict = process.env.MATCHER_AMBIGUITY_STRICT_V1;
    const previousComposite = process.env.MATCHER_COMPOSITE_KEY_V1;
    process.env.MATCHER_AMBIGUITY_STRICT_V1 = 'true';
    process.env.MATCHER_COMPOSITE_KEY_V1 = 'false';

    try {
      const computed = diffComputationService.compute({
        sourceRows: [
          { rowId: 's1', partNumber: 'OLD-1', description: 'SWITCH', parentPath: '/p', position: '10', quantity: 1 },
          { rowId: 's2', partNumber: 'OLD-2', description: 'SWITCH', parentPath: '/p', position: '10', quantity: 1 }
        ],
        targetRows: [
          { rowId: 't1', partNumber: 'NEW-1', description: 'SWITCH', parentPath: '/p', position: '10', quantity: 1 },
          { rowId: 't2', partNumber: 'NEW-2', description: 'SWITCH', parentPath: '/p', position: '10', quantity: 1 }
        ]
      });

      expect(computed.counters.replaced).toBe(0);
      expect(computed.diagnostics.replacementSuppressionRate).toBeGreaterThanOrEqual(0);
      expect(computed.diagnostics.flags.ambiguityStrictEnabled).toBe(true);
      expect(computed.diagnostics.ambiguityRate).toBeGreaterThanOrEqual(0);
    } finally {
      if (previousStrict === undefined) delete process.env.MATCHER_AMBIGUITY_STRICT_V1;
      else process.env.MATCHER_AMBIGUITY_STRICT_V1 = previousStrict;
      if (previousComposite === undefined) delete process.env.MATCHER_COMPOSITE_KEY_V1;
      else process.env.MATCHER_COMPOSITE_KEY_V1 = previousComposite;
    }
  });

  it('stage 7 matcher flags disable adapter/composite behavior safely', () => {
    const previousProfile = process.env.MATCHER_PROFILE_ADAPTERS_V1;
    const previousComposite = process.env.MATCHER_COMPOSITE_KEY_V1;
    const previousStrict = process.env.MATCHER_AMBIGUITY_STRICT_V1;
    process.env.MATCHER_PROFILE_ADAPTERS_V1 = 'false';
    process.env.MATCHER_COMPOSITE_KEY_V1 = 'false';
    process.env.MATCHER_AMBIGUITY_STRICT_V1 = 'false';

    try {
      const computed = diffComputationService.compute({
        sourceRows: [
          { rowId: 's1', partNumber: 'A-1', description: 'Widget', quantity: 1 }
        ],
        targetRows: [
          { rowId: 't1', partNumber: 'A-1', description: 'Widget', quantity: 1 }
        ]
      });

      expect(computed.rows[0].sourceSnapshot?.stableOccurrenceKey ?? null).toBeNull();
      expect(computed.rows[0].targetSnapshot?.stableOccurrenceKey ?? null).toBeNull();
      expect(computed.diagnostics.flags.profileAdaptersEnabled).toBe(false);
      expect(computed.diagnostics.flags.compositeKeyEnabled).toBe(false);
      expect(computed.diagnostics.flags.ambiguityStrictEnabled).toBe(false);
    } finally {
      if (previousProfile === undefined) delete process.env.MATCHER_PROFILE_ADAPTERS_V1;
      else process.env.MATCHER_PROFILE_ADAPTERS_V1 = previousProfile;
      if (previousComposite === undefined) delete process.env.MATCHER_COMPOSITE_KEY_V1;
      else process.env.MATCHER_COMPOSITE_KEY_V1 = previousComposite;
      if (previousStrict === undefined) delete process.env.MATCHER_AMBIGUITY_STRICT_V1;
      else process.env.MATCHER_AMBIGUITY_STRICT_V1 = previousStrict;
    }
  });

  it('POST /api/diff-jobs requires authentication', async () => {
    await request(app.getHttpServer()).post('/api/diff-jobs').send({}).expect(401);
  });

  it('GET /api/exports/csv/:comparisonId requires authentication', async () => {
    await request(app.getHttpServer()).get('/api/exports/csv/not-authenticated').expect(401);
  });

  it('GET /api/exports/excel/:comparisonId requires authentication', async () => {
    await request(app.getHttpServer()).get('/api/exports/excel/not-authenticated').expect(401);
  });

  it('diff engine flag can disable diff job start endpoint', async () => {
    const previous = process.env.DIFF_ENGINE_V1;
    process.env.DIFF_ENGINE_V1 = 'false';

    try {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/api/auth/test/login')
        .send({ email: 'flag.diff.engine@example.com', tenantId: 'tenant-a', provider: 'google' })
        .expect(201);

      const response = await agent.post('/api/diff-jobs').send({}).expect(503);
      expect(response.body.code).toBe('DIFF_ENGINE_DISABLED');
      expect(response.body.featureFlag).toBe('DIFF_ENGINE_V1');
    } finally {
      if (previous === undefined) {
        delete process.env.DIFF_ENGINE_V1;
      } else {
        process.env.DIFF_ENGINE_V1 = previous;
      }
    }
  });

  it('progressive diff API flag can disable status/rows endpoints', async () => {
    const previous = process.env.DIFF_PROGRESSIVE_API_V1;
    delete process.env.DIFF_PROGRESSIVE_API_V1;

    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'flag.diff.progressive@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);
    const started = await agent.post('/api/diff-jobs').send({}).expect(201);

    process.env.DIFF_PROGRESSIVE_API_V1 = 'off';
    try {
      const statusDisabled = await agent.get(`/api/diff-jobs/${started.body.jobId}`).expect(503);
      expect(statusDisabled.body.code).toBe('DIFF_PROGRESSIVE_API_DISABLED');
      expect(statusDisabled.body.featureFlag).toBe('DIFF_PROGRESSIVE_API_V1');

      const rowsDisabled = await agent.get(`/api/diff-jobs/${started.body.jobId}/rows?limit=10`).expect(503);
      expect(rowsDisabled.body.code).toBe('DIFF_PROGRESSIVE_API_DISABLED');
      expect(rowsDisabled.body.featureFlag).toBe('DIFF_PROGRESSIVE_API_V1');
    } finally {
      if (previous === undefined) {
        delete process.env.DIFF_PROGRESSIVE_API_V1;
      } else {
        process.env.DIFF_PROGRESSIVE_API_V1 = previous;
      }
    }
  });

  it('diff job status and rows support progressive cursor retrieval with rationale metadata', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'diff.user@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const started = await agent.post('/api/diff-jobs').send({}).expect(201);
    expect(started.body.contractVersion).toBe('v1');
    expect(started.body.jobId).toBeDefined();
    expect(started.body.totalRows).toBeGreaterThan(0);

    const jobId = started.body.jobId as string;
    const status1 = await agent.get(`/api/diff-jobs/${jobId}`).expect(200);
    expect(status1.body.phase).toBeDefined();
    expect(status1.body.percentComplete).toBeGreaterThan(0);
    expect(status1.body.counters.total).toBeGreaterThan(0);

    const chunk1 = await agent.get(`/api/diff-jobs/${jobId}/rows?limit=2`).expect(200);
    expect(Array.isArray(chunk1.body.rows)).toBe(true);
    expect(chunk1.body.rows.length).toBeLessThanOrEqual(2);
    expect(chunk1.body.rows.length).toBeGreaterThan(0);
    expect(chunk1.body.rows[0].rationale).toBeDefined();
    expect(Array.isArray(chunk1.body.rows[0].cells)).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 700));
    const status2 = await agent.get(`/api/diff-jobs/${jobId}`).expect(200);
    expect(status2.body.loadedRows).toBeGreaterThanOrEqual(status1.body.loadedRows);

    const cursor = chunk1.body.nextCursor || String(chunk1.body.rows.length);
    const chunk2 = await agent.get(`/api/diff-jobs/${jobId}/rows?cursor=${cursor}&limit=10`).expect(200);
    const combinedIds = [...chunk1.body.rows, ...chunk2.body.rows].map((row: { rowId: string }) => row.rowId);
    expect(new Set(combinedIds).size).toBe(combinedIds.length);
  });

  it('stage 4 baseline timings stay within agreed small-fixture budgets', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'diff.perf.small@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const startedAt = Date.now();
    const started = await agent.post('/api/diff-jobs').send({}).expect(201);
    const firstProgressMs = Date.now() - startedAt;
    expect(firstProgressMs).toBeLessThan(2000);

    let firstChunkMs: number | null = null;
    let completed = false;
    while (Date.now() - startedAt < 30000) {
      const rowsResponse = await agent.get(`/api/diff-jobs/${started.body.jobId}/rows?limit=50`).expect(200);
      if (firstChunkMs === null && rowsResponse.body.rows.length > 0) {
        firstChunkMs = Date.now() - startedAt;
      }

      const status = await agent.get(`/api/diff-jobs/${started.body.jobId}`).expect(200);
      if (status.body.status === 'completed') {
        completed = true;
        break;
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
    }

    expect(firstChunkMs).not.toBeNull();
    expect(firstChunkMs as number).toBeLessThan(5000);
    expect(completed).toBe(true);
    expect(Date.now() - startedAt).toBeLessThan(30000);
  });

  it('diff jobs enforce tenant access boundaries', async () => {
    const agentA = request.agent(app.getHttpServer());
    await agentA
      .post('/api/auth/test/login')
      .send({ email: 'tenant.a@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);
    const started = await agentA.post('/api/diff-jobs').send({}).expect(201);
    const jobId = started.body.jobId as string;

    const agentB = request.agent(app.getHttpServer());
    await agentB
      .post('/api/auth/test/login')
      .send({ email: 'tenant.b@example.com', tenantId: 'tenant-b', provider: 'google' })
      .expect(201);
    const denied = await agentB.get(`/api/diff-jobs/${jobId}`).expect(403);
    expect(denied.body.code).toBe('TENANT_ACCESS_DENIED');
  });

  it('csv export downloads full comparison dataset synchronously for owner', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'export.owner@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const started = await agent.post('/api/diff-jobs').send({}).expect(201);
    const comparisonId = started.body.jobId as string;

    const exported = await agent.get(`/api/exports/csv/${comparisonId}`).expect(200);
    expect(exported.headers['content-type']).toContain('text/csv');
    expect(exported.headers['content-disposition']).toContain('attachment;');
    expect(exported.headers['content-disposition']).toContain('.csv');

    const csv = exported.text;
    expect(csv).toContain('comparisonId,rowId,changeType,sourceIndex,targetIndex,partNumber,revision,description');
    expect(csv).toContain(comparisonId);

    const dataLines = csv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    expect(dataLines.length).toBeGreaterThan(1);
  });

  it('csv export denies same-tenant non-owner access', async () => {
    const owner = request.agent(app.getHttpServer());
    await owner
      .post('/api/auth/test/login')
      .send({ email: 'export.owner2@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const started = await owner.post('/api/diff-jobs').send({}).expect(201);
    const comparisonId = started.body.jobId as string;

    const otherUser = request.agent(app.getHttpServer());
    await otherUser
      .post('/api/auth/test/login')
      .send({ email: 'export.viewer@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const denied = await otherUser.get(`/api/exports/csv/${comparisonId}`).expect(403);
    expect(denied.body.code).toBe('EXPORT_ACCESS_DENIED');
  });

  it('excel export downloads valid workbook synchronously for owner', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'export.excel.owner@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const started = await agent.post('/api/diff-jobs').send({}).expect(201);
    const comparisonId = started.body.jobId as string;

    const exported = await agent
      .get(`/api/exports/excel/${comparisonId}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);
    expect(exported.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(exported.headers['content-disposition']).toContain('attachment;');
    expect(exported.headers['content-disposition']).toContain('.xlsx');
    expect(exported.body).toBeDefined();
    expect(Buffer.isBuffer(exported.body)).toBe(true);
    expect(exported.body.length).toBeGreaterThan(100);
    expect(exported.body.slice(0, 2).toString('utf8')).toBe('PK');
  });

  it('excel export preserves source header order from uploaded comparison template', async () => {
    const csvA = Buffer.from(
      'Part Number,Revision,Description,Quantity,Color,Units,Cost,Category\nP-100,A,Bracket,2,Blue,EA,1.50,Hardware\n'
    );
    const csvB = Buffer.from(
      'Cost,Color,Units,Category,Part Number,Description,Revision,Quantity\n2.00,Red,EA,Hardware,P-100,Bracket,A,3\n'
    );

    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'export.excel.template@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const intake = await agent
      .post('/api/uploads/intake')
      .attach('fileA', csvA, { filename: 'template-a.csv', contentType: 'text/csv' })
      .attach('fileB', csvB, { filename: 'template-b.csv', contentType: 'text/csv' })
      .expect(202);

    const started = await agent
      .post('/api/diff-jobs')
      .send({
        sessionId: intake.body.sessionId,
        leftRevisionId: intake.body.leftRevisionId,
        rightRevisionId: intake.body.rightRevisionId
      })
      .expect(201);

    const exported = await agent
      .get(`/api/exports/excel/${started.body.jobId}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);
    const workbook = XLSX.read(exported.body, { type: 'buffer' });
    expect(workbook.SheetNames.length).toBeGreaterThan(0);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const firstRow = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })[0] as string[];
    expect(firstRow.slice(0, 8)).toEqual([
      'Cost',
      'Color',
      'Units',
      'Category',
      'Part Number',
      'Description',
      'Revision',
      'Quantity'
    ]);
    expect(firstRow).toEqual(
      expect.arrayContaining(['Change Type', 'Changed Fields', 'Classification Reason'])
    );
  });

  it('excel export preserves workbook template structure and table metadata for uploaded xlsx', async () => {
    const templateV1 = readFileSync(
      resolve(process.cwd(), '..', '..', 'docs', 'BOM Examples', 'Example 1 ver 1.xlsx')
    );
    const templateV2 = readFileSync(
      resolve(process.cwd(), '..', '..', 'docs', 'BOM Examples', 'Example 1 ver 2.xlsx')
    );

    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'export.excel.preserve@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const intake = await agent
      .post('/api/uploads/intake')
      .attach('fileA', templateV1, {
        filename: 'example1-ver1.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      .attach('fileB', templateV2, {
        filename: 'example1-ver2.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      .expect(202);

    const started = await agent
      .post('/api/diff-jobs')
      .send({
        sessionId: intake.body.sessionId,
        leftRevisionId: intake.body.leftRevisionId,
        rightRevisionId: intake.body.rightRevisionId
      })
      .expect(201);

    const exported = await agent
      .get(`/api/exports/excel/${started.body.jobId}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const templateWorkbook = XLSX.read(templateV2, {
      type: 'buffer',
      cellStyles: true,
      bookFiles: true,
      cellNF: true,
      cellText: true
    });
    const exportedWorkbook = XLSX.read(exported.body, {
      type: 'buffer',
      cellStyles: true,
      bookFiles: true,
      cellNF: true,
      cellText: true
    });

    expect(exportedWorkbook.SheetNames).toEqual(
      expect.arrayContaining(templateWorkbook.SheetNames)
    );
    expect(exportedWorkbook.SheetNames).toContain('Comparison Metadata');

    const templateSheet = templateWorkbook.Sheets[templateWorkbook.SheetNames[0]];
    const resultSheet = exportedWorkbook.Sheets[templateWorkbook.SheetNames[0]];
    expect(resultSheet['!cols']?.[0]?.wpx).toBe(templateSheet['!cols']?.[0]?.wpx);
    expect(resultSheet['!cols']?.[1]?.wpx).toBe(templateSheet['!cols']?.[1]?.wpx);
    expect((resultSheet['A2']?.v as string | number) || '').toBe((templateSheet['A2']?.v as string | number) || '');
    expect((resultSheet['C2']?.v as string) || '').toBe((templateSheet['C2']?.v as string) || '');
    expect((resultSheet['S1']?.v as string) || '').toBe('Change Type');
    expect((resultSheet['T1']?.v as string) || '').toBe('Changed Fields');
    expect((resultSheet['U1']?.v as string) || '').toBe('Classification Reason');
    const metadataSheet = exportedWorkbook.Sheets['Comparison Metadata'];
    expect(metadataSheet['!cols']?.[0]?.hidden).toBe(true);

    const exportedTableXml = String(
      (exportedWorkbook as XLSX.WorkBook & { files?: Record<string, { content: string | Buffer }> }).files?.['xl/tables/table1.xml']
        ?.content || ''
    );
    expect(exportedTableXml).toContain('<table');
    expect(exportedTableXml).toContain('ref="A1:U');
  });

  it('excel export preserves drawing and media parts for image-based uploaded xlsx', async () => {
    const templateV1 = readFileSync(
      resolve(process.cwd(), '..', '..', 'docs', 'BOM Examples', 'Example 6 ver 1 MEVS.xlsx')
    );
    const templateV2 = readFileSync(
      resolve(process.cwd(), '..', '..', 'docs', 'BOM Examples', 'Example 6 ver 2 MEVS.xlsx')
    );

    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'export.excel.media@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const intake = await agent
      .post('/api/uploads/intake')
      .attach('fileA', templateV1, {
        filename: 'example6-ver1.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      .attach('fileB', templateV2, {
        filename: 'example6-ver2.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      .expect(202);

    const started = await agent
      .post('/api/diff-jobs')
      .send({
        sessionId: intake.body.sessionId,
        leftRevisionId: intake.body.leftRevisionId,
        rightRevisionId: intake.body.rightRevisionId
      })
      .expect(201);

    const exported = await agent
      .get(`/api/exports/excel/${started.body.jobId}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const templateZip = unzipSync(new Uint8Array(templateV2));
    const exportedZip = unzipSync(new Uint8Array(exported.body));
    expect(exportedZip['xl/drawings/drawing1.xml']).toBeDefined();
    expect(exportedZip['xl/drawings/_rels/drawing1.xml.rels']).toBeDefined();
    expect(exportedZip['xl/media/image1.png']).toBeDefined();
    expect(strFromU8(exportedZip['xl/worksheets/_rels/sheet1.xml.rels'])).toContain('relationships/drawing');
    const exportedSheetXml = strFromU8(exportedZip['xl/worksheets/sheet1.xml']);
    expect(exportedSheetXml).toContain('<drawing r:id=');
    expect(exportedSheetXml).not.toMatch(/<col\b[^>]*\bmin="[^"]*"[^>]*\bmin="[^"]*"/);
    expect(exportedSheetXml).not.toMatch(/<col\b[^>]*\bmax="[^"]*"[^>]*\bmax="[^"]*"/);

    const templateHeaderRow = strFromU8(templateZip['xl/worksheets/sheet1.xml']).match(/<row r="1"[\s\S]*?<\/row>/)?.[0] || '';
    const exportedHeaderRow = exportedSheetXml.match(/<row r="1"[\s\S]*?<\/row>/)?.[0] || '';
    expect(exportedHeaderRow).toContain('<c r="A1" s="1"');
    expect(exportedHeaderRow).toContain('<c r="D1" s="15"');
    expect(exportedHeaderRow).toContain('<c r="AF1"');
    expect(templateHeaderRow).toContain('<c r="A1" s="1"');
  });

  it('excel export denies same-tenant non-owner access', async () => {
    const owner = request.agent(app.getHttpServer());
    await owner
      .post('/api/auth/test/login')
      .send({ email: 'export.excel.owner2@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const started = await owner.post('/api/diff-jobs').send({}).expect(201);
    const comparisonId = started.body.jobId as string;

    const otherUser = request.agent(app.getHttpServer());
    await otherUser
      .post('/api/auth/test/login')
      .send({ email: 'export.excel.viewer@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const denied = await otherUser.get(`/api/exports/excel/${comparisonId}`).expect(403);
    expect(denied.body.code).toBe('EXPORT_ACCESS_DENIED');
  });

  it('sharing invite grants same-tenant exact-email read access and revoke removes access', async () => {
    const owner = request.agent(app.getHttpServer());
    await owner
      .post('/api/auth/test/login')
      .send({ email: 'share.owner@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);
    const started = await owner.post('/api/diff-jobs').send({}).expect(201);
    const comparisonId = started.body.jobId as string;

    const notInvited = request.agent(app.getHttpServer());
    await notInvited
      .post('/api/auth/test/login')
      .send({ email: 'share.blocked@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);
    const deniedBeforeInvite = await notInvited.get(`/api/diff-jobs/${comparisonId}`).expect(403);
    expect(deniedBeforeInvite.body.code).toBe('SHARE_ACCESS_DENIED');

    await owner
      .post('/api/shares/invite')
      .send({
        comparisonId,
        invitedEmails: ['share.viewer@example.com']
      })
      .expect(201);

    const viewer = request.agent(app.getHttpServer());
    await viewer
      .post('/api/auth/test/login')
      .send({ email: 'share.viewer@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);
    await viewer.get(`/api/diff-jobs/${comparisonId}`).expect(200);
    await viewer.get(`/api/exports/csv/${comparisonId}`).expect(200);

    await owner
      .post('/api/shares/revoke')
      .send({
        comparisonId,
        invitedEmails: ['share.viewer@example.com']
      })
      .expect(201);

    const deniedAfterRevoke = await viewer.get(`/api/diff-jobs/${comparisonId}`).expect(403);
    expect(deniedAfterRevoke.body.code).toBe('SHARE_ACCESS_DENIED');
  });

  it('share listing is owner-only and enforces owner gate', async () => {
    const owner = request.agent(app.getHttpServer());
    await owner
      .post('/api/auth/test/login')
      .send({ email: 'share.owner.list@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);
    const started = await owner.post('/api/diff-jobs').send({}).expect(201);
    const comparisonId = started.body.jobId as string;
    await owner
      .post('/api/shares/invite')
      .send({
        comparisonId,
        invitedEmails: ['share.recipient.list@example.com']
      })
      .expect(201);

    const ownerList = await owner.get(`/api/shares/${comparisonId}`).expect(200);
    expect(Array.isArray(ownerList.body.recipients)).toBe(true);
    expect(ownerList.body.recipients[0].invitedEmail).toBe('share.recipient.list@example.com');
    expect(ownerList.body.recipients[0].permission).toBe('view');

    const other = request.agent(app.getHttpServer());
    await other
      .post('/api/auth/test/login')
      .send({ email: 'share.not.owner@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);
    const denied = await other.get(`/api/shares/${comparisonId}`).expect(403);
    expect(denied.body.code).toBe('SHARE_OWNER_REQUIRED');
  });

  it('notifications include comparison completed events with deep link', async () => {
    const user = request.agent(app.getHttpServer());
    await user
      .post('/api/auth/test/login')
      .send({ email: 'notify.completed@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const started = await user.post('/api/diff-jobs').send({}).expect(201);
    const comparisonId = started.body.jobId as string;
    let completed = false;
    for (let i = 0; i < 15; i += 1) {
      await new Promise((resolveDone) => setTimeout(resolveDone, 250));
      const status = await user.get(`/api/diff-jobs/${comparisonId}`).expect(200);
      if (status.body.status === 'completed') {
        completed = true;
        break;
      }
    }
    expect(completed).toBe(true);

    const notifications = await user.get('/api/notifications').expect(200);
    const completedNotifications = (notifications.body.notifications as Array<{ type: string; linkPath: string | null }>)
      .filter((row) => row.type === 'comparison_completed');
    expect(completedNotifications.length).toBeGreaterThan(0);
    expect(completedNotifications[0].linkPath).toContain(`/results?comparisonId=${comparisonId}`);
  });

  it('notifications include comparison failed events when diff start fails', async () => {
    const user = request.agent(app.getHttpServer());
    await user
      .post('/api/auth/test/login')
      .send({ email: 'notify.failed@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    await user
      .post('/api/diff-jobs')
      .send({
        sessionId: 'missing-session',
        leftRevisionId: 'missing-left',
        rightRevisionId: 'missing-right'
      })
      .expect(400);

    const notifications = await user.get('/api/notifications').expect(200);
    const failed = (notifications.body.notifications as Array<{ type: string; message: string }>)
      .filter((row) => row.type === 'comparison_failed');
    expect(failed.length).toBeGreaterThan(0);
    expect(failed[0].message).toContain('failed');
  });

  it('admin role claim gates admin APIs and supports upload policy override/reset actions', async () => {
    const admin = request.agent(app.getHttpServer());
    await admin
      .post('/api/auth/test/login')
      .send({ email: 'admin.user@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const deniedBeforeGrant = await admin.get('/api/admin/users').expect(403);
    expect(deniedBeforeGrant.body.code).toBe('ADMIN_REQUIRED');

    await admin
      .post('/api/admin/test/grant-role')
      .send({ userEmail: 'admin.user@example.com' })
      .expect(201);

    const me = await admin.get('/api/admin/me').expect(200);
    expect(me.body.isAdmin).toBe(true);

    const target = request.agent(app.getHttpServer());
    await target
      .post('/api/auth/test/login')
      .send({ email: 'policy.target@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    await admin
      .post('/api/admin/upload-policy/override')
      .send({
        userEmail: 'policy.target@example.com',
        isUnlimited: true,
        reason: 'qa'
      })
      .expect(201);

    const validateUnlimited = await target
      .post('/api/uploads/validate')
      .attach('fileA', Buffer.from('part,qty\nA,1\n'), { filename: 'admin-a.csv', contentType: 'text/csv' })
      .attach('fileB', Buffer.from('part,qty\nB,1\n'), { filename: 'admin-b.csv', contentType: 'text/csv' })
      .expect(201);
    expect(validateUnlimited.body.policy.isUnlimited).toBe(true);

    await admin
      .post('/api/admin/upload-policy/override')
      .send({
        userEmail: 'policy.target@example.com',
        isUnlimited: false,
        reason: 'qa'
      })
      .expect(201);

    await admin
      .post('/api/admin/upload-policy/reset')
      .send({
        userEmail: 'policy.target@example.com'
      })
      .expect(201);

    const users = await admin.get('/api/admin/users?query=policy.target').expect(200);
    expect(users.body.users.some((row: { email: string }) => row.email === 'policy.target@example.com')).toBe(true);
  });

  it('admin UI bootstrap, grant, revoke, and last-admin protection behave deterministically', async () => {
    const bootstrap = request.agent(app.getHttpServer());
    await bootstrap
      .post('/api/auth/test/login')
      .send({ email: 'bootstrap.admin@example.com', tenantId: 'tenant-bootstrap', provider: 'google' })
      .expect(201);

    const before = await bootstrap.get('/api/admin/me').expect(200);
    expect(before.body.isAdmin).toBe(false);
    expect(before.body.canBootstrapAdmin).toBe(true);

    await bootstrap.post('/api/admin/roles/grant').send({}).expect(201);

    const after = await bootstrap.get('/api/admin/me').expect(200);
    expect(after.body.isAdmin).toBe(true);
    expect(after.body.canBootstrapAdmin).toBe(false);

    const otherUser = request.agent(app.getHttpServer());
    await otherUser
      .post('/api/auth/test/login')
      .send({ email: 'second.admin@example.com', tenantId: 'tenant-bootstrap', provider: 'google' })
      .expect(201);

    await bootstrap
      .post('/api/admin/roles/grant')
      .send({ userEmail: 'second.admin@example.com' })
      .expect(201);

    const listed = await bootstrap.get('/api/admin/roles').expect(200);
    expect((listed.body.roles as Array<{ email: string }>).length).toBe(2);

    await bootstrap
      .post('/api/admin/roles/revoke')
      .send({ userEmail: 'second.admin@example.com' })
      .expect(201);

    const blocked = await bootstrap
      .post('/api/admin/roles/revoke')
      .send({ userEmail: 'bootstrap.admin@example.com' })
      .expect(403);
    expect(blocked.body.code).toBe('ADMIN_LAST_ROLE_REVOKE_BLOCKED');
  });

  it('mapping snapshot listing returns recently confirmed revisions for snapshot review UI', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'mapping.snapshots@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    await agent
      .post('/api/mappings/confirm')
      .send({
        contractVersion: 'v1',
        revisionId: 'rev-s15-snapshot-review',
        explicitWarningAcknowledged: true,
        mappings: [
          {
            sourceColumn: 'Part Number',
            canonicalField: 'part_number',
            originalCanonicalField: 'part_number',
            reviewState: 'AUTO',
            strategy: 'REGISTRY_EXACT',
            confidence: 1
          },
          {
            sourceColumn: 'Description',
            canonicalField: 'description',
            originalCanonicalField: 'description',
            reviewState: 'AUTO',
            strategy: 'REGISTRY_EXACT',
            confidence: 1
          }
        ]
      })
      .expect(201);

    const snapshots = await agent.get('/api/mappings').expect(200);
    expect(
      (snapshots.body.snapshots as Array<{ revisionId: string }>).some(
        (snapshot) => snapshot.revisionId === 'rev-s15-snapshot-review'
      )
    ).toBe(true);
  });

  it('tenant alias governance can disable a learned alias and remove tenant-pack promotion from preview', async () => {
    const admin = request.agent(app.getHttpServer());
    await admin
      .post('/api/auth/test/login')
      .send({ email: 'alias.admin@example.com', tenantId: 'tenant-alias-governance', provider: 'google' })
      .expect(201);

    for (const revisionId of ['rev-s14-tenant-learning-1', 'rev-s14-tenant-learning-2', 'rev-s14-tenant-learning-3']) {
      await admin
        .post('/api/mappings/confirm')
        .send({
          contractVersion: 'v1',
          revisionId,
          explicitWarningAcknowledged: true,
          mappings: [
            {
              sourceColumn: 'MFG Plant Code',
              canonicalField: 'plant',
              reviewState: 'AUTO',
              strategy: 'MANUAL',
              confidence: 1
            }
          ]
        })
        .expect(201);
    }

    await admin.post('/api/admin/roles/grant').send({}).expect(201);

    const aliases = await admin.get('/api/admin/mapping-governance/aliases?query=mfg plant').expect(200);
    expect(aliases.body.aliases.some((alias: { normalizedSourceColumn: string; isEnabled: boolean }) =>
      alias.normalizedSourceColumn === 'mfg plant code' && alias.isEnabled
    )).toBe(true);

    await admin
      .post('/api/admin/mapping-governance/aliases/state')
      .send({
        normalizedSourceColumn: 'MFG Plant Code',
        canonicalField: 'plant',
        isEnabled: false
      })
      .expect(201);

    const preview = await admin.get('/api/mappings/preview/rev-s14-tenant-learning-preview').expect(200);
    const plantColumn = (preview.body.columns as Array<{ sourceColumn: string; strategy: string }>).find(
      (column) => column.sourceColumn === 'MFG Plant Code'
    );
    expect(plantColumn).toBeDefined();
    expect(plantColumn?.strategy).not.toBe('TENANT_PACK');
  });

  it('admin audit export and archive endpoints enforce tenant scope and append-only evidence metadata', async () => {
    const tenantAAdmin = request.agent(app.getHttpServer());
    await tenantAAdmin
      .post('/api/auth/test/login')
      .send({ email: 'audit.admin.a@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const denied = await tenantAAdmin.get('/api/admin/audit/export?format=csv').expect(403);
    expect(denied.body.code).toBe('ADMIN_REQUIRED');

    await tenantAAdmin
      .post('/api/admin/test/grant-role')
      .send({ userEmail: 'audit.admin.a@example.com' })
      .expect(201);
    await tenantAAdmin.get('/api/admin/me').expect(200);

    const tenantBAdmin = request.agent(app.getHttpServer());
    await tenantBAdmin
      .post('/api/auth/test/login')
      .send({ email: 'audit.admin.b@example.com', tenantId: 'tenant-b', provider: 'google' })
      .expect(201);
    await tenantBAdmin
      .post('/api/admin/test/grant-role')
      .send({ userEmail: 'audit.admin.b@example.com' })
      .expect(201);
    await tenantBAdmin.get('/api/admin/me').expect(200);

    const exportCsv = await tenantAAdmin
      .get('/api/admin/audit/export?format=csv&limit=500')
      .expect(200);
    expect(exportCsv.headers['content-type']).toContain('text/csv');
    expect(exportCsv.text).toContain('tenantId');
    expect(exportCsv.text).toContain('tenant-a');
    const csvRows = exportCsv.text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(1);
    for (const row of csvRows) {
      expect(row.startsWith('202')).toBe(true);
      expect(row).toContain(',tenant-a,');
    }

    const archiveNow = new Date().toISOString();
    const archiveRun = await tenantAAdmin
      .post('/api/admin/audit/archive/run')
      .send({ nowUtcIso: archiveNow })
      .expect(201);
    expect(archiveRun.body.ok).toBe(true);
    expect(archiveRun.body.archive.appendOnly).toBe(true);
    expect(archiveRun.body.archive.retentionYears).toBeGreaterThanOrEqual(7);
    expect(archiveRun.body.archive.recordCount).toBeGreaterThan(0);
    expect(archiveRun.body.archive.tenantId).toBe('tenant-a');

    const archiveList = await tenantAAdmin.get('/api/admin/audit/archive/runs?limit=20').expect(200);
    const currentRun = (archiveList.body.runs as Array<{ archiveId: string }>).find(
      (row) => row.archiveId === archiveRun.body.archive.archiveId
    );
    expect(currentRun).toBeDefined();
  });

  it('stage 5 retention sweep enforces export/notification defaults and keeps active shares', async () => {
    const owner = request.agent(app.getHttpServer());
    await owner
      .post('/api/auth/test/login')
      .send({ email: 'retention.owner@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const started = await owner.post('/api/diff-jobs').send({}).expect(201);
    const comparisonId = started.body.jobId as string;
    for (let i = 0; i < 15; i += 1) {
      await new Promise((resolveDone) => setTimeout(resolveDone, 250));
      const status = await owner.get(`/api/diff-jobs/${comparisonId}`).expect(200);
      if (status.body.status === 'completed') {
        break;
      }
    }

    await owner.get(`/api/exports/csv/${comparisonId}`).expect(200);
    await owner
      .post('/api/shares/invite')
      .send({
        comparisonId,
        invitedEmails: ['retention.active.viewer@example.com', 'retention.revoked.viewer@example.com']
      })
      .expect(201);
    await owner
      .post('/api/shares/revoke')
      .send({
        comparisonId,
        invitedEmails: ['retention.revoked.viewer@example.com']
      })
      .expect(201);

    const activeViewer = request.agent(app.getHttpServer());
    await activeViewer
      .post('/api/auth/test/login')
      .send({ email: 'retention.active.viewer@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);
    await activeViewer.get(`/api/diff-jobs/${comparisonId}`).expect(200);

    const admin = request.agent(app.getHttpServer());
    await admin
      .post('/api/auth/test/login')
      .send({ email: 'retention.admin@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);
    await admin
      .post('/api/admin/test/grant-role')
      .send({ userEmail: 'retention.admin@example.com' })
      .expect(201);

    const plus8Days = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();
    const firstSweep = await admin
      .post('/api/admin/retention/run')
      .send({ nowUtcIso: plus8Days })
      .expect(201);
    expect(firstSweep.body.deletedExportArtifacts).toBeGreaterThan(0);
    expect(firstSweep.body.deletedRevokedShares).toBeGreaterThan(0);

    await activeViewer.get(`/api/diff-jobs/${comparisonId}`).expect(200);

    const plus91Days = new Date(Date.now() + 91 * 24 * 60 * 60 * 1000).toISOString();
    const secondSweep = await admin
      .post('/api/admin/retention/run')
      .send({ nowUtcIso: plus91Days })
      .expect(201);
    expect(secondSweep.body.deletedNotifications).toBeGreaterThan(0);

    const notifications = await owner.get('/api/notifications').expect(200);
    expect(notifications.body.notifications).toEqual([]);
  });

  it('stage 5 feature flags can disable export/share/notification/admin surfaces', async () => {
    const defaults = {
      exportFlag: process.env.EXPORT_STAGE5_V1,
      shareFlag: process.env.SHARING_STAGE5_V1,
      notificationsFlag: process.env.NOTIFICATIONS_STAGE5_V1,
      adminFlag: process.env.ADMIN_POLICY_UI_STAGE5_V1
    };

    process.env.EXPORT_STAGE5_V1 = 'false';
    process.env.SHARING_STAGE5_V1 = 'false';
    process.env.NOTIFICATIONS_STAGE5_V1 = 'false';
    process.env.ADMIN_POLICY_UI_STAGE5_V1 = 'false';

    try {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/api/auth/test/login')
        .send({ email: 'flag.user@example.com', tenantId: 'tenant-a', provider: 'google' })
        .expect(201);
      const started = await agent.post('/api/diff-jobs').send({}).expect(201);
      const comparisonId = started.body.jobId as string;

      const exportDisabled = await agent.get(`/api/exports/csv/${comparisonId}`).expect(503);
      expect(exportDisabled.body.code).toBe('EXPORT_STAGE5_DISABLED');

      const shareDisabled = await agent.get(`/api/shares/${comparisonId}`).expect(503);
      expect(shareDisabled.body.code).toBe('SHARING_STAGE5_DISABLED');

      const notificationsDisabled = await agent.get('/api/notifications').expect(503);
      expect(notificationsDisabled.body.code).toBe('NOTIFICATIONS_STAGE5_DISABLED');

      const adminDisabled = await agent.get('/api/admin/me').expect(503);
      expect(adminDisabled.body.code).toBe('ADMIN_STAGE5_DISABLED');
    } finally {
      if (defaults.exportFlag === undefined) delete process.env.EXPORT_STAGE5_V1;
      else process.env.EXPORT_STAGE5_V1 = defaults.exportFlag;
      if (defaults.shareFlag === undefined) delete process.env.SHARING_STAGE5_V1;
      else process.env.SHARING_STAGE5_V1 = defaults.shareFlag;
      if (defaults.notificationsFlag === undefined) delete process.env.NOTIFICATIONS_STAGE5_V1;
      else process.env.NOTIFICATIONS_STAGE5_V1 = defaults.notificationsFlag;
      if (defaults.adminFlag === undefined) delete process.env.ADMIN_POLICY_UI_STAGE5_V1;
      else process.env.ADMIN_POLICY_UI_STAGE5_V1 = defaults.adminFlag;
    }
  });

  it('diff jobs can run against uploaded revision pair rows from intake', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'diff.real.upload@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const intake = await agent
      .post('/api/uploads/intake')
      .attach('fileA', Buffer.from('part_number,revision,description,quantity\nAAA-1,A,Widget,2\n'), {
        filename: 'real-a.csv',
        contentType: 'text/csv'
      })
      .attach('fileB', Buffer.from('part_number,revision,description,quantity\nAAA-1,A,Widget,3\n'), {
        filename: 'real-b.csv',
        contentType: 'text/csv'
      })
      .expect(202);

    const started = await agent
      .post('/api/diff-jobs')
      .send({
        sessionId: intake.body.sessionId,
        leftRevisionId: intake.body.leftRevisionId,
        rightRevisionId: intake.body.rightRevisionId
      })
      .expect(201);

    await new Promise((resolve) => setTimeout(resolve, 800));
    const rows = await agent
      .get(`/api/diff-jobs/${started.body.jobId}/rows?limit=50`)
      .expect(200);
    expect(rows.body.rows.some((row: { keyFields: { partNumber: string } }) => row.keyFields.partNumber === 'AAA1')).toBe(true);
    expect(rows.body.rows.some((row: { changeType: string }) => row.changeType === 'quantity_change')).toBe(true);
  });

  it('diff jobs parse real xlsx fixtures and detect color/quantity/cost changes', async () => {
    const fixtureA = readFileSync(
      resolve(process.cwd(), '..', '..', 'tests', 'fixtures', 'stage4', 'bill-of-materials.xlsx')
    );
    const fixtureB = readFileSync(
      resolve(process.cwd(), '..', '..', 'tests', 'fixtures', 'stage4', 'bill-of-materialsv2.xlsx')
    );

    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'diff.real.xlsx@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const intake = await agent
      .post('/api/uploads/intake')
      .attach('fileA', fixtureA, {
        filename: 'bill-of-materials.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      .attach('fileB', fixtureB, {
        filename: 'bill-of-materialsv2.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      .expect(202);

    const started = await agent
      .post('/api/diff-jobs')
      .send({
        sessionId: intake.body.sessionId,
        leftRevisionId: intake.body.leftRevisionId,
        rightRevisionId: intake.body.rightRevisionId
      })
      .expect(201);

    await new Promise((resolveDone) => setTimeout(resolveDone, 1200));
    const rowsResponse = await agent.get(`/api/diff-jobs/${started.body.jobId}/rows?limit=2000`).expect(200);
    const rows = rowsResponse.body.rows as Array<{
      keyFields: { partNumber: string | null };
      changeType: string;
      rationale: { changedFields: string[] };
    }>;

    expect(rows.length).toBeGreaterThan(0);
    const target = rows.find((row) => row.keyFields.partNumber === '3023');
    expect(target).toBeDefined();
    expect(target?.changeType).toBe('modified');
    expect(target?.rationale.changedFields).toEqual(expect.arrayContaining(['color', 'quantity', 'cost']));
  });

  it(
    'stage 7 parses BOM Example MEVS headers and resolves non-empty part identities deterministically',
    async () => {
      const fixtureA = readFileSync(
      resolve(process.cwd(), '..', '..', 'docs', 'BOM Examples', 'Example 6 ver 1 MEVS.xlsx')
      );
      const fixtureB = readFileSync(
      resolve(process.cwd(), '..', '..', 'docs', 'BOM Examples', 'Example 6 ver 2 MEVS.xlsx')
      );

    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'diff.stage7.cms@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const intake = await agent
      .post('/api/uploads/intake')
      .attach('fileA', fixtureA, {
        filename: 'example6-ver1.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      .attach('fileB', fixtureB, {
        filename: 'example6-ver2.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      .expect(202);

    const started = await agent
      .post('/api/diff-jobs')
      .send({
        sessionId: intake.body.sessionId,
        leftRevisionId: intake.body.leftRevisionId,
        rightRevisionId: intake.body.rightRevisionId
      })
      .expect(201);

    await new Promise((resolveDone) => setTimeout(resolveDone, 1200));
    const rowsResponse = await agent.get(`/api/diff-jobs/${started.body.jobId}/rows?limit=5000`).expect(200);
    const rows = rowsResponse.body.rows as Array<{
      changeType: string;
      keyFields: { partNumber: string | null };
    }>;

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => !!row.keyFields.partNumber)).toBe(true);
    const replacedCount = rows.filter((row) => row.changeType === 'replaced').length;
    expect(replacedCount).toBeLessThanOrEqual(Math.ceil(rows.length * 0.05));
    },
    60000
  );

  it(
    'stage 7 SAP same-file comparison avoids mass false replaced classifications',
    async () => {
      const fixture = readFileSync(
        resolve(process.cwd(), '..', '..', 'docs', 'BOM Examples', 'Example 3 ver 1 SAP.xlsx')
      );

      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/api/auth/test/login')
        .send({ email: 'diff.stage7.sap.same@example.com', tenantId: 'tenant-a', provider: 'google' })
        .expect(201);

      const intake = await agent
        .post('/api/uploads/intake')
        .attach('fileA', fixture, {
          filename: 'example3-ver1-A.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })
        .attach('fileB', fixture, {
          filename: 'example3-ver1-B.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })
        .expect(202);

      const started = await agent
        .post('/api/diff-jobs')
        .send({
          sessionId: intake.body.sessionId,
          leftRevisionId: intake.body.leftRevisionId,
          rightRevisionId: intake.body.rightRevisionId
        })
        .expect(201);

      await new Promise((resolveDone) => setTimeout(resolveDone, 1500));
      const rowsResponse = await agent.get(`/api/diff-jobs/${started.body.jobId}/rows?limit=5000`).expect(200);
      const rows = rowsResponse.body.rows as Array<{
        changeType: string;
        rationale: { sourceProfile?: string | null; targetProfile?: string | null };
      }>;

      const replacedCount = rows.filter((row) => row.changeType === 'replaced').length;
      const noChangeCount = rows.filter((row) => row.changeType === 'no_change').length;
      expect(rows.length).toBeGreaterThan(0);
      expect(replacedCount).toBe(0);
      expect(noChangeCount).toBeGreaterThan(0);
      expect(rows.every((row) => row.rationale.sourceProfile === 'sap')).toBe(true);
      expect(rows.every((row) => row.rationale.targetProfile === 'sap')).toBe(true);
    },
    60000
  );

  it(
    'stage 7 fixture matrix: Example 1 pair produces bounded replacement rate with localized deltas',
    async () => {
      const fixtureA = readFileSync(
        resolve(process.cwd(), '..', '..', 'docs', 'BOM Examples', 'Example 1 ver 1.xlsx')
      );
      const fixtureB = readFileSync(
        resolve(process.cwd(), '..', '..', 'docs', 'BOM Examples', 'Example 1 ver 2.xlsx')
      );

      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/api/auth/test/login')
        .send({ email: 'diff.stage7.matrix.example1@example.com', tenantId: 'tenant-a', provider: 'google' })
        .expect(201);

      const intake = await agent
        .post('/api/uploads/intake')
        .attach('fileA', fixtureA, {
          filename: 'example1-ver1.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })
        .attach('fileB', fixtureB, {
          filename: 'example1-ver2.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })
        .expect(202);

      const started = await agent
        .post('/api/diff-jobs')
        .send({
          sessionId: intake.body.sessionId,
          leftRevisionId: intake.body.leftRevisionId,
          rightRevisionId: intake.body.rightRevisionId
        })
        .expect(201);

      await new Promise((resolveDone) => setTimeout(resolveDone, 1500));
      const rowsResponse = await agent.get(`/api/diff-jobs/${started.body.jobId}/rows?limit=5000`).expect(200);
      const rows = rowsResponse.body.rows as Array<{ changeType: string }>;

      expect(rows.length).toBeGreaterThan(0);
      const replacedCount = rows.filter((row) => row.changeType === 'replaced').length;
      const noChangeCount = rows.filter((row) => row.changeType === 'no_change').length;
      expect(replacedCount).toBeLessThanOrEqual(Math.ceil(rows.length * 0.2));
      expect(noChangeCount).toBeGreaterThan(0);
    },
    60000
  );

  it(
    'stage 7 fixture matrix: Example 2 same-vs-same converges to no-change-dominant output',
    async () => {
      const fixture = readFileSync(
        resolve(process.cwd(), '..', '..', 'docs', 'BOM Examples', 'Example 2 ver 1 CMS.xlsx')
      );

      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/api/auth/test/login')
        .send({ email: 'diff.stage7.matrix.example2@example.com', tenantId: 'tenant-a', provider: 'google' })
        .expect(201);

      const intake = await agent
        .post('/api/uploads/intake')
        .attach('fileA', fixture, {
          filename: 'example2-ver1-A.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })
        .attach('fileB', fixture, {
          filename: 'example2-ver1-B.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })
        .expect(202);

      const started = await agent
        .post('/api/diff-jobs')
        .send({
          sessionId: intake.body.sessionId,
          leftRevisionId: intake.body.leftRevisionId,
          rightRevisionId: intake.body.rightRevisionId
        })
        .expect(201);

      await new Promise((resolveDone) => setTimeout(resolveDone, 1500));
      const rowsResponse = await agent.get(`/api/diff-jobs/${started.body.jobId}/rows?limit=5000`).expect(200);
      const rows = rowsResponse.body.rows as Array<{ changeType: string }>;

      expect(rows.length).toBeGreaterThan(0);
      const noChangeCount = rows.filter((row) => row.changeType === 'no_change').length;
      const replacedCount = rows.filter((row) => row.changeType === 'replaced').length;
      expect(noChangeCount).toBeGreaterThanOrEqual(Math.floor(rows.length * 0.6));
      expect(replacedCount).toBeLessThanOrEqual(Math.ceil(rows.length * 0.05));
    },
    90000
  );

  it(
    'stage 7 moved rows include fromParent/toParent rationale at confidence >= 0.90',
    async () => {
      const previousProfile = process.env.MATCHER_PROFILE_ADAPTERS_V1;
      const previousComposite = process.env.MATCHER_COMPOSITE_KEY_V1;
      process.env.MATCHER_PROFILE_ADAPTERS_V1 = 'false';
      process.env.MATCHER_COMPOSITE_KEY_V1 = 'false';
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/api/auth/test/login')
        .send({ email: 'diff.stage7.moved@example.com', tenantId: 'tenant-a', provider: 'google' })
        .expect(201);

      try {
        const started = await agent
          .post('/api/diff-jobs')
          .send({
            sourceRows: [
              {
                rowId: 's-moved',
                internalId: 'INT-MOVED',
                partNumber: 'PN-MOVED',
                revision: 'A',
                description: 'Moved row',
                quantity: 1,
                parentPath: '/left',
                position: '10'
              }
            ],
            targetRows: [
              {
                rowId: 't-moved',
                internalId: 'INT-MOVED',
                partNumber: 'PN-MOVED',
                revision: 'A',
                description: 'Moved row',
                quantity: 1,
                parentPath: '/right',
                position: '10'
              }
            ]
          })
          .expect(201);
      await new Promise((resolveDone) => setTimeout(resolveDone, 1200));
      const rowsResponse = await agent.get(`/api/diff-jobs/${started.body.jobId}/rows?limit=500`).expect(200);
      const moved = (rowsResponse.body.rows as Array<{
        changeType: string;
        rationale: { fromParent?: string | null; toParent?: string | null };
      }>).find((row) => row.changeType === 'moved');

      expect(moved).toBeDefined();
      expect(moved?.rationale.fromParent).toBeTruthy();
      expect(moved?.rationale.toParent).toBeTruthy();
      } finally {
        if (previousProfile === undefined) delete process.env.MATCHER_PROFILE_ADAPTERS_V1;
        else process.env.MATCHER_PROFILE_ADAPTERS_V1 = previousProfile;
        if (previousComposite === undefined) delete process.env.MATCHER_COMPOSITE_KEY_V1;
        else process.env.MATCHER_COMPOSITE_KEY_V1 = previousComposite;
      }
    },
    20000
  );

  it(
    'stage 7 dynamic query contract filters, sorts, and validates fields',
    async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/test/login')
      .send({ email: 'diff.stage7.query@example.com', tenantId: 'tenant-a', provider: 'google' })
      .expect(201);

    const started = await agent.post('/api/diff-jobs').send({}).expect(201);
    await new Promise((resolveDone) => setTimeout(resolveDone, 1200));

    const filters = encodeURIComponent(JSON.stringify([{ field: 'changeType', op: 'eq', value: 'added' }]));
    const filtered = await agent
      .get(`/api/diff-jobs/${started.body.jobId}/rows?limit=100&sortBy=partNumber&sortDir=asc&filters=${filters}`)
      .expect(200);
    const filteredRows = filtered.body.rows as Array<{
      changeType: string;
      keyFields: { partNumber: string | null };
    }>;
    expect(filteredRows.length).toBeGreaterThan(0);
    expect(filteredRows.every((row) => row.changeType === 'added')).toBe(true);

    const orderedPartNumbers = filteredRows
      .map((row) => row.keyFields.partNumber || '')
      .slice();
    const sortedCopy = [...orderedPartNumbers].sort((a, b) => a.localeCompare(b));
    expect(orderedPartNumbers).toEqual(sortedCopy);

    await agent
      .get(`/api/diff-jobs/${started.body.jobId}/rows?limit=10&filters=${encodeURIComponent('not-json')}`)
      .expect(400);
    },
    30000
  );

  it(
    'stage 7 tree endpoint returns deterministic hierarchy and supports expanded node loading',
    async () => {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/api/auth/test/login')
        .send({ email: 'diff.stage7.tree@example.com', tenantId: 'tenant-a', provider: 'google' })
        .expect(201);

      const started = await agent
        .post('/api/diff-jobs')
        .send({
          sourceRows: [
            {
              rowId: 's-root',
              internalId: 'TREE-001',
              partNumber: 'TREE-ROOT',
              revision: 'A',
              description: 'Tree Root',
              quantity: 1,
              parentPath: '/root',
              position: '10',
              hierarchyLevel: 0
            },
            {
              rowId: 's-child-1',
              internalId: 'TREE-002',
              partNumber: 'TREE-CHILD-1',
              revision: 'A',
              description: 'Tree Child One',
              quantity: 1,
              parentPath: '/root/10',
              position: '20',
              hierarchyLevel: 1
            },
            {
              rowId: 's-child-2',
              internalId: 'TREE-003',
              partNumber: 'TREE-CHILD-2',
              revision: 'A',
              description: 'Tree Child Two',
              quantity: 1,
              parentPath: '/root/10',
              position: '30',
              hierarchyLevel: 1
            }
          ],
          targetRows: [
            {
              rowId: 't-root',
              internalId: 'TREE-001',
              partNumber: 'TREE-ROOT',
              revision: 'A',
              description: 'Tree Root',
              quantity: 1,
              parentPath: '/root',
              position: '10',
              hierarchyLevel: 0
            },
            {
              rowId: 't-child-1',
              internalId: 'TREE-002',
              partNumber: 'TREE-CHILD-1',
              revision: 'A',
              description: 'Tree Child One',
              quantity: 1,
              parentPath: '/root/10',
              position: '20',
              hierarchyLevel: 1
            },
            {
              rowId: 't-child-2',
              internalId: 'TREE-003',
              partNumber: 'TREE-CHILD-2',
              revision: 'A',
              description: 'Tree Child Two',
              quantity: 1,
              parentPath: '/root/10',
              position: '30',
              hierarchyLevel: 1
            }
          ]
        })
        .expect(201);

      await new Promise((resolveDone) => setTimeout(resolveDone, 1200));
      const collapsed = await agent
        .get(`/api/diff-jobs/${started.body.jobId}/tree?limit=50`)
        .expect(200);
      const collapsedNodes = collapsed.body.nodes as Array<{
        nodeId: string;
        depth: number;
        hasChildren: boolean;
      }>;
      expect(collapsedNodes.length).toBeGreaterThan(0);
      const expandable = collapsedNodes.find((node) => node.hasChildren);
      expect(expandable).toBeDefined();

      const expanded = await agent
        .get(
          `/api/diff-jobs/${started.body.jobId}/tree?limit=50&expandedNodeIds=${encodeURIComponent(
            expandable?.nodeId || ''
          )}`
        )
        .expect(200);
      const expandedNodes = expanded.body.nodes as Array<{ depth: number }>;
      expect(expandedNodes.length).toBeGreaterThanOrEqual(collapsedNodes.length);
      expect(expandedNodes.some((node) => node.depth > (expandable?.depth || 0))).toBe(true);
    },
    30000
  );

  it('stage 7 tree and dynamic query flags gate the respective endpoints', async () => {
    const previousTree = process.env.RESULTS_TREE_VIEW_V1;
    const previousDynamic = process.env.RESULTS_DYNAMIC_FILTERS_V1;
    process.env.RESULTS_TREE_VIEW_V1 = 'false';
    process.env.RESULTS_DYNAMIC_FILTERS_V1 = 'false';

    try {
      const agent = request.agent(app.getHttpServer());
      await agent
        .post('/api/auth/test/login')
        .send({ email: 'diff.stage7.flags@example.com', tenantId: 'tenant-a', provider: 'google' })
        .expect(201);

      const started = await agent.post('/api/diff-jobs').send({}).expect(201);
      await new Promise((resolveDone) => setTimeout(resolveDone, 1200));

      const dynamicQueryFilters = encodeURIComponent(
        JSON.stringify([{ field: 'changeType', op: 'eq', value: 'added' }])
      );
      const dynamicDisabled = await agent
        .get(`/api/diff-jobs/${started.body.jobId}/rows?filters=${dynamicQueryFilters}`)
        .expect(503);
      expect(dynamicDisabled.body.code).toBe('RESULTS_DYNAMIC_FILTERS_DISABLED');

      const treeDisabled = await agent
        .get(`/api/diff-jobs/${started.body.jobId}/tree?limit=50`)
        .expect(503);
      expect(treeDisabled.body.code).toBe('RESULTS_TREE_VIEW_DISABLED');
    } finally {
      if (previousTree === undefined) delete process.env.RESULTS_TREE_VIEW_V1;
      else process.env.RESULTS_TREE_VIEW_V1 = previousTree;
      if (previousDynamic === undefined) delete process.env.RESULTS_DYNAMIC_FILTERS_V1;
      else process.env.RESULTS_DYNAMIC_FILTERS_V1 = previousDynamic;
    }
  });
});
