/**
 * Tracks network status and automatically flushes the offline cull and
 * assessment queues when connectivity is restored.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  flushQueue, getPending,
  flushAssessmentQueue, getPendingAssessments,
} from "@/lib/offlineQueue";

const API_BASE = "/api";

function getToken(): string | null {
  try {
    const stored = localStorage.getItem("deercull_stalker");
    return stored ? (JSON.parse(stored) as { token?: string }).token ?? null : null;
  } catch { return null; }
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
               : { "Content-Type": "application/json" };
}

async function postCull(payload: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/culls`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return res.json();
}

async function postAssessment(payload: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/assessments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export function useOfflineSync() {
  const qc = useQueryClient();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    const [culls, assessments] = await Promise.all([getPending(), getPendingAssessments()]);
    setPendingCount(culls.length + assessments.length);
  }, []);

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    const [culls, assessments] = await Promise.all([getPending(), getPendingAssessments()]);
    if (culls.length === 0 && assessments.length === 0) return;

    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const [cullResult, assessResult] = await Promise.all([
        flushQueue(postCull as Parameters<typeof flushQueue>[0]),
        flushAssessmentQueue(postAssessment),
      ]);
      if (cullResult.succeeded > 0) {
        qc.invalidateQueries({ queryKey: ["/api/culls"] });
        qc.invalidateQueries({ queryKey: ["culls"] });
      }
      if (assessResult.succeeded > 0) {
        qc.invalidateQueries({ queryKey: ["/api/assessments"] });
        qc.invalidateQueries({ queryKey: ["assessments"] });
      }
      const totalFailed = cullResult.failed + assessResult.failed;
      if (totalFailed > 0) {
        const msg = assessResult.lastError ?? cullResult.lastError ?? "Unknown sync error";
        setSyncError(msg);
        // eslint-disable-next-line no-console
        console.error("[offline-sync] flush failed:", { cullResult, assessResult });
      } else {
        setSyncError(null);
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      refreshPendingCount();
    }
  }, [qc, refreshPendingCount]);

  useEffect(() => {
    const onOnline = () => { setIsOnline(true); sync(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [sync]);

  useEffect(() => {
    refreshPendingCount();
    if (navigator.onLine) sync();
  }, []);

  return { isOnline, pendingCount, isSyncing, syncError, sync, refreshPendingCount };
}
