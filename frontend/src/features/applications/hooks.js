import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../../api/applications";

const KEY = "applications";
const listKey = (params) => [KEY, "list", params];
const detailKey = (id) => [KEY, "detail", String(id)];

export const useApplications = (params) =>
  useQuery({
    queryKey: listKey(params),
    queryFn: () => api.listApplications(params),
    placeholderData: keepPreviousData,
  });

export const useApplication = (id) =>
  useQuery({
    queryKey: detailKey(id),
    queryFn: () => api.getApplication(id),
    retry: (count, error) => error.response?.status !== 404 && count < 1,
  });

export function useCreateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createApplication,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "list"] }),
  });
}

export function useUpdateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateApplication,
    onSuccess: (updated) => {
      qc.setQueryData(detailKey(updated.id), updated);
      qc.invalidateQueries({ queryKey: [KEY, "list"] });
    },
  });
}

export function useDeleteApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteApplication,
    onSuccess: (_, id) => {
      // pas d'invalidate : le refetch donnerait un 404
      qc.removeQueries({ queryKey: detailKey(id) });
      qc.invalidateQueries({ queryKey: [KEY, "list"] });
    },
  });
}

// mise à jour optimiste du statut
export function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => api.updateApplication({ id, status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: [KEY] });
      const previousLists = qc.getQueriesData({ queryKey: [KEY, "list"] });
      const previousDetail = qc.getQueryData(detailKey(id));

      qc.setQueriesData({ queryKey: [KEY, "list"] }, (old) =>
        old && { ...old, results: old.results.map((a) => (a.id === id ? { ...a, status } : a)) }
      );
      if (previousDetail) qc.setQueryData(detailKey(id), { ...previousDetail, status });

      return { previousLists, previousDetail, id };
    },
    onError: (_error, _vars, ctx) => {
      ctx?.previousLists.forEach(([key, data]) => qc.setQueryData(key, data));
      if (ctx?.previousDetail) qc.setQueryData(detailKey(ctx.id), ctx.previousDetail);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
