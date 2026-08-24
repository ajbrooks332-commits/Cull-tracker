import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Stalker } from "@/constants/types";

const BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
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

export function useStalkers() {
  return useQuery<Stalker[]>({
    queryKey: ["stalkers"],
    queryFn: () => apiFetch<Stalker[]>("/stalkers"),
  });
}

export function useStalkerLogin() {
  return async (name: string, pin: string): Promise<Stalker> => {
    return apiFetch<Stalker>("/stalkers/login", {
      method: "POST",
      body: JSON.stringify({ name, pin }),
    });
  };
}

export function useCreateStalker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; pin: string; isAdmin?: boolean }) =>
      apiFetch<Stalker>("/stalkers", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stalkers"] }),
  });
}

export function useUpdateStalker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { name?: string; pin?: string; isAdmin?: boolean };
    }) =>
      apiFetch<Stalker>(`/stalkers/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stalkers"] }),
  });
}

export function useDeleteStalker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/stalkers/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stalkers"] }),
  });
}
