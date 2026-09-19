import type { ReactNode } from 'react';
import { AdminChrome } from '../_design/AdminChrome';

export default function Layout({ children }: { children: ReactNode }) {
  return <AdminChrome>{children}</AdminChrome>;
}
