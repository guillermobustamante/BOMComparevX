export interface ExportArtifactRecord {
  artifactId: string;
  tenantId: string;
  comparisonId: string;
  requestedBy: string;
  format: 'csv' | 'excel';
  fileName: string;
  byteSize: number;
  createdAtUtc: string;
}
