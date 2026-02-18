import { MappingPreviewEditor } from '@/components/mapping-preview-editor';

export default function MappingPreviewPage({
  params
}: {
  params: { revisionId: string };
}) {
  return <MappingPreviewEditor revisionId={params.revisionId} />;
}
