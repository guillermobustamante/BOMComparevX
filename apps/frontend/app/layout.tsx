import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BOM Compare VX',
  description: 'Stage 1 responsive authenticated shell'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
