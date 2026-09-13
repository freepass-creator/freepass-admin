import { AuthGate } from './auth-gate';

export default function Unauthorized() {
  return <AuthGate code="UNAUTHENTICATED" surface="STAFF" />;
}
