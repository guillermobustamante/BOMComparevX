'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function navClass(pathname: string, href: string): string {
  const base = 'navLink';
  if (pathname === href) return `${base} navLinkActive`;
  if (href === '/mappings' && pathname.startsWith('/mappings/')) return `${base} navLinkActive`;
  return base;
}

export function AppShell(props: {
  userEmail: string;
  tenantId: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="page shell">
      <aside className="sidebar">
        <div className="brand">BOM Compare VX</div>
        <div className="nav">
          <Link href="/upload" className={navClass(pathname, '/upload')}>
            Upload
          </Link>
          <Link href="/history" className={navClass(pathname, '/history')}>
            History
          </Link>
          <Link href="/results" className={navClass(pathname, '/results')}>
            Results
          </Link>
          <Link href="/mappings/rev-s3-preview" className={navClass(pathname, '/mappings')}>
            Mapping Preview
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
