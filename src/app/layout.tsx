import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'freepasserp.com · admin',
  description: 'FreePass internal admin ERP',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
