import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { toast } from './toast';

export function useTable<T extends { id: number }>(tableName: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const queryKey = [tableName];

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => api.list<T>(tableName),
    enabled: options?.enabled !== false,
  });

  const onError = (err: Error) => {
    console.error(`[${tableName}] mutation failed:`, err);
    toast.error(`Save failed: ${err.message}`);
  };

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.create<T>(tableName, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => api.update<T>(tableName, id, data),
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
