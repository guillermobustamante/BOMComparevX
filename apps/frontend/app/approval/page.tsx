import type { Metadata } from 'next';
import { UiApprovalShowcase } from '@/components/ui-approval-showcase';

export const metadata: Metadata = {
  title: 'Visual Approval | BOM Compare VX',
  description: 'High-fidelity approval screens for all major BOM Compare VX surfaces, including Compare, Mapping, Results, Exports, History, Notifications, and Admin.'
};

export default function ApprovalPage() {
  return <UiApprovalShowcase />;
}
