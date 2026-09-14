import type { ReactNode } from 'react';

export function Field({ label, children, required = false }: { label: string; children: ReactNode; required?: boolean }) {
  return <label className="ui-field"><span>{label}{required && <em aria-hidden="true"> *</em>}</span>{children}</label>;
}
