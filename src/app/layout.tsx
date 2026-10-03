import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'FreePass Admin · Data Consumer',
  description: 'FreePass Data versioned read-model consumer',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
