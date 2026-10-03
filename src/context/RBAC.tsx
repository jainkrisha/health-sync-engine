import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { AUDIT_ROLES, REVIEW_ROLES, WRITE_ROLES, type Role } from '@shared/types';

/** Renders children only for the allowed roles; otherwise redirects (or renders a fallback). */
export function RoleGuard({
  allow,
  children,
  fallback,
}: {
  allow: Role[];
  children: ReactNode;
  fallback?: ReactNode | 'redirect';
}) {
  const { role } = useAuth();
  if (role && allow.includes(role)) return <>{children}</>;
  if (fallback === 'redirect') return <Navigate to="/dashboard" replace />;
  return <>{fallback ?? null}</>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePermissions() {
  const { role } = useAuth();
  const has = (roles: Role[]) => Boolean(role && roles.includes(role));
  return {
    canEditPatients: has(WRITE_ROLES),
    canReviewConflicts: has(REVIEW_ROLES),
    canViewAudit: has(AUDIT_ROLES),
    canViewHistory: has([...REVIEW_ROLES, ...AUDIT_ROLES]),
    isAdmin: role === 'admin',
  };
}
