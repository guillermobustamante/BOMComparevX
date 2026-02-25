IF OBJECT_ID(N'exportArtifacts', N'U') IS NULL
BEGIN
  CREATE TABLE exportArtifacts (
    artifactId NVARCHAR(64) NOT NULL PRIMARY KEY,
    tenantId NVARCHAR(128) NOT NULL,
    comparisonId NVARCHAR(64) NOT NULL,
    requestedBy NVARCHAR(320) NOT NULL,
    format NVARCHAR(16) NOT NULL,
    fileName NVARCHAR(512) NOT NULL,
    byteSize INT NOT NULL,
    createdAtUtc DATETIME2 NOT NULL
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_exportArtifacts_tenant_createdAt' AND object_id = OBJECT_ID(N'exportArtifacts')
)
BEGIN
  CREATE INDEX ix_exportArtifacts_tenant_createdAt
    ON exportArtifacts(tenantId, createdAtUtc);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_exportArtifacts_tenant_user_createdAt' AND object_id = OBJECT_ID(N'exportArtifacts')
)
BEGIN
  CREATE INDEX ix_exportArtifacts_tenant_user_createdAt
    ON exportArtifacts(tenantId, requestedBy, createdAtUtc);
END;
