import type { ReactNode } from 'react';
import './sign.css';

export default function SignLayout({ children }: { children: ReactNode }) {
  return <main className="sg-root">{children}</main>;
}
