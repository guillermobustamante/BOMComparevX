IF OBJECT_ID(N'partNode', N'U') IS NULL
BEGIN
  CREATE TABLE partNode (
    nodeId NVARCHAR(64) NOT NULL PRIMARY KEY,
    tenantId NVARCHAR(128) NOT NULL,
    revisionId NVARCHAR(64) NOT NULL,
    sourceRowId NVARCHAR(128) NOT NULL,
    partNumber NVARCHAR(256) NULL,
    revision NVARCHAR(128) NULL,
    description NVARCHAR(512) NULL,
    internalId NVARCHAR(256) NULL,
    hierarchyLevel INT NULL,
    assemblyPath NVARCHAR(1024) NULL,
    createdAtUtc DATETIME2 NOT NULL
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'uq_partNode_tenant_revision_sourceRow' AND object_id = OBJECT_ID(N'partNode')
)
BEGIN
  CREATE UNIQUE INDEX uq_partNode_tenant_revision_sourceRow
    ON partNode(tenantId, revisionId, sourceRowId);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_partNode_tenant_revision_partNumber' AND object_id = OBJECT_ID(N'partNode')
)
BEGIN
  CREATE INDEX ix_partNode_tenant_revision_partNumber
    ON partNode(tenantId, revisionId, partNumber);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_partNode_tenant_revision_createdAt' AND object_id = OBJECT_ID(N'partNode')
)
BEGIN
  CREATE INDEX ix_partNode_tenant_revision_createdAt
    ON partNode(tenantId, revisionId, createdAtUtc);
END;

IF OBJECT_ID(N'containsEdge', N'U') IS NULL
BEGIN
  CREATE TABLE containsEdge (
    edgeId NVARCHAR(64) NOT NULL PRIMARY KEY,
    tenantId NVARCHAR(128) NOT NULL,
    revisionId NVARCHAR(64) NOT NULL,
    parentNodeId NVARCHAR(64) NULL,
    childNodeId NVARCHAR(64) NOT NULL,
    sourceRowId NVARCHAR(128) NOT NULL,
    quantity FLOAT NULL,
    findNumber NVARCHAR(128) NULL,
    parentPath NVARCHAR(1024) NULL,
    depth INT NULL,
    createdAtUtc DATETIME2 NOT NULL
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'uq_containsEdge_tenant_revision_sourceRow' AND object_id = OBJECT_ID(N'containsEdge')
)
BEGIN
  CREATE UNIQUE INDEX uq_containsEdge_tenant_revision_sourceRow
    ON containsEdge(tenantId, revisionId, sourceRowId);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_containsEdge_tenant_revision_parent_depth' AND object_id = OBJECT_ID(N'containsEdge')
)
BEGIN
  CREATE INDEX ix_containsEdge_tenant_revision_parent_depth
    ON containsEdge(tenantId, revisionId, parentNodeId, depth);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_containsEdge_tenant_revision_createdAt' AND object_id = OBJECT_ID(N'containsEdge')
)
BEGIN
  CREATE INDEX ix_containsEdge_tenant_revision_createdAt
    ON containsEdge(tenantId, revisionId, createdAtUtc);
END;

IF OBJECT_ID(N'diffSnapshot', N'U') IS NULL
BEGIN
  CREATE TABLE diffSnapshot (
    snapshotId NVARCHAR(64) NOT NULL PRIMARY KEY,
    comparisonId NVARCHAR(64) NOT NULL,
    tenantId NVARCHAR(128) NOT NULL,
    requestedBy NVARCHAR(320) NOT NULL,
    sessionId NVARCHAR(64) NULL,
    leftRevisionId NVARCHAR(64) NULL,
    rightRevisionId NVARCHAR(64) NULL,
    contractVersion NVARCHAR(32) NOT NULL,
    countersJson NVARCHAR(MAX) NOT NULL,
    rowsJson NVARCHAR(MAX) NOT NULL,
    createdAtUtc DATETIME2 NOT NULL
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'uq_diffSnapshot_comparisonId' AND object_id = OBJECT_ID(N'diffSnapshot')
)
BEGIN
  CREATE UNIQUE INDEX uq_diffSnapshot_comparisonId
    ON diffSnapshot(comparisonId);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_diffSnapshot_tenant_comparison' AND object_id = OBJECT_ID(N'diffSnapshot')
)
BEGIN
  CREATE INDEX ix_diffSnapshot_tenant_comparison
    ON diffSnapshot(tenantId, comparisonId);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_diffSnapshot_tenant_createdAt' AND object_id = OBJECT_ID(N'diffSnapshot')
)
BEGIN
  CREATE INDEX ix_diffSnapshot_tenant_createdAt
    ON diffSnapshot(tenantId, createdAtUtc);
END;

IF OBJECT_ID(N'bom_components', N'V') IS NULL
  EXEC('CREATE VIEW bom_components AS SELECT 1 AS stub;');

EXEC('
CREATE OR ALTER VIEW bom_components
AS
SELECT
  nodeId,
  tenantId,
  revisionId,
  sourceRowId,
  partNumber,
  revision,
  description,
  internalId,
  hierarchyLevel,
  assemblyPath,
  createdAtUtc
FROM partNode
');

IF OBJECT_ID(N'component_links', N'V') IS NULL
  EXEC('CREATE VIEW component_links AS SELECT 1 AS stub;');

EXEC('
CREATE OR ALTER VIEW component_links
AS
SELECT
  edgeId,
  tenantId,
  revisionId,
  parentNodeId,
  childNodeId,
  sourceRowId,
  quantity,
  findNumber,
  parentPath,
  depth,
  createdAtUtc
FROM containsEdge
');
