'use client';

import type { ReactElement } from 'react';

function wrap(path: ReactElement) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {path}
    </svg>
  );
}

export function FlatViewIcon() {
  return wrap(<path d="M5 7h14M5 12h14M5 17h14M3 7h.01M3 12h.01M3 17h.01" />);
}

export function TreeViewIcon() {
  return wrap(<path d="M7 5h4v4H7zM13 15h4v4h-4zM7 15h4v4H7zM11 7h5v4M9 9v6M11 17h2" />);
}

export function ShareIcon() {
  return wrap(
    <path d="M15 8a3 3 0 1 0-2.8-4H12a3 3 0 0 0 .2 1L8 7.3A3 3 0 0 0 6 6.5a3 3 0 1 0 2 5.2l4.2 2.3a3 3 0 0 0-.2 1 3 3 0 1 0 .8-2L8.6 10.7A3 3 0 0 0 9 9c0-.6-.2-1.1-.4-1.6l4.3-2.3A3 3 0 0 0 15 8z" />
  );
}

export function ExportIcon() {
  return wrap(<path d="M12 4v9M8.5 10.5 12 14l3.5-3.5M5 18h14" />);
}

export function RunIcon() {
  return wrap(<path d="m9 7 8 5-8 5z" />);
}

export function CloseIcon() {
  return wrap(<path d="M7 7l10 10M17 7 7 17" />);
}

export function RefreshIcon() {
  return wrap(<path d="M4 4v5h5M20 20v-5h-5M19 9a7 7 0 0 0-12-3L4 9M5 15a7 7 0 0 0 12 3l3-3" />);
}

export function ConfirmIcon() {
  return wrap(<path d="M5 12.5 9.5 17 19 7.5" />);
}

export function SearchIcon() {
  return wrap(<path d="M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4" />);
}

export function EditIcon() {
  return wrap(<path d="m4 20 4.5-1 9-9-3.5-3.5-9 9L4 20zM13.5 6.5 17 10" />);
}

export function TagIcon() {
  return wrap(<path d="M4 12V5h7l8 8-6 6-8-8zM8.5 8.5h.01" />);
}

export function OpenIcon() {
  return wrap(<path d="M14 5h5v5M19 5l-8 8M5 9v10h10" />);
}

export function HistoryIcon() {
  return wrap(<path d="M12 7v5l3 2M5 4v4h4M6.5 17.5A7 7 0 1 0 5 8" />);
}

export function DeleteIcon() {
  return wrap(<path d="M5 7h14M9 7V5h6v2M9 11v6M15 11v6M7 7l1 12h8l1-12" />);
}

export function ChevronLeftIcon() {
  return wrap(<path d="m14.5 6.5-6 5.5 6 5.5" />);
}

export function ChevronRightIcon() {
  return wrap(<path d="m9.5 6.5 6 5.5-6 5.5" />);
}

export function ChevronUpIcon() {
  return wrap(<path d="m6.5 14.5 5.5-6 5.5 6" />);
}

export function ChevronDownIcon() {
  return wrap(<path d="m6.5 9.5 5.5 6 5.5-6" />);
}

export function PlusIcon() {
  return wrap(<path d="M12 5v14M5 12h14" />);
}

export function CheckCircleIcon() {
  return wrap(<path d="M9.5 12.5 11.5 14.5 15.5 10.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />);
}

export function UploadTrayIcon() {
  return wrap(<path d="M12 4v9M8.5 8 12 4.5 15.5 8M5 16.5v2h14v-2" />);
}
