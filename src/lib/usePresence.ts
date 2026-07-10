import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { isEditing } from './editingActivity';

export interface PresenceUser {
  user_id: number;
  user_name: string;
  path: string;
  editing: number;
}

/** Heartbeats the current path once per 30s (matching the app's existing polling
 * budget) and returns everyone else's fresh presence in the same response. */
export function usePresence(path: string, enabled: boolean) {
  const { data } = useQuery({
    queryKey: ['presence', path],
    queryFn: () => api.presence.heartbeat(path, isEditing()),
    enabled,
    refetchInterval: 30_000,
    staleTime: 0,
  });
  return (data?.others ?? []) as PresenceUser[];
}
