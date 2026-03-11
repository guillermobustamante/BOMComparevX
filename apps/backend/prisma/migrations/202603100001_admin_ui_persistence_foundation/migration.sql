IF OBJECT_ID(N'appSessions', N'U') IS NULL
BEGIN
  CREATE TABLE appSessions (
    sessionId NVARCHAR(191) NOT NULL PRIMARY KEY,
    tenantId NVARCHAR(191) NULL,
    userEmail NVARCHAR(320) NULL,
    dataJson NVARCHAR(MAX) NOT NULL,
    expiresAtUtc DATETIME2 NULL,
    createdAtUtc DATETIME2 NOT NULL,
    updatedAtUtc DATETIME2 NOT NULL
  );
END

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_appSessions_tenant_user_updatedAt' AND object_id = OBJECT_ID(N'appSessions')
)
BEGIN
  CREATE INDEX ix_appSessions_tenant_user_updatedAt
    ON appSessions(tenantId, userEmail, updatedAtUtc);
END

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_appSessions_expiresAtUtc' AND object_id = OBJECT_ID(N'appSessions')
)
BEGIN
  CREATE INDEX ix_appSessions_expiresAtUtc
    ON appSessions(expiresAtUtc);
END

IF OBJECT_ID(N'uploadedRevisions', N'U') IS NULL
BEGIN
  CREATE TABLE uploadedRevisions (
    revisionId NVARCHAR(191) NOT NULL PRIMARY KEY,
    tenantId NVARCHAR(191) NOT NULL,
    sessionId NVARCHAR(191) NOT NULL,
    jobId NVARCHAR(191) NOT NULL,
    slot NVARCHAR(32) NOT NULL,
    fileName NVARCHAR(512) NOT NULL,
    fileSize INT NOT NULL,
    createdAtUtc DATETIME2 NOT NULL,
    parserMode NVARCHAR(16) NOT NULL,
    sheetName NVARCHAR(255) NOT NULL,
    headersJson NVARCHAR(MAX) NOT NULL,
    headerFieldsJson NVARCHAR(MAX) NOT NULL,
    headerRowIndex INT NOT NULL,
    dataStartRowIndex INT NOT NULL,
    dataEndRowIndex INT NOT NULL,
    workbookBuffer VARBINARY(MAX) NULL,
    rowsJson NVARCHAR(MAX) NOT NULL
  );
END

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'uq_uploadedRevisions_tenant_job_slot' AND object_id = OBJECT_ID(N'uploadedRevisions')
)
BEGIN
  CREATE UNIQUE INDEX uq_uploadedRevisions_tenant_job_slot
    ON uploadedRevisions(tenantId, jobId, slot);
END

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_uploadedRevisions_tenant_session_createdAt' AND object_id = OBJECT_ID(N'uploadedRevisions')
)
BEGIN
  CREATE INDEX ix_uploadedRevisions_tenant_session_createdAt
    ON uploadedRevisions(tenantId, sessionId, createdAtUtc);
END

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_uploadedRevisions_tenant_revision_createdAt' AND object_id = OBJECT_ID(N'uploadedRevisions')
)
BEGIN
  CREATE INDEX ix_uploadedRevisions_tenant_revision_createdAt
    ON uploadedRevisions(tenantId, revisionId, createdAtUtc);
END

IF OBJECT_ID(N'uploadedRevisionPairs', N'U') IS NULL
BEGIN
  CREATE TABLE uploadedRevisionPairs (
    pairId NVARCHAR(191) NOT NULL PRIMARY KEY,
    tenantId NVARCHAR(191) NOT NULL,
    sessionId NVARCHAR(191) NOT NULL,
    jobId NVARCHAR(191) NOT NULL,
    leftRevisionId NVARCHAR(191) NOT NULL,
    rightRevisionId NVARCHAR(191) NOT NULL,
    createdAtUtc DATETIME2 NOT NULL
  );
END

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'uq_uploadedRevisionPairs_jobId' AND object_id = OBJECT_ID(N'uploadedRevisionPairs')
)
BEGIN
  CREATE UNIQUE INDEX uq_uploadedRevisionPairs_jobId
    ON uploadedRevisionPairs(jobId);
END

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_uploadedRevisionPairs_tenant_session_createdAt' AND object_id = OBJECT_ID(N'uploadedRevisionPairs')
)
BEGIN
  CREATE INDEX ix_uploadedRevisionPairs_tenant_session_createdAt
    ON uploadedRevisionPairs(tenantId, sessionId, createdAtUtc);
END

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_uploadedRevisionPairs_tenant_job' AND object_id = OBJECT_ID(N'uploadedRevisionPairs')
)
BEGIN
  CREATE INDEX ix_uploadedRevisionPairs_tenant_job
    ON uploadedRevisionPairs(tenantId, jobId);
END

IF OBJECT_ID(N'tenantAliasDecisions', N'U') IS NULL
BEGIN
  CREATE TABLE tenantAliasDecisions (
    decisionId NVARCHAR(191) NOT NULL PRIMARY KEY,
    tenantId NVARCHAR(191) NOT NULL,
    normalizedSourceColumn NVARCHAR(255) NOT NULL,
    canonicalField NVARCHAR(191) NOT NULL,
    isEnabled BIT NOT NULL,
    createdAtUtc DATETIME2 NOT NULL,
    updatedAtUtc DATETIME2 NOT NULL,
    updatedBy NVARCHAR(320) NULL
  );
END

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'uq_tenantAliasDecisions_tenant_header_field' AND object_id = OBJECT_ID(N'tenantAliasDecisions')
)
BEGIN
  CREATE UNIQUE INDEX uq_tenantAliasDecisions_tenant_header_field
    ON tenantAliasDecisions(tenantId, normalizedSourceColumn, canonicalField);
END

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_tenantAliasDecisions_tenant_updatedAt' AND object_id = OBJECT_ID(N'tenantAliasDecisions')
)
BEGIN
  CREATE INDEX ix_tenantAliasDecisions_tenant_updatedAt
    ON tenantAliasDecisions(tenantId, updatedAtUtc);
END
