IF OBJECT_ID(N'jobRuns', N'U') IS NULL
BEGIN
  CREATE TABLE jobRuns (
    jobId NVARCHAR(64) NOT NULL PRIMARY KEY,
    sessionId NVARCHAR(64) NOT NULL,
    status NVARCHAR(32) NOT NULL,
    correlationId NVARCHAR(64) NOT NULL,
    tenantId NVARCHAR(128) NOT NULL,
    requestedBy NVARCHAR(320) NOT NULL,
    createdAtUtc DATETIME2 NOT NULL,
    idempotencyKey NVARCHAR(256) NULL,
    fileAName NVARCHAR(512) NOT NULL,
    fileASize INT NOT NULL,
    fileBName NVARCHAR(512) NOT NULL,
    fileBSize INT NOT NULL,
    policyComparisonsUsed INT NOT NULL,
    policyUnrestrictedComparisonsRemaining INT NOT NULL,
    policyCooldownUntilUtc DATETIME2 NULL
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'uq_jobRuns_requestedBy_idempotencyKey' AND object_id = OBJECT_ID(N'jobRuns')
)
BEGIN
  CREATE UNIQUE INDEX uq_jobRuns_requestedBy_idempotencyKey
    ON jobRuns(requestedBy, idempotencyKey)
    WHERE idempotencyKey IS NOT NULL;
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_jobRuns_tenant_user_createdAt' AND object_id = OBJECT_ID(N'jobRuns')
)
BEGIN
  CREATE INDEX ix_jobRuns_tenant_user_createdAt
    ON jobRuns(tenantId, requestedBy, createdAtUtc);
END;

IF OBJECT_ID(N'historyEntries', N'U') IS NULL
BEGIN
  CREATE TABLE historyEntries (
    historyId NVARCHAR(64) NOT NULL PRIMARY KEY,
    jobId NVARCHAR(64) NOT NULL UNIQUE,
    sessionId NVARCHAR(64) NOT NULL,
    createdAtUtc DATETIME2 NOT NULL,
    status NVARCHAR(32) NOT NULL,
    initiatorEmail NVARCHAR(320) NOT NULL,
    tenantId NVARCHAR(128) NOT NULL
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_historyEntries_tenant_user_createdAt' AND object_id = OBJECT_ID(N'historyEntries')
)
BEGIN
  CREATE INDEX ix_historyEntries_tenant_user_createdAt
    ON historyEntries(tenantId, initiatorEmail, createdAtUtc);
END;

IF OBJECT_ID(N'uploadPolicies', N'U') IS NULL
BEGIN
  CREATE TABLE uploadPolicies (
    id NVARCHAR(64) NOT NULL PRIMARY KEY,
    tenantId NVARCHAR(128) NOT NULL,
    userKey NVARCHAR(320) NOT NULL,
    comparisonsUsed INT NOT NULL,
    cooldownUntilUtc DATETIME2 NULL,
    updatedAtUtc DATETIME2 NOT NULL
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'uq_uploadPolicies_tenant_user' AND object_id = OBJECT_ID(N'uploadPolicies')
)
BEGIN
  CREATE UNIQUE INDEX uq_uploadPolicies_tenant_user
    ON uploadPolicies(tenantId, userKey);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_uploadPolicies_tenant_user_updatedAt' AND object_id = OBJECT_ID(N'uploadPolicies')
)
BEGIN
  CREATE INDEX ix_uploadPolicies_tenant_user_updatedAt
    ON uploadPolicies(tenantId, userKey, updatedAtUtc);
END;

IF OBJECT_ID(N'uploadEvents', N'U') IS NULL
BEGIN
  CREATE TABLE uploadEvents (
    eventId NVARCHAR(64) NOT NULL PRIMARY KEY,
    tenantId NVARCHAR(128) NOT NULL,
    userKey NVARCHAR(320) NOT NULL,
    eventType NVARCHAR(64) NOT NULL,
    correlationId NVARCHAR(64) NOT NULL,
    detailsJson NVARCHAR(MAX) NULL,
    createdAtUtc DATETIME2 NOT NULL
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_uploadEvents_tenant_user_createdAt' AND object_id = OBJECT_ID(N'uploadEvents')
)
BEGIN
  CREATE INDEX ix_uploadEvents_tenant_user_createdAt
    ON uploadEvents(tenantId, userKey, createdAtUtc);
END;

IF OBJECT_ID(N'auditLogs', N'U') IS NULL
BEGIN
  CREATE TABLE auditLogs (
    id NVARCHAR(64) NOT NULL PRIMARY KEY,
    timestampUtc DATETIME2 NOT NULL,
    userId NVARCHAR(320) NULL,
    tenantId NVARCHAR(128) NULL,
    actionType NVARCHAR(128) NOT NULL,
    resourceType NVARCHAR(128) NULL,
    resourceId NVARCHAR(128) NULL,
    detailsJson NVARCHAR(MAX) NULL,
    outcome NVARCHAR(64) NULL,
    ipAddress NVARCHAR(64) NULL,
    correlationId NVARCHAR(64) NULL
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_auditLogs_tenant_timestamp' AND object_id = OBJECT_ID(N'auditLogs')
)
BEGIN
  CREATE INDEX ix_auditLogs_tenant_timestamp
    ON auditLogs(tenantId, timestampUtc);
END;

IF OBJECT_ID(N'bomColumnMappings', N'U') IS NULL
BEGIN
  CREATE TABLE bomColumnMappings (
    mappingId NVARCHAR(64) NOT NULL PRIMARY KEY,
    tenantId NVARCHAR(128) NOT NULL,
    bomRevisionId NVARCHAR(64) NOT NULL,
    originalColumnsJson NVARCHAR(MAX) NOT NULL,
    canonicalMappingJson NVARCHAR(MAX) NOT NULL,
    customColumnIndicesJson NVARCHAR(MAX) NULL,
    detectionConfidence FLOAT NULL,
    languageMetadataJson NVARCHAR(MAX) NULL,
    createdAtUtc DATETIME2 NOT NULL,
    createdBy NVARCHAR(320) NULL
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_bomColumnMappings_tenant_revision_createdAt' AND object_id = OBJECT_ID(N'bomColumnMappings')
)
BEGIN
  CREATE INDEX ix_bomColumnMappings_tenant_revision_createdAt
    ON bomColumnMappings(tenantId, bomRevisionId, createdAtUtc);
END;

IF OBJECT_ID(N'columnDetectionAudits', N'U') IS NULL
BEGIN
  CREATE TABLE columnDetectionAudits (
    auditId NVARCHAR(64) NOT NULL PRIMARY KEY,
    tenantId NVARCHAR(128) NOT NULL,
    bomRevisionId NVARCHAR(64) NOT NULL,
    sourceColumn NVARCHAR(320) NULL,
    canonicalField NVARCHAR(128) NULL,
    strategy NVARCHAR(64) NOT NULL,
    confidence FLOAT NULL,
    reviewState NVARCHAR(64) NULL,
    actor NVARCHAR(320) NULL,
    changedFrom NVARCHAR(320) NULL,
    changedTo NVARCHAR(320) NULL,
    timestampUtc DATETIME2 NOT NULL,
    correlationId NVARCHAR(64) NULL
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_columnDetectionAudits_tenant_revision_timestamp' AND object_id = OBJECT_ID(N'columnDetectionAudits')
)
BEGIN
  CREATE INDEX ix_columnDetectionAudits_tenant_revision_timestamp
    ON columnDetectionAudits(tenantId, bomRevisionId, timestampUtc);
END;
