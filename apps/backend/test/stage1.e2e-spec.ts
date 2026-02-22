import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import * as session from 'express-session';
import * as passport from 'passport';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from '../src/app.module';
import { UploadHistoryService } from '../src/uploads/upload-history.service';
import { UploadJobService } from '../src/uploads/upload-job.service';
import {
  CONFIDENCE_BANDS,
  CONDITIONAL_CANONICAL_FIELDS,
  DETECTION_CONFLICT_POLICY,
  MAPPING_CONTRACT_VERSION,
  MAPPING_EDIT_POLICY,
  REQUIRED_CANONICAL_FIELDS,
  resolveReviewState
} from '../src/mapping/mapping-contract';
import { MappingDetectionService } from '../src/mapping/mapping-detection.service';
import { MappingAuditService } from '../src/mapping/mapping-audit.service';
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

describe('Stage 1 API baseline (e2e)', () => {
  let app: INestApplication;
  let uploadHistoryService: UploadHistoryService;
  let uploadJobService: UploadJobService;
  let semanticRegistryService: SemanticRegistryService;
  let mappingDetectionService: MappingDetectionService;
  let mappingPersistenceService: MappingPersistenceService;
  let mappingAuditService: MappingAuditService;
  let normalizationService: NormalizationService;
  let matcherService: MatcherService;
  let classificationService: ClassificationService;

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
    normalizationService = moduleFixture.get(NormalizationService);
    matcherService = moduleFixture.get(MatcherService);
    classificationService = moduleFixture.get(ClassificationService);
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

  it('POST /api/diff-jobs requires authentication', async () => {
    await request(app.getHttpServer()).post('/api/diff-jobs').send({}).expect(401);
  });

  it('GET /api/exports/csv/:comparisonId requires authentication', async () => {
    await request(app.getHttpServer()).get('/api/exports/csv/not-authenticated').expect(401);
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
});
