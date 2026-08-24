import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CullRecord } from "@/constants/types";

const BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) return undefined as unknown as T;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

interface CullsFilter {
  stalkerId?: number | null;
  season?: number | null;
}

export function useCulls(filter?: CullsFilter) {
  const params = new URLSearchParams();
  if (filter?.stalkerId) params.set("stalkerId", String(filter.stalkerId));
  if (filter?.season) params.set("season", String(filter.season));
  const qs = params.toString() ? `?${params.toString()}` : "";

  return useQuery<CullRecord[]>({
    queryKey: ["culls", filter?.stalkerId ?? null, filter?.season ?? null],
    queryFn: () => apiFetch<CullRecord[]>(`/culls${qs}`),
  });
}

export function useCreateCull() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<CullRecord, "id" | "createdAt" | "updatedAt" | "stalkerName">) =>
      apiFetch<CullRecord>("/culls", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["culls"] }),
  });
}

export function useUpdateCull() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CullRecord> }) =>
      apiFetch<CullRecord>(`/culls/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["culls"] }),
  });
}

export function useDeleteCull() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/culls/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["culls"] }),
  });
}
