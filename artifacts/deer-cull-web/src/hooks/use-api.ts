import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { z } from "zod";
import {
  stalkerSchema,
  cullRecordSchema,
  stalkingSessionSchema,
  cullPlanSchema,
  type CullRecord,
  type Stalker,
  type PendingCullRecord,
  type StalkingSession,
  type CullPlan,
} from "@/lib/schemas";
import { enqueue, getPending } from "@/lib/offlineQueue";
import { useAuth } from "@/hooks/use-auth";

const API_BASE = "/api";
const STORAGE_KEY = "deercull_stalker";

function getToken(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return (JSON.parse(stored) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

let _onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) { _onUnauthorized = fn; }

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...options?.headers,
    },
  });
  if (res.status === 204) return undefined as unknown as T;
  if (res.status === 401) {
    _onUnauthorized?.();
    throw new Error("Session expired. Please sign in again.");
  }
  if (!res.ok) {
    let errorMsg = "API Error";
    try {
      const data = await res.json();
      errorMsg = data.error || errorMsg;
    } catch {
      errorMsg = res.statusText;
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

// --- Stalkers ---
export function useStalkers() {
  return useQuery({
    queryKey: ["/api/stalkers"],
    queryFn: async () => {
      const data = await fetchApi<unknown[]>("/stalkers");
      return z.array(stalkerSchema).parse(data);
    },
  });
}

export function useCreateStalker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; pin: string; isAdmin?: boolean }) => {
      return fetchApi<Stalker>("/stalkers", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/stalkers"] }),
  });
}

export function useUpdateStalker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<{ name: string; pin: string; isAdmin: boolean }> }) => {
      return fetchApi<Stalker>(`/stalkers/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/stalkers"] }),
  });
}

export function useDeleteStalker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      return fetchApi<void>(`/stalkers/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/stalkers"] }),
  });
}

export function useLoginStalker() {
  return useMutation({
    mutationFn: async (data: { name: string; pin: string }) => {
      const res = await fetchApi<unknown>("/stalkers/login", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return stalkerSchema.parse(res);
    },
  });
}

export function useBootstrapStalker() {
  return useMutation({
    mutationFn: async (data: { name: string; pin: string }) => {
      const res = await fetchApi<unknown>("/stalkers/bootstrap", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return stalkerSchema.parse(res);
    },
  });
}

// --- Culls ---
interface CullsFilter {
  stalkerId?: number | null;
  season?: number | null;
}

export function useCulls(filter?: CullsFilter) {
  const params = new URLSearchParams();
  if (filter?.stalkerId) params.set("stalkerId", String(filter.stalkerId));
  if (filter?.season) params.set("season", String(filter.season));
  const qs = params.toString() ? `?${params.toString()}` : "";

  return useQuery({
    queryKey: ["/api/culls", filter?.stalkerId, filter?.season],
    queryFn: async () => {
      const data = await fetchApi<unknown[]>(`/culls${qs}`);
      return z.array(cullRecordSchema).parse(data);
    },
  });
}

/**
 * Returns all locally-queued pending culls as PendingCullRecord objects
 * so they can be displayed in the map and records list while offline.
 */
export function usePendingCulls() {
  return useQuery({
    queryKey: ["/pending-culls"],
    queryFn: async (): Promise<PendingCullRecord[]> => {
      const items = await getPending();
      return items.map(item => ({
        id: item.displayId,
        stalkerId: item.payload.stalkerId ?? null,
        stalkerName: item.stalkerName ?? null,
        species: item.payload.species as CullRecord["species"],
        sex: item.payload.sex as CullRecord["sex"],
        weight: item.payload.weight ?? null,
        condition: item.payload.condition as CullRecord["condition"],
        pregnant: item.payload.pregnant ?? null,
        latitude: item.payload.latitude,
        longitude: item.payload.longitude,
        notes: item.payload.notes ?? null,
        culledAt: item.payload.culledAt,
        createdAt: item.queuedAt,
        updatedAt: item.queuedAt,
        _pending: true as const,
        _localId: item.localId,
      }));
    },
    // Poll every 5 s so the list stays in sync after a flush
    refetchInterval: 5000,
  });
}

/**
 * Offline-aware create hook.
 *
 * - If the device is online the record is posted to the API immediately.
 * - If the request fails due to a network error the record is saved to the
 *   local IndexedDB queue and will sync automatically when connectivity
 *   returns.  From the stalker's perspective the save always succeeds.
 */
export function useCreateCull() {
  const qc = useQueryClient();
  const { stalker } = useAuth();

  const mutationFn = useCallback(
    async (data: Omit<CullRecord, "id" | "createdAt" | "updatedAt" | "stalkerName">) => {
      // ── Try the API first ─────────────────────────────────────────
      try {
        const result = await fetchApi<CullRecord>("/culls", {
          method: "POST",
          body: JSON.stringify(data),
        });
        return result;
      } catch (err: any) {
        // Only fall back to the queue for network failures (TypeError) or
        // 5xx/504 responses. Validation errors (4xx) should still surface.
        const isNetworkError =
          err instanceof TypeError ||
          err?.message?.toLowerCase().includes("failed to fetch") ||
          err?.message?.toLowerCase().includes("network");

        if (!isNetworkError) throw err;
      }

      // ── Offline fallback — queue locally ──────────────────────────
      const item = await enqueue(data, stalker?.name ?? null);
      // Invalidate the pending query so the UI shows the new item immediately
      qc.invalidateQueries({ queryKey: ["/pending-culls"] });

      // Return a synthetic CullRecord so callers don't need special handling
      const synthetic: CullRecord = {
        id: item.displayId,
        stalkerId: data.stalkerId ?? null,
        stalkerName: stalker?.name ?? null,
        species: data.species,
        sex: data.sex,
        weight: data.weight ?? null,
        condition: data.condition,
        pregnant: data.pregnant ?? null,
        latitude: data.latitude,
        longitude: data.longitude,
        notes: data.notes ?? null,
        culledAt: data.culledAt,
        createdAt: item.queuedAt,
        updatedAt: item.queuedAt,
      };
      return synthetic;
    },
    [qc, stalker]
  );

  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      // Only invalidate the server cache if the record actually made it to the server
      if ((result as any)._pending !== true && result.id > 0) {
        qc.invalidateQueries({ queryKey: ["/api/culls"] });
      }
    },
  });
}

export function useUpdateCull() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CullRecord> }) => {
      return fetchApi<CullRecord>(`/culls/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/culls"] }),
  });
}

export function useDeleteCull() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      return fetchApi<void>(`/culls/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/culls"] }),
  });
}

// --- Cull Plans ---
export function useCullPlans(seasonStart?: number | null) {
  const qs = seasonStart ? `?seasonStart=${seasonStart}` : "";
  return useQuery({
    queryKey: ["/api/cull-plans", seasonStart],
    queryFn: async () => {
      const data = await fetchApi<unknown[]>(`/cull-plans${qs}`);
      return z.array(cullPlanSchema).parse(data);
    },
  });
}

export function useCreateCullPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<CullPlan, "id" | "createdAt" | "updatedAt">) => {
      return fetchApi<CullPlan>("/cull-plans", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/cull-plans"] }),
  });
}

export function useUpdateCullPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CullPlan> }) => {
      return fetchApi<CullPlan>(`/cull-plans/${id}`, { method: "PUT", body: JSON.stringify(data) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/cull-plans"] }),
  });
}

export function useDeleteCullPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => fetchApi<void>(`/cull-plans/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/cull-plans"] }),
  });
}

// --- Assessments (update only — list/create/delete handled inline in AssessmentsPage) ---
export function useUpdateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      return fetchApi<unknown>(`/assessments/${id}`, { method: "PUT", body: JSON.stringify(data) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/assessments"] }),
  });
}

// --- Stalking Sessions ---
interface SessionsFilter { stalkerId?: number | null; season?: number | null; }

export function useSessions(filter?: SessionsFilter) {
  const params = new URLSearchParams();
  if (filter?.stalkerId) params.set("stalkerId", String(filter.stalkerId));
  if (filter?.season)    params.set("season",    String(filter.season));
  const qs = params.toString() ? `?${params.toString()}` : "";
  return useQuery({
    queryKey: ["/api/sessions", filter?.stalkerId, filter?.season],
    queryFn: async () => {
      const data = await fetchApi<unknown[]>(`/sessions${qs}`);
      return z.array(stalkingSessionSchema).parse(data);
    },
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<StalkingSession> & { woodlandBlock: string; startedAt: string }) => {
      return fetchApi<StalkingSession>("/sessions", { method: "POST", body: JSON.stringify(data) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/sessions"] }),
  });
}

export function useUpdateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<StalkingSession> }) => {
      return fetchApi<StalkingSession>(`/sessions/${id}`, { method: "PUT", body: JSON.stringify(data) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/sessions"] }),
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      return fetchApi<void>(`/sessions/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/sessions"] }),
  });
}
