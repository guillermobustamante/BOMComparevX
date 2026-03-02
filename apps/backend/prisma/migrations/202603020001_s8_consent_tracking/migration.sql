CREATE TABLE [dbo].[consentAcceptances] (
  [consentId] NVARCHAR(1000) NOT NULL,
  [tenantId] NVARCHAR(1000) NOT NULL,
  [userEmail] NVARCHAR(1000) NOT NULL,
  [termsVersion] NVARCHAR(1000) NOT NULL,
  [privacyVersion] NVARCHAR(1000) NOT NULL,
  [acceptedAtUtc] DATETIME2 NOT NULL,
  CONSTRAINT [pk_consentAcceptances] PRIMARY KEY CLUSTERED ([consentId])
);

CREATE UNIQUE INDEX [uq_consentAcceptances_tenant_user_versions]
ON [dbo].[consentAcceptances]([tenantId], [userEmail], [termsVersion], [privacyVersion]);

CREATE INDEX [ix_consentAcceptances_tenant_user_acceptedAt]
ON [dbo].[consentAcceptances]([tenantId], [userEmail], [acceptedAtUtc]);

CREATE INDEX [ix_consentAcceptances_tenant_acceptedAt]
ON [dbo].[consentAcceptances]([tenantId], [acceptedAtUtc]);

