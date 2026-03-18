'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type ThemeMode = 'light' | 'dark';
type PageTitleConfig = {
  title: string;
  eyebrow?: string;
};

const navItems = [
  { href: '/upload', label: 'Compare BOMs', shortLabel: 'Compare', subtitle: 'Revision intake', icon: <CompareIcon /> },
  { href: '/mappings', label: 'Mapping Check', shortLabel: 'Mapping', subtitle: 'Governance and review', icon: <MappingIcon /> },
  { href: '/results', label: 'Results', shortLabel: 'Results', subtitle: 'Diff workspace', icon: <ResultsIcon /> },
  { href: '/history', label: 'Revision Chains', shortLabel: 'Chains', subtitle: 'BOM session history', icon: <HistoryIcon /> },
  { href: '/notifications', label: 'Notifications', shortLabel: 'Notices', subtitle: 'Event log', icon: <NotificationsIcon /> },
  { href: '/admin', label: 'Admin', shortLabel: 'Admin', subtitle: 'Policy controls', icon: <AdminIcon /> }
];

const titleMap: Record<string, PageTitleConfig> = {
  '/upload': { title: 'Compare BOMs' },
  '/results': { title: 'Results' },
  '/history': { title: 'Revision Chains' },
  '/notifications': { title: 'Notifications' },
  '/admin': { title: 'Admin' }
};

export function AppShell(props: {
  userEmail: string;
  tenantId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [navExpanded, setNavExpanded] = useState(true);
  const [compactViewport, setCompactViewport] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('bomcomparevx-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
    }

    const isCompact = window.innerWidth <= 1100;
    setCompactViewport(isCompact);

    const savedNavState = window.localStorage.getItem('bomcomparevx-nav');
    if (savedNavState === 'expanded' || savedNavState === 'collapsed') {
      setNavExpanded(isCompact ? false : savedNavState === 'expanded');
      return;
    }

    setNavExpanded(!isCompact);
  }, []);

  useEffect(() => {
    const onResize = () => {
      const isCompact = window.innerWidth <= 1100;
      setCompactViewport(isCompact);
      setNavExpanded((current) => {
        if (isCompact) return false;
        return current;
      });
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('bomcomparevx-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem('bomcomparevx-nav', navExpanded ? 'expanded' : 'collapsed');
  }, [navExpanded]);

  useEffect(() => {
    if (window.innerWidth <= 1100) {
      setNavExpanded(false);
    }
    setAccountMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current) return;
      if (profileMenuRef.current.contains(event.target as Node)) return;
      setAccountMenuOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const isResultsPage = pathname === '/results';
  const isUploadPage = pathname === '/upload';
  const useUploadHeaderTreatment =
    pathname === '/upload' ||
    pathname === '/admin' ||
    pathname === '/history' ||
    pathname === '/notifications' ||
    pathname.startsWith('/mappings');
  const isWorkspacePage =
    pathname === '/history' ||
    pathname === '/notifications' ||
    pathname === '/admin' ||
    pathname.startsWith('/mappings');
  const currentPage = pathname.startsWith('/mappings')
    ? { title: 'Mapping Check' }
    : titleMap[pathname] || { title: 'BOM Compare VX' };

  return (
    <div
      className={`page shell missionShellRoot ${isUploadPage ? 'missionShellRootUpload' : ''} ${
        isResultsPage ? 'missionShellRootResults' : ''
      } ${isWorkspacePage ? 'missionShellRootWorkspace' : ''}`}
      data-page={
        pathname.startsWith('/mappings')
          ? 'mappings'
          : pathname === '/history'
            ? 'history'
            : pathname === '/notifications'
              ? 'notifications'
              : pathname === '/admin'
                ? 'admin'
                : pathname === '/results'
                  ? 'results'
                  : pathname === '/upload'
                    ? 'upload'
                    : 'shell'
      }
      data-theme={theme}
      data-nav={navExpanded ? 'expanded' : 'collapsed'}
      data-user-email={props.userEmail}
      data-tenant-id={props.tenantId}
    >
      {navExpanded && compactViewport ? (
        <button type="button" className="missionShellBackdrop" aria-label="Close navigation" onClick={() => setNavExpanded(false)} />
      ) : null}

      <aside className={`missionShellRail ${navExpanded ? 'missionShellRailExpanded' : ''}`}>
        <div className="missionShellRailTop">
          <button
            type="button"
            className="btn missionShellRailToggle"
            aria-label={navExpanded ? 'Collapse navigation' : 'Expand navigation'}
            title={navExpanded ? 'Collapse navigation' : 'Expand navigation'}
            data-testid="nav-toggle-btn"
            onClick={() => setNavExpanded((value) => !value)}
          >
            <RailToggleIcon expanded={navExpanded} />
          </button>
          <div className="missionShellBrand">
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
                aria-label={item.label}
                title={`${item.shortLabel}: ${item.subtitle}`}
                data-testid={`nav-link-${item.shortLabel.toLowerCase()}`}
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
          <div className="missionShellProfileMenu" ref={profileMenuRef}>
            <div className="missionShellProfile" data-testid="nav-profile">
              <button
                type="button"
                className="missionShellProfileAvatar"
                aria-label={`Signed in as ${props.userEmail}`}
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
                title={props.userEmail}
                data-testid="nav-profile-toggle"
                onClick={() => setAccountMenuOpen((value) => !value)}
              >
                <ProfileIcon />
              </button>
              <div className="missionShellProfileText">
                <span className="missionShellProfileEmail">{props.userEmail}</span>
                <span className="missionShellProfileTenant">tenant: {props.tenantId}</span>
              </div>
            </div>
            {accountMenuOpen ? (
              <div className="missionShellProfilePopover" role="menu" aria-label="Account menu" data-testid="nav-profile-menu">
                <Link
                  href="/login"
                  className="missionShellProfileMenuItem"
                  role="menuitem"
                  data-testid="nav-switch-account-link"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  Switch account
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <main
        className={`missionShellContent ${isResultsPage ? 'missionShellContentResults' : ''} ${
          isWorkspacePage ? 'missionShellContentWorkspace' : ''
        }`}
      >
        <header
          className={`missionShellHeader ${isResultsPage ? 'missionShellHeaderResults' : ''} ${
            useUploadHeaderTreatment ? 'missionShellHeaderUpload' : ''
          } ${isWorkspacePage ? 'missionShellHeaderWorkspace' : ''}`}
        >
          <div
            className={`missionShellTitleGroup ${isResultsPage ? 'missionShellTitleGroupResults' : ''} ${
              useUploadHeaderTreatment ? 'missionShellTitleGroupUpload' : ''
            } ${isWorkspacePage ? 'missionShellTitleGroupWorkspace' : ''}`}
          >
            {currentPage.eyebrow ? <p className="missionShellEyebrow">{currentPage.eyebrow}</p> : null}
            <h1 className="missionShellTitle">{currentPage.title}</h1>
          </div>

          <div className="missionShellHeaderActions">
            <label className="missionShellThemeSwitch" title="Toggle Theme" data-testid="theme-toggle-switch">
              <input
                type="checkbox"
                checked={theme === 'light'}
                aria-label="Toggle Theme"
                title="Toggle Theme"
                data-testid="theme-toggle-btn"
                onChange={() => setTheme((value) => (value === 'light' ? 'dark' : 'light'))}
              />
              <span className="missionShellThemeSwitchSlider" aria-hidden="true">
                <span className="missionShellThemeSwitchKnob" />
                <span className="missionShellThemeSwitchIcon missionShellThemeSwitchIconMoon">
                  <ThemeMoonIcon />
                </span>
                <span className="missionShellThemeSwitchIcon missionShellThemeSwitchIconSun">
                  <ThemeSunIcon />
                </span>
              </span>
            </label>
          </div>
        </header>

        <div
          className={`missionShellBody ${isResultsPage ? 'missionShellBodyResults' : ''} ${
            isWorkspacePage ? 'missionShellBodyWorkspace' : ''
          }`}
        >
          {props.children}
        </div>
      </main>
    </div>
  );
}

function RailToggleIcon(_: { expanded: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4.5h16a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V6A1.5 1.5 0 0 1 4 4.5z" />
      <path d="M9 4.5v15" />
    </svg>
  );
}

function ThemeSunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1.5v2.5M12 20v2.5M4.22 4.22l1.77 1.77M18.01 18.01l1.77 1.77M1.5 12H4M20 12h2.5M4.22 19.78l1.77-1.77M18.01 5.99l1.77-1.77" />
    </svg>
  );
}

function ThemeMoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.5h12M8 12h12M8 17.5h12" />
      <circle cx="4.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="17.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MappingIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 11.5 12 14.5 20.5 6" />
      <path d="M20.5 12v6a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5h9.5" />
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

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    </svg>
  );
}
