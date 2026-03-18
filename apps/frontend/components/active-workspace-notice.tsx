'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ActiveWorkspaceState,
  buildResultsUrlFromWorkspace,
  readActiveWorkspace
} from '@/lib/active-workspace';

export function ActiveWorkspaceNotice(props: {
  eyebrow: string;
  message: string;
  dataTestId: string;
}) {
  const [workspace, setWorkspace] = useState<ActiveWorkspaceState | null>(null);

  useEffect(() => {
    setWorkspace(readActiveWorkspace());
  }, []);

  const nextUrl = workspace ? buildResultsUrlFromWorkspace(workspace) : null;
  if (!workspace || !nextUrl) return null;

  return (
    <section className="panel resultsActiveWorkspaceNotice" data-testid={props.dataTestId}>
      <div>
        <p className="missionShellEyebrow">{props.eyebrow}</p>
        <strong>{workspace.sessionName || 'Untitled session'}</strong>
        <p className="p">{props.message}</p>
        {workspace.comparisonLabel && <p className="missionSubtle">{workspace.comparisonLabel}</p>}
      </div>
      <Link className="btn btnPrimary" href={nextUrl}>
        Return to Results
      </Link>
    </section>
  );
}
