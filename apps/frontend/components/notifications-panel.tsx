'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

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
      <div className="resultsHeader">
        <h1 className="h1">Notifications</h1>
        <button className="btn" type="button" onClick={() => void loadNotifications()} data-testid="notifications-refresh-btn">
          Refresh
        </button>
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
                        className="linkInline"
                        onClick={() => void markRead(item.notificationId)}
                        data-testid={`notification-link-${item.notificationId}`}
                      >
                        Open
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
