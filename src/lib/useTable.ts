import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './api';
import { toast } from './toast';

export function useTable<T extends { id: number }>(tableName: string, options?: { enabled?: boolean; pollMs?: number | false }) {
  const queryClient = useQueryClient();
  const queryKey = [tableName];

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => api.list<T>(tableName),
    enabled: options?.enabled !== false,
    // Omit refetchInterval entirely unless overridden, so the global default in App.tsx applies.
    ...(options?.pollMs !== undefined ? { refetchInterval: options.pollMs } : {}),
  });

  const onError = (err: Error) => {
    console.error(`[${tableName}] mutation failed:`, err);
    if (err instanceof ApiError && err.status === 409) {
      queryClient.invalidateQueries({ queryKey });
      toast.error('Someone else just changed this — it has been reloaded. Please re-apply your change.');
      return;
    }
    toast.error(`Save failed: ${err.message}`);
  };

  const createMutation = useMutation({
    mutationFn: ({ data }: { data: Record<string, unknown>; silent?: boolean }) => api.create<T>(tableName, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey });
      if (!variables.silent) toast.success('Saved');
    },
    onError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown>; silent?: boolean }) => {
      const cached = queryClient.getQueryData<T[]>(queryKey);
      const baseUpdatedAt = (cached?.find(r => r.id === id) as { updated_at?: string } | undefined)?.updated_at ?? null;
      return api.update<T>(tableName, id, { ...data, _base_updated_at: baseUpdatedAt });
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey });
      if (!variables.silent) toast.success('Saved');
    },
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(tableName, id),
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
