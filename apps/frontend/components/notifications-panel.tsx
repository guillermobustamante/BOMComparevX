'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ActiveWorkspaceNotice } from '@/components/active-workspace-notice';
import { OpenIcon, RefreshIcon } from '@/components/mission-icons';

interface NotificationItem {
  notificationId: string;
  type: 'comparison_completed' | 'comparison_failed';
  title: string;
  message: string;
  linkPath: string | null;
  isRead: boolean;
  createdAtUtc: string;
  comparisonId: string | null;
  emailDispatchedAtUtc: string | null;
}

const notificationDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short'
});

function formatNotificationDate(value: string) {
  return notificationDateFormatter.format(new Date(value));
}

function notificationTypeLabel(type: NotificationItem['type']) {
  return type === 'comparison_completed' ? 'Completed' : 'Failed';
}

export function NotificationsPanel() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadNotifications() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/notifications', {
        method: 'GET',
        cache: 'no-store'
      });
      const payload = (await response.json()) as
        | { notifications?: NotificationItem[] }
        | { code?: string; message?: string };
      if (!response.ok) {
        const err = payload as { code?: string; message?: string };
        setError(`${err.code || 'NOTIFICATIONS_LOAD_FAILED'}: ${err.message || 'Could not load notifications.'}`);
        setItems([]);
        return;
      }
      setItems((payload as { notifications?: NotificationItem[] }).notifications || []);
    } catch {
      setError('NOTIFICATIONS_LOAD_FAILED: Could not load notifications.');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function markRead(notificationId: string) {
    try {
      await fetch(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
        method: 'POST',
        cache: 'no-store'
      });
    } finally {
      setItems((current) =>
        current.map((item) => (item.notificationId === notificationId ? { ...item, isRead: true } : item))
      );
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  const unreadCount = items.filter((item) => !item.isRead).length;
  const completedCount = items.filter((item) => item.type === 'comparison_completed').length;
  const failedCount = items.filter((item) => item.type === 'comparison_failed').length;

  return (
    <section className="panel missionWorkspacePage missionWorkspacePageStream notificationsPage" data-testid="notifications-panel">
      <ActiveWorkspaceNotice
        eyebrow="Active Session"
        message="Alert links can take you elsewhere, but your current change review is still available."
        dataTestId="notifications-active-workspace"
      />
      <div className="screenToolbar missionWorkspaceHero">
        <div className="screenToolbarMeta missionWorkspaceHeroMeta">
          <span className="missionShellEyebrow">Comparison alerts</span>
          <p className="p">Track completed, failed, and shared comparison activity, then return directly to the linked review workspace.</p>
        </div>
        <div className="screenToolbarActions missionWorkspaceHeroActions">
          <span className="missionPill missionPillMeta">{items.length} alerts</span>
          <span className="missionPill missionPillMeta">{unreadCount} unread</span>
          <span className="missionPill notificationPillComplete">{completedCount} completed</span>
          <span className="missionPill notificationPillFailed">{failedCount} failed</span>
          <button
            className="screenIconAction"
            type="button"
            onClick={() => void loadNotifications()}
            aria-label="Refresh notifications"
            title="Refresh notifications"
            data-testid="notifications-refresh-btn"
          >
            <RefreshIcon />
          </button>
        </div>
      </div>

      {isLoading && <p className="p">Loading notifications...</p>}
      {error && (
        <div className="alertError" data-testid="notifications-error">
          {error}
        </div>
      )}

      {!isLoading && !error && items.length === 0 && <p className="p missionWorkspaceEmptyState">No notifications yet.</p>}
      {!isLoading && !error && items.length > 0 && (
        <div className="notificationsList" data-testid="notifications-table">
          {items.map((item) => (
            <article
              key={item.notificationId}
              className={`notificationCard ${item.isRead ? 'notificationCardRead' : 'notificationCardUnread'}`}
            >
              <div className="notificationCardTop">
                <div className="notificationCardTitleGroup">
                  <div className="notificationCardPills">
                    <span className={`missionPill ${item.type === 'comparison_failed' ? 'notificationPillFailed' : 'notificationPillComplete'}`}>
                      {notificationTypeLabel(item.type)}
                    </span>
                    <span className="missionPill">{item.isRead ? 'Read' : 'Unread'}</span>
                  </div>
                  <h2 className="h3">{item.title}</h2>
                </div>
                <div className="notificationCardTimestamp">{formatNotificationDate(item.createdAtUtc)}</div>
              </div>

              <p className="p notificationCardMessage">{item.message}</p>

              <div className="notificationCardMeta">
                <span>Email delivery: {item.emailDispatchedAtUtc ? 'Sent' : 'Disabled'}</span>
                {item.comparisonId ? <span>Comparison: {item.comparisonId}</span> : <span>No linked comparison</span>}
              </div>

              <div className="notificationCardActions">
                {item.linkPath ? (
                  <Link
                    href={item.linkPath}
                    className="btn"
                    onClick={() => void markRead(item.notificationId)}
                    aria-label={`Open notification ${item.notificationId}`}
                    title="Open review"
                    data-testid={`notification-link-${item.notificationId}`}
                  >
                    <OpenIcon />
                    Open review
                  </Link>
                ) : (
                  <button className="btn" type="button" disabled>
                    <OpenIcon />
                    No linked review
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
