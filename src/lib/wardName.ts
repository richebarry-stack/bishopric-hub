import { useQuery } from '@tanstack/react-query';
import { api } from './api';

// Public (no auth required) — used on the login page as well as post-login,
// so it's a plain useQuery rather than anything gated behind a session.
export function useAppTitle(): string {
  const ward = useWardName();
  return ward ? `${ward} Leadership Hub` : 'Bishopric Hub';
}

/** The ward's name as people say it, e.g. "G2 Ward" ('' when not set). */
export function useWardName(): string {
  const { data } = useQuery({ queryKey: ['ward-name'], queryFn: () => api.wardName.get() });
  const wardName = data?.wardName?.trim();
  return wardName ? `${wardName} Ward` : '';
}
