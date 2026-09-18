import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './sign.css';

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default function SignLayout({ children }: { children: ReactNode }) {
  return <main className="sg-root">{children}</main>;
}
