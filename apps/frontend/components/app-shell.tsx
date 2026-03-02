'use client';

import Link from 'next/link';

export function AppShell(props: {
  userEmail: string;
  tenantId: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page shell">
      <aside className="sidebar">
        <div className="brand">BOM Compare VX</div>
        <div className="nav">
          <Link href="/upload" className="navLink">
            Upload
          </Link>
          <Link href="/history" className="navLink">
            History
          </Link>
          <Link href="/results" className="navLink">
            Results
          </Link>
          <Link href="/mappings/rev-s3-preview" className="navLink">
            Mapping Preview
          </Link>
          <Link href="/notifications" className="navLink">
            Notifications
          </Link>
          <Link href="/admin" className="navLink">
            Admin
          </Link>
        </div>
        <div className="actions">
          <span className="chip">{props.userEmail}</span>
          <span className="chip">tenant: {props.tenantId}</span>
          {props.actions}
        </div>
      </aside>
      <main className="content">{props.children}</main>
    </div>
  );
}
