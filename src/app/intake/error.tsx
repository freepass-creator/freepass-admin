'use client';

import { RouteError } from '../_design/RouteState';

export default function Error({ error, reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError title="계약접수" error={error} reset={reset} />;
}
