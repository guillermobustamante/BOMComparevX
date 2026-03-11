'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark';

const navItems = [
  { href: '/upload', label: 'Compare BOMs', shortLabel: 'Compare', subtitle: 'Revision intake', icon: <CompareIcon /> },
  { href: '/mappings', label: 'Mapping Check', shortLabel: 'Mapping', subtitle: 'Governance and review', icon: <MappingIcon /> },
  { href: '/results', label: 'Results', shortLabel: 'Results', subtitle: 'Diff workspace', icon: <ResultsIcon /> },
  { href: '/history', label: 'History', shortLabel: 'History', subtitle: 'Session archive', icon: <HistoryIcon /> },
  { href: '/notifications', label: 'Notifications', shortLabel: 'Notices', subtitle: 'Event log', icon: <NotificationsIcon /> },
  { href: '/admin', label: 'Admin', shortLabel: 'Admin', subtitle: 'Policy controls', icon: <AdminIcon /> }
];

const titleMap: Record<string, { title: string; eyebrow: string }> = {
  '/upload': { title: 'Compare BOMs', eyebrow: 'Mission Control' },
  '/results': { title: 'Results', eyebrow: 'Mission Control' },
  '/history': { title: 'History', eyebrow: 'Mission Control' },
  '/notifications': { title: 'Notifications', eyebrow: 'Mission Control' },
  '/admin': { title: 'Admin', eyebrow: 'Mission Control' }
};

export function AppShell(props: {
  userEmail: string;
  tenantId: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [navExpanded, setNavExpanded] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('bomcomparevx-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('bomcomparevx-theme', theme);
  }, [theme]);

  useEffect(() => {
    setNavExpanded(false);
  }, [pathname]);

  const currentPage = pathname.startsWith('/mappings')
    ? { title: 'Mapping Check', eyebrow: 'Mission Control' }
    : titleMap[pathname] || { title: 'BOM Compare VX', eyebrow: 'Mission Control' };

  return (
    <div className="page shell missionShellRoot" data-theme={theme} data-nav={navExpanded ? 'expanded' : 'collapsed'}>
      {navExpanded ? <button type="button" className="missionShellBackdrop" aria-label="Close navigation" onClick={() => setNavExpanded(false)} /> : null}

      <aside className={`missionShellRail ${navExpanded ? 'missionShellRailExpanded' : ''}`}>
        <div className="missionShellRailTop">
          <button
            type="button"
            className="btn missionShellRailToggle"
            aria-label={navExpanded ? 'Collapse navigation' : 'Expand navigation'}
            onClick={() => setNavExpanded((value) => !value)}
          >
            <RailToggleIcon expanded={navExpanded} />
          </button>
          <div className="missionShellBrand">
            <span className="missionShellEyebrow">Mission Control</span>
            <strong>BOM Compare VX</strong>
          </div>
        </div>

        <nav className="missionShellNav" aria-label="Primary navigation">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href.startsWith('/mappings') && pathname.startsWith('/mappings'));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`missionShellNavItem ${isActive ? 'missionShellNavItemActive' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="missionShellNavIcon">{item.icon}</span>
                <span className="missionShellNavText">
                  <strong>{item.shortLabel}</strong>
                  <small>{item.subtitle}</small>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="missionShellRailMeta">
          <span className="chip">{props.userEmail}</span>
          <span className="chip">tenant: {props.tenantId}</span>
        </div>
      </aside>

      <main className="missionShellContent">
        <header className="missionShellHeader">
          <div>
            <p className="missionShellEyebrow">{currentPage.eyebrow}</p>
            <h1 className="missionShellTitle">{currentPage.title}</h1>
          </div>

          <div className="missionShellHeaderActions">
            <div className="missionShellThemeToggle" role="group" aria-label="Theme mode">
              <button
                type="button"
                className={`missionShellThemeButton ${theme === 'light' ? 'missionShellThemeButtonActive' : ''}`}
                aria-pressed={theme === 'light'}
                onClick={() => setTheme('light')}
              >
                <ThemeSunIcon />
                <span>Light</span>
              </button>
              <button
                type="button"
                className={`missionShellThemeButton ${theme === 'dark' ? 'missionShellThemeButtonActive' : ''}`}
                aria-pressed={theme === 'dark'}
                onClick={() => setTheme('dark')}
              >
                <ThemeMoonIcon />
                <span>Dark</span>
              </button>
            </div>
            {props.actions}
          </div>
        </header>

        <div className="missionShellBody">{props.children}</div>
      </main>
    </div>
  );
}

function RailToggleIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {expanded ? (
        <path d="M4 6.5h16v11H4zM9 6.5v11M14 12h-4M12 10l-2 2 2 2" />
      ) : (
        <path d="M4 6.5h16v11H4zM9 6.5v11M11 12h4M13 10l2 2-2 2" />
      )}
    </svg>
  );
}

function ThemeSunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1 7 17M17 7l2.1-2.1M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />
    </svg>
  );
}

function ThemeMoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.5 3.5A8 8 0 1 0 20.5 15 7 7 0 0 1 14.5 3.5z" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6.5h16M4 12h16M4 17.5h16M6 4v16" />
    </svg>
  );
}

function MappingIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14M5 12h8M5 17h10M17 11l2 2 4-4" />
    </svg>
  );
}

function ResultsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16v14H4zM9 5v14M4 10h16" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 7v5l3 2M5 4v4h4M6.5 17.5A7 7 0 1 0 5 8" />
    </svg>
  );
}

function NotificationsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4a4 4 0 0 1 4 4v3.5l1.5 3H6.5l1.5-3V8a4 4 0 0 1 4-4zM10 18a2 2 0 0 0 4 0" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4zM9.5 12l1.5 1.5 3.5-3.5" />
    </svg>
  );
}
