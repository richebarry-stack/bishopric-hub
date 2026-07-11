import { useQuery } from '@tanstack/react-query';
import { api } from './api';

// Public (no auth required) — used on the login page as well as post-login,
// so it's a plain useQuery rather than anything gated behind a session.
export function useAppTitle(): string {
  const { data } = useQuery({ queryKey: ['ward-name'], queryFn: () => api.wardName.get() });
  const wardName = data?.wardName?.trim();
  return wardName ? `${wardName} Ward Leadership Hub` : 'Bishopric Hub';
}
