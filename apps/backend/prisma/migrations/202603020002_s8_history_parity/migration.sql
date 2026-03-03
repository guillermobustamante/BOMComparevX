ALTER TABLE [dbo].[historyEntries]
ADD
  [sessionName] NVARCHAR(200) NULL,
  [tagLabel] NVARCHAR(100) NULL,
  [updatedAtUtc] DATETIME2 NOT NULL
    CONSTRAINT [DF_historyEntries_updatedAtUtc] DEFAULT SYSUTCDATETIME(),
  [deletedAtUtc] DATETIME2 NULL,
  [deletedBy] NVARCHAR(320) NULL;

EXEC(N'
  UPDATE [dbo].[historyEntries]
  SET [updatedAtUtc] = ISNULL([createdAtUtc], SYSUTCDATETIME())
  WHERE [updatedAtUtc] IS NULL;
');

CREATE INDEX [IX_historyEntries_tenantId_deletedAtUtc_createdAtUtc]
ON [dbo].[historyEntries]([tenantId], [deletedAtUtc], [createdAtUtc]);
