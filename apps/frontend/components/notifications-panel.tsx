'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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

  return (
    <section className="panel" data-testid="notifications-panel">
      <div className="screenToolbar">
        <div className="screenToolbarMeta">
          <span className="missionShellEyebrow">Event log</span>
          <p className="p">Track completion and failure notices, then jump directly to the linked comparison.</p>
        </div>
        <div className="screenToolbarActions">
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

      {!isLoading && !error && items.length === 0 && <p className="p">No notifications yet.</p>}
      {!isLoading && !error && items.length > 0 && (
        <div className="mappingTableWrap">
          <table className="mappingTable" data-testid="notifications-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Message</th>
                <th>Created</th>
                <th>Email</th>
                <th>Link</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.notificationId}>
                  <td>{item.type}</td>
                  <td>{item.message}</td>
                  <td>{new Date(item.createdAtUtc).toLocaleString()}</td>
                  <td>{item.emailDispatchedAtUtc ? 'sent' : 'disabled'}</td>
                  <td>
                    {item.linkPath ? (
                      <Link
                        href={item.linkPath}
                        className="screenIconAction screenIconActionCompact"
                        onClick={() => void markRead(item.notificationId)}
                        aria-label={`Open notification ${item.notificationId}`}
                        title="Open"
                        data-testid={`notification-link-${item.notificationId}`}
                      >
                        <OpenIcon />
                      </Link>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{item.isRead ? 'read' : 'unread'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
