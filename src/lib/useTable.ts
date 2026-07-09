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
    mutationFn: (data: Record<string, unknown>) => api.create<T>(tableName, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const cached = queryClient.getQueryData<T[]>(queryKey);
      const baseUpdatedAt = (cached?.find(r => r.id === id) as { updated_at?: string } | undefined)?.updated_at ?? null;
      return api.update<T>(tableName, id, { ...data, _base_updated_at: baseUpdatedAt });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
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
    create: createMutation.mutateAsync,
    update: (id: number, data: Record<string, unknown>) => updateMutation.mutateAsync({ id, data }),
    remove: deleteMutation.mutateAsync,
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
  };
}
