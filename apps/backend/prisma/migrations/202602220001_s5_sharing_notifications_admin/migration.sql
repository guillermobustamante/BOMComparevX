IF OBJECT_ID(N'comparisonShares', N'U') IS NULL
BEGIN
  CREATE TABLE comparisonShares (
    shareId NVARCHAR(64) NOT NULL PRIMARY KEY,
    tenantId NVARCHAR(128) NOT NULL,
    comparisonId NVARCHAR(64) NOT NULL,
    ownerEmail NVARCHAR(320) NOT NULL,
    invitedEmail NVARCHAR(320) NOT NULL,
    permission NVARCHAR(32) NOT NULL,
    createdAtUtc DATETIME2 NOT NULL,
    updatedAtUtc DATETIME2 NOT NULL,
    revokedAtUtc DATETIME2 NULL,
    createdBy NVARCHAR(320) NULL,
    revokedBy NVARCHAR(320) NULL
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'uq_comparisonShares_tenant_comparison_invitedEmail' AND object_id = OBJECT_ID(N'comparisonShares')
)
BEGIN
  CREATE UNIQUE INDEX uq_comparisonShares_tenant_comparison_invitedEmail
    ON comparisonShares(tenantId, comparisonId, invitedEmail);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_comparisonShares_tenant_owner_comparison' AND object_id = OBJECT_ID(N'comparisonShares')
)
BEGIN
  CREATE INDEX ix_comparisonShares_tenant_owner_comparison
    ON comparisonShares(tenantId, ownerEmail, comparisonId);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_comparisonShares_tenant_invited_revokedAt' AND object_id = OBJECT_ID(N'comparisonShares')
)
BEGIN
  CREATE INDEX ix_comparisonShares_tenant_invited_revokedAt
    ON comparisonShares(tenantId, invitedEmail, revokedAtUtc);
END;

IF OBJECT_ID(N'notifications', N'U') IS NULL
BEGIN
  CREATE TABLE notifications (
    notificationId NVARCHAR(64) NOT NULL PRIMARY KEY,
    tenantId NVARCHAR(128) NOT NULL,
    userEmail NVARCHAR(320) NOT NULL,
    type NVARCHAR(64) NOT NULL,
    comparisonId NVARCHAR(64) NULL,
    title NVARCHAR(320) NOT NULL,
    message NVARCHAR(1024) NOT NULL,
    linkPath NVARCHAR(1024) NULL,
    isRead BIT NOT NULL,
    createdAtUtc DATETIME2 NOT NULL,
    emailDispatchedAtUtc DATETIME2 NULL,
    detailsJson NVARCHAR(MAX) NULL
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_notifications_tenant_user_createdAt' AND object_id = OBJECT_ID(N'notifications')
)
BEGIN
  CREATE INDEX ix_notifications_tenant_user_createdAt
    ON notifications(tenantId, userEmail, createdAtUtc);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_notifications_tenant_type_createdAt' AND object_id = OBJECT_ID(N'notifications')
)
BEGIN
  CREATE INDEX ix_notifications_tenant_type_createdAt
    ON notifications(tenantId, type, createdAtUtc);
END;

IF OBJECT_ID(N'adminRoleClaims', N'U') IS NULL
BEGIN
  CREATE TABLE adminRoleClaims (
    claimId NVARCHAR(64) NOT NULL PRIMARY KEY,
    tenantId NVARCHAR(128) NOT NULL,
    userEmail NVARCHAR(320) NOT NULL,
    role NVARCHAR(64) NOT NULL,
    isActive BIT NOT NULL,
    createdAtUtc DATETIME2 NOT NULL,
    updatedAtUtc DATETIME2 NOT NULL,
    createdBy NVARCHAR(320) NULL
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'uq_adminRoleClaims_tenant_user_role' AND object_id = OBJECT_ID(N'adminRoleClaims')
)
BEGIN
  CREATE UNIQUE INDEX uq_adminRoleClaims_tenant_user_role
    ON adminRoleClaims(tenantId, userEmail, role);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_adminRoleClaims_tenant_role_active' AND object_id = OBJECT_ID(N'adminRoleClaims')
)
BEGIN
  CREATE INDEX ix_adminRoleClaims_tenant_role_active
    ON adminRoleClaims(tenantId, role, isActive);
END;

IF OBJECT_ID(N'uploadPolicyOverrides', N'U') IS NULL
BEGIN
  CREATE TABLE uploadPolicyOverrides (
    overrideId NVARCHAR(64) NOT NULL PRIMARY KEY,
    tenantId NVARCHAR(128) NOT NULL,
    userKey NVARCHAR(320) NOT NULL,
    isUnlimited BIT NOT NULL,
    reason NVARCHAR(1024) NULL,
    createdBy NVARCHAR(320) NULL,
    createdAtUtc DATETIME2 NOT NULL,
    updatedAtUtc DATETIME2 NOT NULL
  );
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'uq_uploadPolicyOverrides_tenant_user' AND object_id = OBJECT_ID(N'uploadPolicyOverrides')
)
BEGIN
  CREATE UNIQUE INDEX uq_uploadPolicyOverrides_tenant_user
    ON uploadPolicyOverrides(tenantId, userKey);
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = N'ix_uploadPolicyOverrides_tenant_unlimited_updatedAt' AND object_id = OBJECT_ID(N'uploadPolicyOverrides')
)
BEGIN
  CREATE INDEX ix_uploadPolicyOverrides_tenant_unlimited_updatedAt
    ON uploadPolicyOverrides(tenantId, isUnlimited, updatedAtUtc);
END;
