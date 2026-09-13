import { AuthGate } from './auth-gate';

export default function Forbidden() {
  return <AuthGate code="ROLE_NOT_ALLOWED" surface="STAFF" />;
}
