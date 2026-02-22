export interface NotificationRecord {
  notificationId: string;
  tenantId: string;
  userEmail: string;
  type: 'comparison_completed' | 'comparison_failed';
  comparisonId: string | null;
  title: string;
  message: string;
  linkPath: string | null;
  isRead: boolean;
  createdAtUtc: string;
  emailDispatchedAtUtc: string | null;
  detailsJson: string | null;
}
