import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './api';
import { toast } from './toast';
import { markEditing } from './editingActivity';
import { useAuth } from './auth';

export function useTable<T extends { id: number }>(tableName: string, options?: { enabled?: boolean; pollMs?: number | false }) {
  const queryClient = useQueryClient();
  const { user, selectedHub } = useAuth();
  // Dual-access ('both') accounts can be actively viewing WC or YC — the server only
  // knows the account's fixed hub, not which view is open, so for tables shared across
  // hubs we tell it via ?viewHub= and key the cache on it to avoid cross-hub bleed.
  const viewHubTables = tableName === 'tasks' || tableName === 'hub-suggestions';
  const viewHub = viewHubTables && user?.hub === 'both' ? selectedHub : undefined;
  const queryKey = viewHub ? [tableName, viewHub] : [tableName];

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => api.list<T>(tableName, viewHub ? { viewHub } : undefined),
    enabled: options?.enabled !== false,
    // Omit refetchInterval entirely unless overridden, so the global default in App.tsx applies.
    ...(options?.pollMs !== undefined ? { refetchInterval: options.pollMs } : {}),
  });

  const onError = (err: Error) => {
    console.error(`[${tableName}] mutation failed:`, err);
    // Only checkConflict() marks its 409s this way — other 409s (unique/FK constraint
    // violations) carry their own specific message and must not be overwritten by the
    // generic "someone else changed this" copy.
    if (err instanceof ApiError && err.status === 409 && (err.data as { error?: string } | undefined)?.error === 'conflict') {
      queryClient.invalidateQueries({ queryKey });
      toast.error('Someone else just changed this — it has been reloaded. Please re-apply your change.');
      return;
    }
    toast.error(`Save failed: ${err.message}`);
  };

  const createMutation = useMutation({
    mutationFn: ({ data }: { data: Record<string, unknown>; silent?: boolean }) => { markEditing(); return api.create<T>(tableName, data); },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey });
      if (!variables.silent) toast.success('Saved');
    },
    onError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown>; silent?: boolean }) => {
      markEditing();
      const cached = queryClient.getQueryData<T[]>(queryKey);
      const baseUpdatedAt = (cached?.find(r => r.id === id) as { updated_at?: string } | undefined)?.updated_at ?? null;
      return api.update<T>(tableName, id, { ...data, _base_updated_at: baseUpdatedAt });
    },
    onSuccess: (result, variables) => {
      // Write the server's authoritative row straight into the cache instead of only
      // invalidating — invalidateQueries' refetch lands asynchronously, and a second
      // update for the same row fired before it lands would otherwise read the
      // pre-update cached row and send a stale _base_updated_at, tripping a false
      // "someone else changed this" conflict against the user's own prior save.
      queryClient.setQueryData<T[]>(queryKey, old => old?.map(r => (r.id === variables.id ? result : r)));
      queryClient.invalidateQueries({ queryKey });
      if (!variables.silent) toast.success('Saved');
    },
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => { markEditing(); return api.delete(tableName, id); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError,
  });

  return {
    rows,
    isLoading,
    create: (data: Record<string, unknown>, opts?: { silent?: boolean }) => createMutation.mutateAsync({ data, silent: opts?.silent }),
    update: (id: number, data: Record<string, unknown>, opts?: { silent?: boolean }) => updateMutation.mutateAsync({ id, data, silent: opts?.silent }),
    remove: deleteMutation.mutateAsync,
    refetch: () => queryClient.invalidateQueries({ queryKey }),
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
  };
}
