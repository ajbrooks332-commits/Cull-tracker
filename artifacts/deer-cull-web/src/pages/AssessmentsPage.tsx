import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Plus, ChevronLeft, ChevronRight, MapPin, Camera, Trash2, FileDown,
  Navigation2, Square, Play, Check, X, TrendingUp, TrendingDown, Minus,
  Loader2, ClipboardList, AlertCircle, ChevronDown, Timer, ImagePlus, RefreshCw,
  Pencil, Filter, BarChart3,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { WOODLAND_BLOCKS, WEATHER_CONDITIONS, getAvailableSeasons, getCurrentSeasonYear, formatSeasonLabel } from "@/lib/constants";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { enqueueAssessment } from "@/lib/offlineQueue";
import { saveDraft, loadDraft, clearDraft, hasDraft } from "@/lib/draftStore";

const API_BASE = "/api";
const STORAGE_KEY = "deercull_stalker";
const DRAFT_KEY = "assessment_draft_v1";

function getToken(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return (JSON.parse(stored) as { token?: string }).token ?? null;
  } catch { return null; }
}

class AuthExpiredError extends Error {
  constructor(msg: string) { super(msg); this.name = "AuthExpiredError"; }
}

class NetworkError extends Error {
  constructor(msg: string) { super(msg); this.name = "NetworkError"; }
}

async function apiFetch<T>(path: string, options?: RequestInit, timeoutMs?: number): Promise<T> {
  const token = getToken();
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
    if (timer) clearTimeout(timer);
    if (res.status === 204) return undefined as unknown as T;
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = (data as { error?: string }).error ?? "API Error";
      if (res.status === 401) throw new AuthExpiredError(msg);
      throw new Error(msg);
    }
    return res.json();
  } catch (err) {
    if (timer) clearTimeout(timer);
    if (err instanceof AuthExpiredError) throw err;
    if ((err as Error).name === "AbortError" || err instanceof TypeError) {
      throw new NetworkError("No network connection");
    }
    throw err;
  }
}

type ScoreNLMH = "N" | "L" | "M" | "H";
type RackScore = "rarely" | "lightly" | "frequently" | "heavily";
type TrendDir = "up" | "level" | "down";
type GrazingEntry = { species: string; impact: ScoreNLMH };
type GpsPoint = { lat: number; lng: number; ts: number };

interface TallyCounts {
  deerSeen: number;
  dung: number;
  couches: number;
  scrapes: number;
  wallows: number;
  barkRemoval: number;
  fraying: number;
  barkStripping: number;
  brokenStems: number;
  browsingCoppice: number;
  browsingBasal: number;
}

type RackTallies = { rarely: number; lightly: number; frequently: number; heavily: number };
type SaplingTallies = { none_little: number; lt50_some50cm: number; gt50_few50cm: number; gt75_few30cm: number };

const BLANK_TALLIES: TallyCounts = {
  deerSeen: 0, dung: 0, couches: 0, scrapes: 0, wallows: 0,
  barkRemoval: 0, fraying: 0, barkStripping: 0, brokenStems: 0,
  browsingCoppice: 0, browsingBasal: 0,
};
const BLANK_RACK_TALLIES: RackTallies = { rarely: 0, lightly: 0, frequently: 0, heavily: 0 };
const BLANK_SAPLING_TALLIES: SaplingTallies = { none_little: 0, lt50_some50cm: 0, gt50_few50cm: 0, gt75_few30cm: 0 };

const TALLY_THRESHOLDS: Record<keyof TallyCounts, { mMin: number; hMin: number }> = {
  deerSeen:        { mMin: 3,  hMin: 6  },
  dung:            { mMin: 5,  hMin: 10 },
  couches:         { mMin: 2,  hMin: 4  },
  scrapes:         { mMin: 2,  hMin: 4  },
  wallows:         { mMin: 2,  hMin: 3  },
  barkRemoval:     { mMin: 3,  hMin: 6  },
  fraying:         { mMin: 3,  hMin: 6  },
  barkStripping:   { mMin: 3,  hMin: 6  },
  brokenStems:     { mMin: 3,  hMin: 6  },
  browsingCoppice: { mMin: 5,  hMin: 15 },
  browsingBasal:   { mMin: 3,  hMin: 8  },
};

function highestRackScore(t: RackTallies): RackScore | "" {
  if (t.heavily > 0)    return "heavily";
  if (t.frequently > 0) return "frequently";
  if (t.lightly > 0)    return "lightly";
  if (t.rarely > 0)     return "rarely";
  return "";
}

function highestSaplingsScore(t: SaplingTallies): string {
  if (t.gt75_few30cm > 0)  return "gt75_few30cm";
  if (t.gt50_few50cm > 0)  return "gt50_few50cm";
  if (t.lt50_some50cm > 0) return "lt50_some50cm";
  if (t.none_little > 0)   return "none_little";
  return "";
}

function countToNLMH(count: number, mMin: number, hMin: number): ScoreNLMH {
  if (count === 0) return "N";
  if (count < mMin) return "L";
  if (count < hMin) return "M";
  return "H";
}

function ratePerKm(count: number, distanceMetres: number): number {
  const km = distanceMetres > 50 ? distanceMetres / 1000 : 1;
  return count / km;
}

function scorePerKm(count: number, distanceMetres: number, mMin: number, hMin: number): ScoreNLMH {
  if (count === 0) return "N";
  const rate = ratePerKm(count, distanceMetres);
  if (rate < mMin) return "L";
  if (rate < hMin) return "M";
  return "H";
}

function fmtRate(count: number, distanceMetres: number): string {
  if (distanceMetres < 50) return "";
  return `${ratePerKm(count, distanceMetres).toFixed(1)}/km`;
}

interface AssessmentForm {
  date: string;
  woodlandBlock: string;
  weather: string;
  recorder: string;
  sbiNumber: string;
  standType: string;
  canopyCover: string;
  mainSpeciesInStand: string;
  groundVegetation: string;
  vegWithoutDeer: string;
  deerPresent: string;
  speciesAssessed: string;
  speciesCausingImpact: string;
  gpsRoute: GpsPoint[];
  distanceWalked: number;
  tallyCounts: TallyCounts;
  racksInWoodTallies: RackTallies;
  racksEdgeTallies: RackTallies;
  saplingsGroupTallies: SaplingTallies;
  deerSeenScore: ScoreNLMH | "";
  dungTally: string;
  couchesScore: ScoreNLMH | "";
  scrapesScore: ScoreNLMH | "";
  wallowsScore: ScoreNLMH | "";
  racksInWoodScore: RackScore | "";
  racksEdgeScore: RackScore | "";
  barkRemovalScore: ScoreNLMH | "";
  frayingScore: ScoreNLMH | "";
  barkStrippingScore: ScoreNLMH | "";
  brokenStemsScore: ScoreNLMH | "";
  browselineScore: string;
  browsingCoppiceScore: string;
  browsingBasalScore: string;
  browsingSaplingsScore: string;
  browsingBrambleScore: string;
  grazingFlora: GrazingEntry[];
  activitySummary: ScoreNLMH | "";
  impactSummary: ScoreNLMH | "";
  activityTrend: TrendDir | "";
  impactTrend: TrendDir | "";
  trendNotes: string;
  comments: string;
  photos: { dataUrl: string; caption: string; lat?: number; lng?: number; takenAt?: number }[];
}

interface Assessment extends AssessmentForm {
  id: number;
  stalkerId?: number | null;
  stalkerName?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  durationMinutes?: number | null;
  createdAt: string;
  updatedAt: string;
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function assessmentToForm(a: Assessment): AssessmentForm {
  // Normalise nullable database fields back to the form-shaped strings used by the wizard.
  const dateOnly = (a.date ?? new Date().toISOString()).slice(0, 10);
  return {
    date: dateOnly,
    woodlandBlock: a.woodlandBlock ?? "",
    weather: a.weather ?? "",
    recorder: a.recorder ?? "",
    sbiNumber: a.sbiNumber ?? "",
    standType: a.standType ?? "",
    canopyCover: a.canopyCover ?? "",
    mainSpeciesInStand: a.mainSpeciesInStand ?? "",
    groundVegetation: a.groundVegetation ?? "",
    vegWithoutDeer: a.vegWithoutDeer ?? "",
    deerPresent: a.deerPresent ?? "",
    speciesAssessed: a.speciesAssessed ?? "",
    speciesCausingImpact: a.speciesCausingImpact ?? "",
    gpsRoute: (a.gpsRoute as GpsPoint[] | null) ?? [],
    distanceWalked: a.distanceWalked ?? 0,
    tallyCounts: (a.tallyCounts as TallyCounts | null) ?? { ...BLANK_TALLIES },
    racksInWoodTallies: (a.racksInWoodTallies as RackTallies | null) ?? { ...BLANK_RACK_TALLIES },
    racksEdgeTallies: (a.racksEdgeTallies as RackTallies | null) ?? { ...BLANK_RACK_TALLIES },
    saplingsGroupTallies: (a.saplingsGroupTallies as SaplingTallies | null) ?? { ...BLANK_SAPLING_TALLIES },
    deerSeenScore: (a.deerSeenScore as ScoreNLMH | null) ?? "",
    dungTally: a.dungTally != null ? String(a.dungTally) : "",
    couchesScore: (a.couchesScore as ScoreNLMH | null) ?? "",
    scrapesScore: (a.scrapesScore as ScoreNLMH | null) ?? "",
    wallowsScore: (a.wallowsScore as ScoreNLMH | null) ?? "",
    racksInWoodScore: (a.racksInWoodScore as RackScore | null) ?? "",
    racksEdgeScore: (a.racksEdgeScore as RackScore | null) ?? "",
    barkRemovalScore: (a.barkRemovalScore as ScoreNLMH | null) ?? "",
    frayingScore: (a.frayingScore as ScoreNLMH | null) ?? "",
    barkStrippingScore: (a.barkStrippingScore as ScoreNLMH | null) ?? "",
    brokenStemsScore: (a.brokenStemsScore as ScoreNLMH | null) ?? "",
    browselineScore: a.browselineScore ?? "",
    browsingCoppiceScore: a.browsingCoppiceScore ?? "",
    browsingBasalScore: a.browsingBasalScore ?? "",
    browsingSaplingsScore: a.browsingSaplingsScore ?? "",
    browsingBrambleScore: a.browsingBrambleScore ?? "",
    grazingFlora: (a.grazingFlora as GrazingEntry[] | null) ?? [],
    activitySummary: (a.activitySummary as ScoreNLMH | null) ?? "",
    impactSummary: (a.impactSummary as ScoreNLMH | null) ?? "",
    activityTrend: (a.activityTrend as TrendDir | null) ?? "",
    impactTrend: (a.impactTrend as TrendDir | null) ?? "",
    trendNotes: a.trendNotes ?? "",
    comments: a.comments ?? "",
    photos: (a.photos as { dataUrl: string; caption: string; lat?: number; lng?: number; takenAt?: number }[] | null) ?? [],
  };
}

function blankForm(stalkerName: string): AssessmentForm {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  return {
    date: dateStr,
    woodlandBlock: "",
    weather: "",
    recorder: stalkerName,
    sbiNumber: "",
    standType: "",
    canopyCover: "",
    mainSpeciesInStand: "",
    groundVegetation: "",
    vegWithoutDeer: "",
    deerPresent: "",
    speciesAssessed: "",
    speciesCausingImpact: "",
    gpsRoute: [],
    distanceWalked: 0,
    tallyCounts: { ...BLANK_TALLIES },
    racksInWoodTallies: { ...BLANK_RACK_TALLIES },
    racksEdgeTallies: { ...BLANK_RACK_TALLIES },
    saplingsGroupTallies: { ...BLANK_SAPLING_TALLIES },
    deerSeenScore: "",
    dungTally: "",
    couchesScore: "",
    scrapesScore: "",
    wallowsScore: "",
    racksInWoodScore: "",
    racksEdgeScore: "",
    barkRemovalScore: "",
    frayingScore: "",
    barkStrippingScore: "",
    brokenStemsScore: "",
    browselineScore: "",
    browsingCoppiceScore: "",
    browsingBasalScore: "",
    browsingSaplingsScore: "",
    browsingBrambleScore: "",
    grazingFlora: [{ species: "", impact: "N" }],
    activitySummary: "",
    impactSummary: "",
    activityTrend: "",
    impactTrend: "",
    trendNotes: "",
    comments: "",
    photos: [],
  };
}

function calcDistance(points: GpsPoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const R = 6371000;
    const dLat = ((points[i].lat - points[i - 1].lat) * Math.PI) / 180;
    const dLng = ((points[i].lng - points[i - 1].lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((points[i - 1].lat * Math.PI) / 180) *
        Math.cos((points[i].lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return Math.round(total);
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1200;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
        else { w = Math.round((w * MAX) / h); h = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function ScoreButtons({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts: { v: ScoreNLMH; label: string; cls: string }[] = [
    { v: "N", label: "None", cls: "bg-muted text-muted-foreground border-border" },
    { v: "L", label: "Low",  cls: "bg-emerald-50 text-emerald-700 border-emerald-300" },
    { v: "M", label: "Med",  cls: "bg-amber-50 text-amber-700 border-amber-300" },
    { v: "H", label: "High", cls: "bg-red-50 text-red-700 border-red-300" },
  ];
  return (
    <div className="flex gap-1.5">
      {opts.map(o => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(value === o.v ? "" : o.v)}
          className={cn(
            "flex-1 py-2.5 text-xs font-bold rounded-md border-2 transition-all",
            value === o.v
              ? o.v === "N" ? "bg-muted text-foreground border-foreground/40 ring-2 ring-offset-1 ring-foreground/20"
                : o.v === "L" ? "bg-emerald-600 text-white border-emerald-600 ring-2 ring-offset-1 ring-emerald-300"
                : o.v === "M" ? "bg-amber-500 text-white border-amber-500 ring-2 ring-offset-1 ring-amber-300"
                : "bg-red-600 text-white border-red-600 ring-2 ring-offset-1 ring-red-300"
              : cn("bg-card", o.cls)
          )}
        >
          {o.v}
        </button>
      ))}
    </div>
  );
}

function ScoreBadge({ score }: { score: ScoreNLMH }) {
  const cls =
    score === "N" ? "bg-muted text-muted-foreground border-border" :
    score === "L" ? "bg-emerald-100 text-emerald-700 border-emerald-300" :
    score === "M" ? "bg-amber-100 text-amber-700 border-amber-300" :
                    "bg-red-100 text-red-700 border-red-300";
  const label = score === "N" ? "None" : score === "L" ? "Low" : score === "M" ? "Moderate" : "High";
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border", cls)}>
      {score} · {label}
    </span>
  );
}

function TallyCounter({
  label, count, onCount, score, onScore, distanceWalked,
}: {
  label: string;
  count: number;
  onCount: (n: number) => void;
  score: ScoreNLMH | "";
  onScore: (v: string) => void;
  distanceWalked?: number;
}) {
  const rate = distanceWalked && distanceWalked >= 50 ? fmtRate(count, distanceWalked) : null;
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">{label}</span>
        {score !== "" && <ScoreBadge score={score} />}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onCount(Math.max(0, count - 1))}
          className="w-14 h-14 rounded-xl border-2 border-border bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground active:scale-95 transition-transform select-none"
        >
          −
        </button>
        <div className="flex-1 flex flex-col items-center">
          <span className="text-4xl font-bold tabular-nums text-foreground leading-none">{count}</span>
          {rate ? (
            <span className="text-[10px] text-primary font-semibold mt-1 tabular-nums">{rate}</span>
          ) : (
            <span className="text-[10px] text-muted-foreground mt-1">observations</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onCount(count + 1)}
          className="w-14 h-14 rounded-xl border-2 border-primary/30 bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary active:scale-95 transition-transform select-none"
        >
          +
        </button>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground mb-1">Override score:</p>
        <ScoreButtons value={score} onChange={onScore} />
      </div>
    </div>
  );
}

function GroupTallyCounter<T extends Record<string, number>>({
  label,
  categories,
  tallies,
  onChange,
}: {
  label: string;
  categories: { key: keyof T; label: string }[];
  tallies: T;
  onChange: (key: keyof T, n: number) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="bg-muted/40 px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">{label}</span>
      </div>
      <div className="divide-y divide-border">
        {categories.map(cat => {
          const count = tallies[cat.key] ?? 0;
          return (
            <div key={String(cat.key)} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex-1 text-xs text-foreground leading-snug">{cat.label}</span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onChange(cat.key, Math.max(0, count - 1))}
                  className="w-9 h-9 rounded-lg border-2 border-border bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground active:scale-95 transition-transform select-none"
                >−</button>
                <span className="w-8 text-center text-xl font-bold tabular-nums text-foreground">{count}</span>
                <button
                  type="button"
                  onClick={() => onChange(cat.key, count + 1)}
                  className="w-9 h-9 rounded-lg border-2 border-primary/30 bg-primary/10 flex items-center justify-center text-lg font-bold text-primary active:scale-95 transition-transform select-none"
                >+</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendButtons({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts: { v: TrendDir; icon: React.ReactNode; label: string }[] = [
    { v: "up",    icon: <TrendingUp className="w-4 h-4" />,    label: "↑ Improving" },
    { v: "level", icon: <Minus className="w-4 h-4" />,         label: "↔ Stable" },
    { v: "down",  icon: <TrendingDown className="w-4 h-4" />,  label: "↓ Worsening" },
  ];
  return (
    <div className="flex gap-1.5">
      {opts.map(o => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(value === o.v ? "" : o.v)}
          className={cn(
            "flex-1 flex flex-col items-center gap-1 py-2.5 rounded-md border-2 text-xs font-semibold transition-all",
            value === o.v
              ? o.v === "up"    ? "bg-emerald-600 text-white border-emerald-600"
                : o.v === "level" ? "bg-muted text-foreground border-foreground/40"
                : "bg-red-600 text-white border-red-600"
              : "bg-card text-muted-foreground border-border hover:border-foreground/30"
          )}
        >
          {o.icon}
          <span className="leading-none">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function RackButtons({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts: RackScore[] = ["rarely", "lightly", "frequently", "heavily"];
  return (
    <div className="flex gap-1.5">
      {opts.map(o => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(value === o ? "" : o)}
          className={cn(
            "flex-1 py-2 text-[10px] font-semibold rounded-md border-2 capitalize transition-all",
            value === o
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-muted-foreground border-border hover:border-primary/40"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function OptionButtons({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; label: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {options.map(o => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(value === o.v ? "" : o.v)}
          className={cn(
            "py-2.5 px-2 text-[11px] text-left rounded-md border-2 leading-snug transition-all",
            value === o.v
              ? "bg-primary text-primary-foreground border-primary font-semibold"
              : "bg-card text-muted-foreground border-border hover:border-primary/40"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <p className="text-xs font-semibold text-foreground uppercase tracking-wide">{children}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function FieldGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-4", className)}>{children}</div>;
}

const BROWSELINE_OPTIONS = [
  { v: "not_obvious", label: "Not obvious — even ivy unaffected" },
  { v: "soft",        label: '"Soft" — favoured species only browsed' },
  { v: "hard_not",    label: '"Hard" — not non-favoured species' },
  { v: "hard_all",    label: '"Hard" — most/all species affected' },
];
const COPPICE_OPTIONS = [
  { v: "0_10",   label: "0–10% browsed, others at expected height" },
  { v: "11_33",  label: "11–33% browsed, others at expected height" },
  { v: "34_66",  label: "34–66% browsed, average height suppressed" },
  { v: "67plus", label: "67%+ browsed, height suppressed" },
];
const BASAL_OPTIONS = [
  { v: "0_10",   label: "0–10% browsed" },
  { v: "11_33",  label: "11–33% browsed" },
  { v: "34_66",  label: "34–66% browsed" },
  { v: "67plus", label: "67%+ browsed" },
];
const SAPLINGS_OPTIONS = [
  { v: "none_little",   label: "No/little browsing, all heights present" },
  { v: "lt50_some50cm", label: "<50% browsed, some >50cm" },
  { v: "gt50_few50cm",  label: ">50% browsed or few >50cm" },
  { v: "gt75_few30cm",  label: ">75% browsed or few >30cm" },
];
const BRAMBLE_OPTIONS = [
  { v: "large_expected", label: "Large areas at expected height, little browsing" },
  { v: "large_some",     label: "Large patches to height, some browsing/browseline" },
  { v: "most_lt1m2",     label: "Most <1.2m, most/all browsed" },
  { v: "wisps_lt50cm",   label: "Wisps / most <50cm, most/all browsed" },
];
const GRAZING_OPTIONS: { v: ScoreNLMH; label: string }[] = [
  { v: "N", label: "None/little" },
  { v: "L", label: "Some impact" },
  { v: "M", label: "Moderate" },
  { v: "H", label: "High" },
];
const CANOPY_OPTIONS = [
  { v: "open",     label: "Open (<20%)" },
  { v: "partial",  label: "Partial (20–60%)" },
  { v: "closed",   label: "Closed (60–80%)" },
  { v: "dense",    label: "Dense (>80%)" },
];

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2 pb-1">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">{title}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function scoreLabel(v: string | null | undefined): string {
  if (!v) return "—";
  if (v === "N") return "None";
  if (v === "L") return "Low";
  if (v === "M") return "Moderate";
  if (v === "H") return "High";
  return v;
}

function trendLabel(v: string | null | undefined): string {
  if (v === "up") return "↑ Improving";
  if (v === "level") return "↔ Stable";
  if (v === "down") return "↓ Worsening";
  return "—";
}

function findLabel(opts: { v: string; label: string }[], v: string | null | undefined): string {
  if (!v) return "—";
  return opts.find(o => o.v === v)?.label ?? v;
}

export default function AssessmentsPage() {
  const { stalker } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<"list" | "form" | "detail">("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);
  const [season, setSeason] = useState(getCurrentSeasonYear());
  const [blockFilter, setBlockFilter] = useState<string>("");
  const [recorderFilter, setRecorderFilter] = useState<string>("");
  const [showCompare, setShowCompare] = useState<boolean>(false);
  const [offlineBanner, setOfflineBanner] = useState(false);
  const seasons = getAvailableSeasons();

  const { data: assessments = [], isLoading } = useQuery<Assessment[]>({
    queryKey: ["assessments", season],
    queryFn: () => apiFetch<Assessment[]>(`/assessments?season=${season}`),
  });

  // Pull the previous season as well so we can compare year-on-year (only when comparison is opened).
  const { data: priorAssessments = [] } = useQuery<Assessment[]>({
    queryKey: ["assessments", season - 1],
    queryFn: () => apiFetch<Assessment[]>(`/assessments?season=${season - 1}`),
    enabled: showCompare,
  });

  const selected = assessments.find(a => a.id === selectedId) ?? null;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/assessments/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assessments"] }); setView("list"); setSelectedId(null); },
  });

  // Distinct blocks/recorders present in the current season for filter dropdowns.
  const blockOptions = Array.from(new Set(assessments.map(a => a.woodlandBlock).filter(Boolean) as string[])).sort();
  const recorderOptions = Array.from(new Set(assessments.map(a => a.recorder ?? a.stalkerName ?? "").filter(Boolean) as string[])).sort();

  const filteredAssessments = assessments.filter(a => {
    if (blockFilter && a.woodlandBlock !== blockFilter) return false;
    if (recorderFilter) {
      const r = a.recorder ?? a.stalkerName ?? "";
      if (r !== recorderFilter) return false;
    }
    return true;
  });

  if (view === "form") {
    return (
      <AssessmentFormWizard
        stalkerName={stalker?.name ?? ""}
        stalkerId={stalker?.id ?? null}
        existing={editingAssessment}
        onDone={(queuedOffline?: boolean) => {
          qc.invalidateQueries({ queryKey: ["assessments"] });
          if (queuedOffline) setOfflineBanner(true);
          setView("list");
          setEditingAssessment(null);
        }}
        onCancel={() => { setView("list"); setEditingAssessment(null); }}
      />
    );
  }

  if (view === "detail" && selected) {
    return (
      <AssessmentDetail
        assessment={selected}
        onBack={() => setView("list")}
        onEdit={() => { setEditingAssessment(selected); setView("form"); }}
        onDelete={() => {
          if (window.confirm("Delete this assessment?")) deleteMutation.mutate(selected.id);
        }}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {offlineBanner && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Assessment saved on this device</p>
              <p className="text-xs text-amber-700 mt-0.5">No connection was available. Your assessment is queued and will upload automatically as soon as you have signal.</p>
            </div>
            <button onClick={() => setOfflineBanner(false)} className="text-amber-500 hover:text-amber-700 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-display text-foreground">Impact Assessments</h2>
            <p className="text-xs text-muted-foreground">WS1 Deer Habitat Impact — CS Higher Tier</p>
          </div>
          <button
            onClick={() => setView("form")}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-muted-foreground font-semibold">Season:</label>
          <select
            value={season}
            onChange={e => setSeason(Number(e.target.value))}
            className="text-xs border border-border rounded px-2 py-1 bg-card text-foreground"
          >
            {seasons.map(y => (
              <option key={y} value={y}>{formatSeasonLabel(y)}</option>
            ))}
          </select>
          <button
            onClick={() => setShowCompare(s => !s)}
            className={cn(
              "text-[11px] flex items-center gap-1 px-2 py-1 rounded border font-semibold transition-colors",
              showCompare ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart3 className="w-3 h-3" />
            vs {formatSeasonLabel(season - 1)}
          </button>
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredAssessments.length}
            {filteredAssessments.length !== assessments.length && ` of ${assessments.length}`}
            {" assessment"}{filteredAssessments.length !== 1 ? "s" : ""}
          </span>
        </div>

        {(blockOptions.length > 0 || recorderOptions.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3 h-3 text-muted-foreground" />
            <select
              value={blockFilter}
              onChange={e => setBlockFilter(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-card text-foreground"
            >
              <option value="">All blocks</option>
              {blockOptions.map(b => (
                <option key={b} value={b}>{(WOODLAND_BLOCKS as Record<string, string>)[b] ?? b}</option>
              ))}
            </select>
            <select
              value={recorderFilter}
              onChange={e => setRecorderFilter(e.target.value)}
              className="text-xs border border-border rounded px-2 py-1 bg-card text-foreground"
            >
              <option value="">All recorders</option>
              {recorderOptions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {(blockFilter || recorderFilter) && (
              <button
                onClick={() => { setBlockFilter(""); setRecorderFilter(""); }}
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        )}

        {showCompare && (
          <YearOnYearPanel
            current={filteredAssessments}
            prior={priorAssessments}
            currentSeason={season}
          />
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}

        {!isLoading && assessments.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <ClipboardList className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No assessments recorded this season.</p>
            <button
              onClick={() => setView("form")}
              className="text-sm text-primary font-semibold hover:underline"
            >
              Start your first assessment →
            </button>
          </div>
        )}

        <div className="space-y-2">
          {filteredAssessments.map(a => (
            <button
              key={a.id}
              onClick={() => { setSelectedId(a.id); setView("detail"); }}
              className="w-full text-left bg-card border border-border rounded-lg px-4 py-3 hover:border-primary/40 hover:bg-muted/20 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {a.woodlandBlock ? WOODLAND_BLOCKS[a.woodlandBlock as keyof typeof WOODLAND_BLOCKS] ?? a.woodlandBlock : "Unknown block"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    {a.stalkerName ? ` · ${a.stalkerName}` : ""}
                    {a.durationMinutes ? ` · ${fmtDuration(a.durationMinutes)}` : ""}
                    {a.distanceWalked ? ` · ${a.distanceWalked}m walked` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {a.activitySummary && (
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded",
                      a.activitySummary === "H" ? "bg-red-100 text-red-700"
                        : a.activitySummary === "M" ? "bg-amber-100 text-amber-700"
                        : a.activitySummary === "L" ? "bg-emerald-100 text-emerald-700"
                        : "bg-muted text-muted-foreground"
                    )}>Act: {a.activitySummary}</span>
                  )}
                  {a.impactSummary && (
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded",
                      a.impactSummary === "H" ? "bg-red-100 text-red-700"
                        : a.impactSummary === "M" ? "bg-amber-100 text-amber-700"
                        : a.impactSummary === "L" ? "bg-emerald-100 text-emerald-700"
                        : "bg-muted text-muted-foreground"
                    )}>Imp: {a.impactSummary}</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReAuthOverlay({
  stalkerName,
  onSuccess,
  onCancel,
  error,
  setError,
}: {
  stalkerName: string;
  onSuccess: (token: string) => Promise<void>;
  onCancel: () => void;
  error: string;
  setError: (e: string) => void;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleReAuth() {
    if (pin.length !== 4) { setError("Please enter your 4-digit PIN."); return; }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/stalkers/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: stalkerName, pin }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Login failed"); return; }
      await onSuccess(data.token as string);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center bg-background px-6 gap-6">
      <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-lg p-6 space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
          <h2 className="text-base font-bold text-foreground">Session expired</h2>
          <p className="text-sm text-muted-foreground">
            Your assessment data is safe. Enter your PIN to re-authenticate and it will be submitted automatically.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1 text-center">{stalkerName}</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="••••"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="w-full border border-border rounded-md px-3 py-3 text-center text-xl tracking-[0.5em] font-mono bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            autoFocus
            onKeyDown={e => { if (e.key === "Enter") handleReAuth(); }}
          />
        </div>
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        <button
          onClick={handleReAuth}
          disabled={busy || pin.length !== 4}
          className="w-full py-3 rounded-lg bg-primary text-white font-bold text-sm disabled:opacity-50"
        >
          {busy ? "Verifying…" : "Verify & Submit"}
        </button>
        <button
          onClick={onCancel}
          className="w-full py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel — keep draft for later
        </button>
      </div>
    </div>
  );
}

function AssessmentFormWizard({
  stalkerName, stalkerId, existing, onDone, onCancel,
}: {
  stalkerName: string;
  stalkerId: number | null;
  existing?: Assessment | null;
  onDone: (queuedOffline?: boolean) => void;
  onCancel: () => void;
}) {
  const isEdit = !!existing;
  const [form, setForm] = useState<AssessmentForm>(() => existing ? assessmentToForm(existing) : blankForm(stalkerName));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draftBanner, setDraftBanner] = useState<"checking" | "found" | "none">(isEdit ? "none" : "checking");
  const [draftSaveLoc, setDraftSaveLoc] = useState<"local" | "idb" | null>(null);
  const [reAuthNeeded, setReAuthNeeded] = useState(false);
  const pendingPayloadRef = useRef<Record<string, unknown> | null>(null);

  const surveyStartRef = useRef<Date>(existing ? new Date(existing.startedAt ?? existing.date) : new Date());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    void hasDraft(DRAFT_KEY).then(found => {
      if (cancelled) return;
      setDraftBanner(found ? "found" : "none");
    });
    return () => { cancelled = true; };
  }, [isEdit]);

  function resumeDraft() {
    void loadDraft<{ form: AssessmentForm; startedAt: string }>(DRAFT_KEY).then(saved => {
      if (saved) {
        setForm(saved.form);
        surveyStartRef.current = new Date(saved.startedAt);
      }
      setDraftBanner("none");
    });
  }

  function discardDraft() {
    void clearDraft(DRAFT_KEY);
    setDraftBanner("none");
  }

  useEffect(() => {
    if (isEdit) return;
    if (draftBanner === "checking") return;
    void saveDraft(DRAFT_KEY, {
      form,
      startedAt: surveyStartRef.current.toISOString(),
    }).then(loc => setDraftSaveLoc(loc)).catch(() => { /* swallow */ });
  }, [form, draftBanner, isEdit]);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - surveyStartRef.current.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (form.distanceWalked < 50) return;
    setForm(f => {
      const d = f.distanceWalked;
      const recalc = (key: keyof TallyCounts): ScoreNLMH => {
        const { mMin, hMin } = TALLY_THRESHOLDS[key];
        return scorePerKm(f.tallyCounts[key], d, mMin, hMin);
      };
      return {
        ...f,
        deerSeenScore:      f.deerSeenScore      === "" ? "" : recalc("deerSeen"),
        couchesScore:       f.couchesScore       === "" ? "" : recalc("couches"),
        scrapesScore:       f.scrapesScore       === "" ? "" : recalc("scrapes"),
        wallowsScore:       f.wallowsScore       === "" ? "" : recalc("wallows"),
        barkRemovalScore:   f.barkRemovalScore   === "" ? "" : recalc("barkRemoval"),
        frayingScore:       f.frayingScore       === "" ? "" : recalc("fraying"),
        barkStrippingScore: f.barkStrippingScore === "" ? "" : recalc("barkStripping"),
        brokenStemsScore:   f.brokenStemsScore   === "" ? "" : recalc("brokenStems"),
        browsingCoppiceScore: f.browsingCoppiceScore === "" ? "" : recalc("browsingCoppice"),
        browsingBasalScore:   f.browsingBasalScore   === "" ? "" : recalc("browsingBasal"),
      };
    });
  }, [form.distanceWalked]);

  const [gpsTracking, setGpsTracking] = useState(false);
  const watchId = useRef<number | null>(null);
  const lastPointRef = useRef<GpsPoint | null>(null);

  function setField<K extends keyof AssessmentForm>(k: K, v: AssessmentForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function setTally(key: keyof TallyCounts, rawCount: number) {
    const count = Math.max(0, rawCount);
    setForm(f => {
      const { mMin, hMin } = TALLY_THRESHOLDS[key];
      const score = scorePerKm(count, f.distanceWalked, mMin, hMin);
      return {
        ...f,
        tallyCounts: { ...f.tallyCounts, [key]: count },
        ...(key === "deerSeen"        ? { deerSeenScore: score }        : {}),
        ...(key === "dung"            ? { dungTally: String(count) }    : {}),
        ...(key === "couches"         ? { couchesScore: score }         : {}),
        ...(key === "scrapes"         ? { scrapesScore: score }         : {}),
        ...(key === "wallows"         ? { wallowsScore: score }         : {}),
        ...(key === "barkRemoval"     ? { barkRemovalScore: score }     : {}),
        ...(key === "fraying"         ? { frayingScore: score }         : {}),
        ...(key === "barkStripping"   ? { barkStrippingScore: score }   : {}),
        ...(key === "brokenStems"     ? { brokenStemsScore: score }     : {}),
        ...(key === "browsingCoppice" ? { browsingCoppiceScore: score } : {}),
        ...(key === "browsingBasal"   ? { browsingBasalScore: score }   : {}),
      };
    });
  }

  function startGps() {
    if (!navigator.geolocation) { alert("GPS not available on this device."); return; }
    setGpsTracking(true);
    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        const pt: GpsPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now() };
        const last = lastPointRef.current;
        if (last) {
          const dLat = (pt.lat - last.lat) * Math.PI / 180;
          const dLng = (pt.lng - last.lng) * Math.PI / 180;
          const a = Math.sin(dLat/2)**2 + Math.cos(last.lat*Math.PI/180)*Math.cos(pt.lat*Math.PI/180)*Math.sin(dLng/2)**2;
          const dist = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          if (dist < 3) return;
        }
        lastPointRef.current = pt;
        setForm(f => {
          const route = [...f.gpsRoute, pt];
          return { ...f, gpsRoute: route, distanceWalked: calcDistance(route) };
        });
      },
      err => { console.warn("GPS error", err); },
      { enableHighAccuracy: true, maximumAge: 2000 }
    );
  }

  function stopGps() {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setGpsTracking(false);
  }

  useEffect(() => () => { if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current); }, []);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    let photoLat: number | undefined;
    let photoLng: number | undefined;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 30000 })
        );
        photoLat = pos.coords.latitude;
        photoLng = pos.coords.longitude;
      } catch { /* GPS unavailable or denied — save without coords */ }
    }

    const takenAt = Date.now();
    const compressed = await Promise.all(files.map(f => compressImage(f)));
    const entries = compressed.map(dataUrl => ({ dataUrl, caption: "", lat: photoLat, lng: photoLng, takenAt }));
    setField("photos", [...form.photos, ...entries]);
    e.target.value = "";
  }

  async function submit() {
    if (!form.woodlandBlock) { setError("Please select a woodland block."); return; }
    setSaving(true);
    setError("");
    const endedAt = new Date();
    const durationMinutes = Math.round((endedAt.getTime() - surveyStartRef.current.getTime()) / 60000);
    const payload: Record<string, unknown> = {
      ...form,
      stalkerId,
      date: new Date(form.date).toISOString(),
      startedAt: surveyStartRef.current.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMinutes: durationMinutes > 0 ? durationMinutes : null,
      dungTally: form.dungTally ? parseInt(form.dungTally, 10) : null,
      distanceWalked: form.distanceWalked || null,
      woodlandBlock: form.woodlandBlock || null,
      weather: form.weather || null,
      deerSeenScore: form.deerSeenScore || null,
      couchesScore: form.couchesScore || null,
      scrapesScore: form.scrapesScore || null,
      wallowsScore: form.wallowsScore || null,
      racksInWoodScore: highestRackScore(form.racksInWoodTallies) || form.racksInWoodScore || null,
      racksEdgeScore: highestRackScore(form.racksEdgeTallies) || form.racksEdgeScore || null,
      browsingSaplingsScore: highestSaplingsScore(form.saplingsGroupTallies) || null,
      racksInWoodTallies: form.racksInWoodTallies,
      racksEdgeTallies: form.racksEdgeTallies,
      saplingsGroupTallies: form.saplingsGroupTallies,
      barkRemovalScore: form.barkRemovalScore || null,
      frayingScore: form.frayingScore || null,
      barkStrippingScore: form.barkStrippingScore || null,
      brokenStemsScore: form.brokenStemsScore || null,
      browselineScore: form.browselineScore || null,
      browsingCoppiceScore: form.browsingCoppiceScore || null,
      browsingBasalScore: form.browsingBasalScore || null,
      browsingBrambleScore: form.browsingBrambleScore || null,
      activitySummary: form.activitySummary || null,
      impactSummary: form.impactSummary || null,
      activityTrend: form.activityTrend || null,
      impactTrend: form.impactTrend || null,
      grazingFlora: form.grazingFlora.filter(g => g.species.trim()),
      gpsRoute: form.gpsRoute.length > 0 ? form.gpsRoute : null,
      tallyCounts: form.tallyCounts,
    };
    async function submitPayload(p: Record<string, unknown>) {
      if (isEdit && existing) {
        await apiFetch(`/assessments/${existing.id}`, { method: "PUT", body: JSON.stringify(p) }, 15_000);
      } else {
        await apiFetch("/assessments", { method: "POST", body: JSON.stringify(p) }, 15_000);
      }
    }

    try {
      if (!navigator.onLine && !isEdit) {
        await enqueueAssessment(payload);
        await clearDraft(DRAFT_KEY);
        onDone(true);
        return;
      }
      await submitPayload(payload);
      if (!isEdit) await clearDraft(DRAFT_KEY);
      onDone();
    } catch (e) {
      if (e instanceof AuthExpiredError) {
        pendingPayloadRef.current = payload;
        setReAuthNeeded(true);
        setSaving(false);
        return;
      }
      if (e instanceof NetworkError && !isEdit) {
        await enqueueAssessment(payload);
        await clearDraft(DRAFT_KEY);
        setSaving(false);
        onDone(true);
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function retryAfterReAuth() {
    const payload = pendingPayloadRef.current;
    if (!payload) return;
    setSaving(true);
    setError("");
    try {
      if (isEdit && existing) {
        await apiFetch(`/assessments/${existing.id}`, { method: "PUT", body: JSON.stringify(payload) }, 15_000);
      } else {
        await apiFetch("/assessments", { method: "POST", body: JSON.stringify(payload) }, 15_000);
      }
      pendingPayloadRef.current = null;
      if (!isEdit) await clearDraft(DRAFT_KEY);
      onDone();
    } catch (e) {
      if (e instanceof NetworkError && !isEdit) {
        await enqueueAssessment(payload);
        pendingPayloadRef.current = null;
        await clearDraft(DRAFT_KEY);
        setSaving(false);
        onDone(true);
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to save after re-authentication");
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full border border-border rounded-md px-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/40";
  const textarea = cn(input, "resize-none min-h-[70px]");

  const dist = form.distanceWalked;
  const s = (key: keyof TallyCounts, override: ScoreNLMH | ""): ScoreNLMH => {
    const { mMin, hMin } = TALLY_THRESHOLDS[key];
    return (override as ScoreNLMH) || scorePerKm(form.tallyCounts[key], dist, mMin, hMin);
  };
  const tallyRows: { label: string; count: number; rate: string; score: ScoreNLMH }[] = [
    { label: "Deer seen",        count: form.tallyCounts.deerSeen,      rate: fmtRate(form.tallyCounts.deerSeen,      dist), score: s("deerSeen",      form.deerSeenScore)      },
    { label: "Dung piles",       count: form.tallyCounts.dung,          rate: fmtRate(form.tallyCounts.dung,          dist), score: scorePerKm(form.tallyCounts.dung, dist, 5, 10) },
    { label: "Couches",          count: form.tallyCounts.couches,       rate: fmtRate(form.tallyCounts.couches,       dist), score: s("couches",      form.couchesScore)       },
    { label: "Scrapes",          count: form.tallyCounts.scrapes,       rate: fmtRate(form.tallyCounts.scrapes,       dist), score: s("scrapes",      form.scrapesScore)       },
    { label: "Wallows",          count: form.tallyCounts.wallows,       rate: fmtRate(form.tallyCounts.wallows,       dist), score: s("wallows",      form.wallowsScore)       },
    { label: "Bark removal",     count: form.tallyCounts.barkRemoval,   rate: fmtRate(form.tallyCounts.barkRemoval,   dist), score: s("barkRemoval",  form.barkRemovalScore)   },
    { label: "Fraying",          count: form.tallyCounts.fraying,       rate: fmtRate(form.tallyCounts.fraying,       dist), score: s("fraying",      form.frayingScore)       },
    { label: "Bark stripping",   count: form.tallyCounts.barkStripping, rate: fmtRate(form.tallyCounts.barkStripping, dist), score: s("barkStripping",form.barkStrippingScore) },
    { label: "Broken stems",     count: form.tallyCounts.brokenStems,   rate: fmtRate(form.tallyCounts.brokenStems,   dist), score: s("brokenStems",  form.brokenStemsScore)   },
    { label: "Browsing coppice", count: form.tallyCounts.browsingCoppice, rate: fmtRate(form.tallyCounts.browsingCoppice, dist), score: s("browsingCoppice", form.browsingCoppiceScore as ScoreNLMH | "") },
    { label: "Browsing basal",   count: form.tallyCounts.browsingBasal,   rate: fmtRate(form.tallyCounts.browsingBasal,   dist), score: s("browsingBasal",   form.browsingBasalScore   as ScoreNLMH | "") },
  ];

  const rackCats: { key: keyof RackTallies; label: string }[] = [
    { key: "rarely",     label: "Rarely" },
    { key: "lightly",    label: "Lightly" },
    { key: "frequently", label: "Frequently" },
    { key: "heavily",    label: "Heavily" },
  ];
  const saplingCats: { key: keyof SaplingTallies; label: string }[] = [
    { key: "none_little",   label: "No/little browsing" },
    { key: "lt50_some50cm", label: "<50% browsed, some >50cm" },
    { key: "gt50_few50cm",  label: ">50% browsed or few >50cm" },
    { key: "gt75_few30cm",  label: ">75% browsed or few >30cm" },
  ];

  const scoreCls = (s: ScoreNLMH) =>
    s === "N" ? "bg-muted text-muted-foreground" :
    s === "L" ? "bg-emerald-100 text-emerald-700" :
    s === "M" ? "bg-amber-100 text-amber-700" :
                "bg-red-100 text-red-700";

  function renderForm() {
    return (
      <FieldGroup>
        {/* ── Site & Habitat ── */}
        <SectionDivider title="Site & Habitat" />
        <div>
          <FieldLabel>Woodland Block *</FieldLabel>
          <select value={form.woodlandBlock} onChange={e => setField("woodlandBlock", e.target.value)} className={input}>
            <option value="">Select block…</option>
            {Object.entries(WOODLAND_BLOCKS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Date</FieldLabel>
            <input type="date" value={form.date} onChange={e => setField("date", e.target.value)} className={input} />
          </div>
          <div>
            <FieldLabel>Weather</FieldLabel>
            <select value={form.weather} onChange={e => setField("weather", e.target.value)} className={input}>
              <option value="">Select…</option>
              {Object.entries(WEATHER_CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Recorder</FieldLabel>
            <input value={form.recorder} onChange={e => setField("recorder", e.target.value)} className={input} />
          </div>
          <div>
            <FieldLabel>SBI Number</FieldLabel>
            <input value={form.sbiNumber} placeholder="Optional" onChange={e => setField("sbiNumber", e.target.value)} className={input} />
          </div>
        </div>
        <div>
          <FieldLabel>Stand / Habitat Type</FieldLabel>
          <input value={form.standType} placeholder="e.g. Oak woodland, plantation, scrub…" onChange={e => setField("standType", e.target.value)} className={input} />
        </div>
        <div>
          <FieldLabel>Canopy Cover</FieldLabel>
          <OptionButtons value={form.canopyCover} onChange={v => setField("canopyCover", v)} options={CANOPY_OPTIONS} />
        </div>
        <div>
          <FieldLabel>Main Species in Stand</FieldLabel>
          <input value={form.mainSpeciesInStand} placeholder="e.g. Oak, ash, hazel…" onChange={e => setField("mainSpeciesInStand", e.target.value)} className={input} />
        </div>
        <div>
          <FieldLabel>Predominant Ground Vegetation</FieldLabel>
          <input value={form.groundVegetation} placeholder="e.g. Bramble, grass, bracken…" onChange={e => setField("groundVegetation", e.target.value)} className={input} />
        </div>
        <div>
          <FieldLabel>Expected vegetation without deer browse</FieldLabel>
          <textarea value={form.vegWithoutDeer} onChange={e => setField("vegWithoutDeer", e.target.value)} className={textarea} placeholder="What would regenerate if deer were absent?" />
        </div>

        {/* ── GPS Transect ── */}
        <SectionDivider title="GPS Transect" />
        <div className="bg-muted/40 border border-border rounded-lg p-4 space-y-3">
          <p className="text-sm text-foreground font-semibold">Record your transect route</p>
          <p className="text-xs text-muted-foreground">Tap <strong>Start</strong> before walking, then <strong>Stop</strong> when done. GPS works without phone signal.</p>
          {gpsTracking ? (
            <button type="button" onClick={stopGps} className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-3 rounded-lg font-semibold">
              <Square className="w-4 h-4 fill-current" />
              Stop GPS Recording
            </button>
          ) : (
            <button type="button" onClick={startGps} className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-lg font-semibold">
              <Play className="w-4 h-4 fill-current" />
              Start GPS Recording
            </button>
          )}
          {gpsTracking && (
            <div className="flex items-center gap-2 text-xs text-primary animate-pulse">
              <Navigation2 className="w-3 h-3" />
              Recording route…
            </div>
          )}
          {form.gpsRoute.length > 0 && (
            <div className="text-sm font-semibold text-foreground">
              Distance walked: <span className="text-primary">{form.distanceWalked}m</span>
              <span className="text-xs text-muted-foreground ml-2">({form.gpsRoute.length} waypoints)</span>
            </div>
          )}
        </div>
        <div>
          <FieldLabel>Distance Walked (m)</FieldLabel>
          <p className="text-[11px] text-muted-foreground mb-1.5">Auto-filled by GPS above, or enter manually.</p>
          <input type="number" value={form.distanceWalked || ""} onChange={e => setField("distanceWalked", Number(e.target.value))} className={input} placeholder="Metres" />
        </div>

        {/* ── Deer Context ── */}
        <SectionDivider title="Deer Context" />
        <div>
          <FieldLabel>Deer & browsing species present in this area</FieldLabel>
          <textarea value={form.deerPresent} onChange={e => setField("deerPresent", e.target.value)} className={textarea} placeholder="e.g. Roe, Fallow, Rabbit…" />
        </div>
        <div>
          <FieldLabel>Species this record relates to</FieldLabel>
          <input value={form.speciesAssessed} onChange={e => setField("speciesAssessed", e.target.value)} className={input} placeholder="e.g. Roe deer" />
        </div>
        <div>
          <FieldLabel>Species causing most impact in this area</FieldLabel>
          <input value={form.speciesCausingImpact} onChange={e => setField("speciesCausingImpact", e.target.value)} className={input} placeholder="e.g. Fallow deer" />
        </div>

        {/* ── Activity Signs ── */}
        <SectionDivider title="Activity Signs" />
        <p className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">Tap <strong>+</strong> each time you observe a sign. Scores are calibrated per kilometre walked (Forestry England WS1 guidance) — the /km rate updates automatically as GPS tracks your transect. Use the override buttons if needed.</p>
        <TallyCounter label="Deer seen" count={form.tallyCounts.deerSeen} onCount={n => setTally("deerSeen", n)} score={form.deerSeenScore} onScore={v => setField("deerSeenScore", v as ScoreNLMH | "")} distanceWalked={dist} />
        <TallyCounter label="Dung piles" count={form.tallyCounts.dung} onCount={n => setTally("dung", n)} score={scorePerKm(form.tallyCounts.dung, dist, 5, 10)} onScore={() => {}} distanceWalked={dist} />
        <TallyCounter label="Couches" count={form.tallyCounts.couches} onCount={n => setTally("couches", n)} score={form.couchesScore} onScore={v => setField("couchesScore", v as ScoreNLMH | "")} distanceWalked={dist} />
        <TallyCounter label="Scrapes" count={form.tallyCounts.scrapes} onCount={n => setTally("scrapes", n)} score={form.scrapesScore} onScore={v => setField("scrapesScore", v as ScoreNLMH | "")} distanceWalked={dist} />
        <TallyCounter label="Wallows" count={form.tallyCounts.wallows} onCount={n => setTally("wallows", n)} score={form.wallowsScore} onScore={v => setField("wallowsScore", v as ScoreNLMH | "")} distanceWalked={dist} />
        <GroupTallyCounter<RackTallies>
          label="Racks — within wood"
          categories={[
            { key: "rarely",     label: "Rarely" },
            { key: "lightly",    label: "Lightly" },
            { key: "frequently", label: "Frequently" },
            { key: "heavily",    label: "Heavily" },
          ]}
          tallies={form.racksInWoodTallies}
          onChange={(key, n) => setField("racksInWoodTallies", { ...form.racksInWoodTallies, [key]: n })}
        />
        <GroupTallyCounter<RackTallies>
          label="Racks — at woodland edge"
          categories={[
            { key: "rarely",     label: "Rarely" },
            { key: "lightly",    label: "Lightly" },
            { key: "frequently", label: "Frequently" },
            { key: "heavily",    label: "Heavily" },
          ]}
          tallies={form.racksEdgeTallies}
          onChange={(key, n) => setField("racksEdgeTallies", { ...form.racksEdgeTallies, [key]: n })}
        />

        {/* ── Impact Signs ── */}
        <SectionDivider title="Impact Signs" />
        <p className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">Tap <strong>+</strong> each time you find an instance of damage. Scores are calibrated per km walked — override if needed.</p>
        <TallyCounter label="Bark removal / breakage" count={form.tallyCounts.barkRemoval} onCount={n => setTally("barkRemoval", n)} score={form.barkRemovalScore} onScore={v => setField("barkRemovalScore", v as ScoreNLMH | "")} distanceWalked={dist} />
        <TallyCounter label="Fraying / thrashing" count={form.tallyCounts.fraying} onCount={n => setTally("fraying", n)} score={form.frayingScore} onScore={v => setField("frayingScore", v as ScoreNLMH | "")} distanceWalked={dist} />
        <TallyCounter label="Bark stripping" count={form.tallyCounts.barkStripping} onCount={n => setTally("barkStripping", n)} score={form.barkStrippingScore} onScore={v => setField("barkStrippingScore", v as ScoreNLMH | "")} distanceWalked={dist} />
        <TallyCounter label="Broken stems" count={form.tallyCounts.brokenStems} onCount={n => setTally("brokenStems", n)} score={form.brokenStemsScore} onScore={v => setField("brokenStemsScore", v as ScoreNLMH | "")} distanceWalked={dist} />

        {/* ── Browsing & Grazing ── */}
        <SectionDivider title="Browsing & Grazing" />
        <TallyCounter label="Browsing — Coppice <2m (browsed shoots)" count={form.tallyCounts.browsingCoppice} onCount={n => setTally("browsingCoppice", n)} score={form.browsingCoppiceScore as ScoreNLMH | ""} onScore={v => setField("browsingCoppiceScore", v as ScoreNLMH | "")} distanceWalked={dist} />
        <TallyCounter label="Browsing — Live basal shoots" count={form.tallyCounts.browsingBasal} onCount={n => setTally("browsingBasal", n)} score={form.browsingBasalScore as ScoreNLMH | ""} onScore={v => setField("browsingBasalScore", v as ScoreNLMH | "")} distanceWalked={dist} />
        <GroupTallyCounter<SaplingTallies>
          label="Browsing — Tree seedlings / saplings"
          categories={[
            { key: "none_little",   label: "No/little browsing, all heights present" },
            { key: "lt50_some50cm", label: "<50% browsed, some >50cm" },
            { key: "gt50_few50cm",  label: ">50% browsed or few >50cm" },
            { key: "gt75_few30cm",  label: ">75% browsed or few >30cm" },
          ]}
          tallies={form.saplingsGroupTallies}
          onChange={(key, n) => setField("saplingsGroupTallies", { ...form.saplingsGroupTallies, [key]: n })}
        />
        <div>
          <FieldLabel>Browseline</FieldLabel>
          <OptionButtons value={form.browselineScore} onChange={v => setField("browselineScore", v)} options={BROWSELINE_OPTIONS} />
        </div>
        <div>
          <FieldLabel>Browsing — Bramble</FieldLabel>
          <OptionButtons value={form.browsingBrambleScore} onChange={v => setField("browsingBrambleScore", v)} options={BRAMBLE_OPTIONS} />
        </div>
        <div>
          <FieldLabel>Grazing (flora eaten) — plant species</FieldLabel>
          <p className="text-[11px] text-muted-foreground mb-2">List each plant species and score its impact.</p>
          <div className="space-y-2">
            {form.grazingFlora.map((g, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={g.species}
                  onChange={e => {
                    const arr = [...form.grazingFlora];
                    arr[i] = { ...arr[i], species: e.target.value };
                    setField("grazingFlora", arr);
                  }}
                  placeholder={`Species ${i + 1}`}
                  className={cn(input, "flex-1")}
                />
                <div className="flex gap-1">
                  {(["N","L","M","H"] as ScoreNLMH[]).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        const arr = [...form.grazingFlora];
                        arr[i] = { ...arr[i], impact: s };
                        setField("grazingFlora", arr);
                      }}
                      className={cn(
                        "w-8 h-9 text-xs font-bold rounded border",
                        g.impact === s
                          ? s === "N" ? "bg-muted text-foreground border-foreground/40"
                            : s === "L" ? "bg-emerald-600 text-white border-emerald-600"
                            : s === "M" ? "bg-amber-500 text-white border-amber-500"
                            : "bg-red-600 text-white border-red-600"
                          : "bg-card text-muted-foreground border-border"
                      )}
                    >{s}</button>
                  ))}
                </div>
                {form.grazingFlora.length > 1 && (
                  <button type="button" onClick={() => setField("grazingFlora", form.grazingFlora.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {form.grazingFlora.length < 6 && (
              <button type="button" onClick={() => setField("grazingFlora", [...form.grazingFlora, { species: "", impact: "N" }])} className="text-xs text-primary font-semibold hover:underline">
                + Add species
              </button>
            )}
          </div>
        </div>

        {/* ── Trends & Summary ── */}
        <SectionDivider title="Trends & Summary" />
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 border-b border-border">
            <p className="text-xs font-bold text-foreground uppercase tracking-wide">Tally Summary</p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Indicator</th>
                <th className="text-center px-2 py-1.5 text-muted-foreground font-medium">Count</th>
                <th className="text-center px-2 py-1.5 text-muted-foreground font-medium">/km</th>
                <th className="text-center px-2 py-1.5 text-muted-foreground font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {tallyRows.map(r => (
                <tr key={r.label} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-foreground">{r.label}</td>
                  <td className="px-2 py-2 text-center font-mono font-bold text-foreground">{r.count}</td>
                  <td className="px-2 py-2 text-center font-mono text-xs text-primary">{r.rate || "—"}</td>
                  <td className="px-2 py-2 text-center">
                    <span className={cn("inline-block px-2 py-0.5 rounded font-bold", scoreCls(r.score))}>{r.score}</span>
                  </td>
                </tr>
              ))}
              <tr className="border-b border-border bg-muted/30">
                <td colSpan={4} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Racks — within wood</td>
              </tr>
              {rackCats.map(c => (
                <tr key={"riw-" + c.key} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-foreground pl-5">{c.label}</td>
                  <td className="px-2 py-2 text-center font-mono font-bold text-foreground">{form.racksInWoodTallies[c.key]}</td>
                  <td className="px-2 py-2 text-center text-muted-foreground text-xs">—</td>
                  <td className="px-2 py-2 text-center text-muted-foreground text-xs">—</td>
                </tr>
              ))}
              <tr className="border-b border-border bg-muted/30">
                <td colSpan={4} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Racks — at woodland edge</td>
              </tr>
              {rackCats.map(c => (
                <tr key={"re-" + c.key} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-foreground pl-5">{c.label}</td>
                  <td className="px-2 py-2 text-center font-mono font-bold text-foreground">{form.racksEdgeTallies[c.key]}</td>
                  <td className="px-2 py-2 text-center text-muted-foreground text-xs">—</td>
                  <td className="px-2 py-2 text-center text-muted-foreground text-xs">—</td>
                </tr>
              ))}
              <tr className="border-b border-border bg-muted/30">
                <td colSpan={4} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Browsing — Saplings</td>
              </tr>
              {saplingCats.map(c => (
                <tr key={"sap-" + c.key} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-foreground pl-5">{c.label}</td>
                  <td className="px-2 py-2 text-center font-mono font-bold text-foreground">{form.saplingsGroupTallies[c.key]}</td>
                  <td className="px-2 py-2 text-center text-muted-foreground text-xs">—</td>
                  <td className="px-2 py-2 text-center text-muted-foreground text-xs">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <FieldLabel>Overall Activity Summary</FieldLabel>
          <ScoreButtons value={form.activitySummary} onChange={v => setField("activitySummary", v as ScoreNLMH | "")} />
        </div>
        <div>
          <FieldLabel>Overall Impact Summary</FieldLabel>
          <ScoreButtons value={form.impactSummary} onChange={v => setField("impactSummary", v as ScoreNLMH | "")} />
        </div>
        <div>
          <FieldLabel>Activity Trend (compared to previous year)</FieldLabel>
          <TrendButtons value={form.activityTrend} onChange={v => setField("activityTrend", v as TrendDir | "")} />
        </div>
        <div>
          <FieldLabel>Impact Trend (compared to previous year)</FieldLabel>
          <TrendButtons value={form.impactTrend} onChange={v => setField("impactTrend", v as TrendDir | "")} />
        </div>
        <div>
          <FieldLabel>Trend Notes</FieldLabel>
          <textarea value={form.trendNotes} onChange={e => setField("trendNotes", e.target.value)} className={textarea} placeholder="e.g. Bramble invading / retreating, formerly browsed stems with more/fewer viable shoots…" />
        </div>
        <div>
          <FieldLabel>Comments</FieldLabel>
          <textarea value={form.comments} onChange={e => setField("comments", e.target.value)} className={textarea} placeholder="Any other observations…" />
        </div>

        {/* ── Photos ── */}
        <SectionDivider title="Photos" />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-5 cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors">
            <Camera className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground text-center">Take photo</span>
            <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
          </label>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-5 cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors">
            <ImagePlus className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground text-center">From gallery</span>
            <input type="file" accept="image/*" multiple onChange={handlePhoto} className="hidden" />
          </label>
        </div>
        {form.photos.length > 0 ? (
          <div className="space-y-3">
            {form.photos.map((p, i) => (
              <div key={i} className="border border-border rounded-lg overflow-hidden">
                <img src={p.dataUrl} alt="" className="w-full max-h-48 object-cover" />
                <div className="p-2 flex gap-2">
                  <input
                    value={p.caption}
                    onChange={e => {
                      const arr = [...form.photos];
                      arr[i] = { ...arr[i], caption: e.target.value };
                      setField("photos", arr);
                    }}
                    placeholder="Caption (optional)"
                    className={cn(input, "flex-1 text-xs py-1.5")}
                  />
                  <button type="button" onClick={() => setField("photos", form.photos.filter((_, j) => j !== i))} className="p-1.5 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">Photos are optional — the assessment can be saved without them.</p>
        )}
      </FieldGroup>
    );
  }

  if (reAuthNeeded) {
    return (
      <ReAuthOverlay
        stalkerName={stalkerName}
        onSuccess={async (newToken) => {
          try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
              const parsed = JSON.parse(stored) as Record<string, unknown>;
              localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, token: newToken }));
            }
          } catch { /* ignore */ }
          setReAuthNeeded(false);
          await retryAfterReAuth();
        }}
        onCancel={() => {
          setReAuthNeeded(false);
          setError("Your assessment data is still saved as a draft. Please sign in again from the home screen, then open a new assessment to find your draft.");
        }}
        error={error}
        setError={setError}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="shrink-0 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => { void clearDraft(DRAFT_KEY); onCancel(); }} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-foreground flex-1">New Impact Assessment</h2>
          <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-md px-2.5 py-1">
            <Timer className="w-3 h-3 text-primary" />
            <span className="text-xs font-mono font-semibold text-primary tabular-nums">{fmtElapsed(elapsedSeconds)}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {draftBanner === "found" && (
          <div className="mb-4 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-sm font-semibold text-amber-800">Unsaved assessment found</p>
            </div>
            <p className="text-xs text-amber-700">An assessment that wasn't submitted was saved on this device. Do you want to pick up where you left off?</p>
            <div className="flex gap-2">
              <button type="button" onClick={resumeDraft} className="flex-1 py-2 text-xs font-bold bg-amber-600 text-white rounded-md hover:bg-amber-700">Resume</button>
              <button type="button" onClick={discardDraft} className="flex-1 py-2 text-xs font-semibold border border-amber-300 text-amber-700 rounded-md hover:bg-amber-100">Start fresh</button>
            </div>
          </div>
        )}
        {renderForm()}
        {error && (
          <div className="mt-4 flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        <div className="pt-4 pb-2">
          <button onClick={submit} disabled={saving} className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-lg text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? "Saving… (up to 15 s)" : "Save Assessment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Render a static survey route map to a PNG data URL using a canvas.
// Uses an equirectangular projection scaled to the bounding box of all points.
async function renderRouteMap(
  route: GpsPoint[],
  photoPoints: { lat: number; lng: number }[],
  width: number,
  height: number,
): Promise<string | null> {
  const all = [...route.map(r => ({ lat: r.lat, lng: r.lng })), ...photoPoints];
  if (all.length === 0) return null;

  const lats = all.map(p => p.lat);
  const lngs = all.map(p => p.lng);
  let minLat = Math.min(...lats), maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  // Pad bounding box so points aren't on the edge; ensure non-zero extent.
  const padLat = Math.max((maxLat - minLat) * 0.15, 0.0008);
  const padLng = Math.max((maxLng - minLng) * 0.15, 0.0012);
  minLat -= padLat; maxLat += padLat;
  minLng -= padLng; maxLng += padLng;

  // Maintain aspect ratio (compensate for latitude foreshortening).
  const cosLat = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const dataAspect = ((maxLng - minLng) * cosLat) / (maxLat - minLat);
  const canvasAspect = width / height;
  if (dataAspect > canvasAspect) {
    const targetLatRange = ((maxLng - minLng) * cosLat) / canvasAspect;
    const extra = (targetLatRange - (maxLat - minLat)) / 2;
    minLat -= extra; maxLat += extra;
  } else {
    const targetLngRange = ((maxLat - minLat) * canvasAspect) / cosLat;
    const extra = (targetLngRange - (maxLng - minLng)) / 2;
    minLng -= extra; maxLng += extra;
  }

  const project = (lat: number, lng: number): [number, number] => {
    const x = ((lng - minLng) / (maxLng - minLng)) * width;
    const y = height - ((lat - minLat) / (maxLat - minLat)) * height;
    return [x, y];
  };

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background — soft cream so the printed map reads well in mono too.
  ctx.fillStyle = "#f7f4ec";
  ctx.fillRect(0, 0, width, height);

  // Faint gridlines for orientation
  ctx.strokeStyle = "rgba(33,80,58,0.12)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const gx = (i / 6) * width;
    const gy = (i / 6) * height;
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke();
  }

  // Border
  ctx.strokeStyle = "#21503a";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // GPS route polyline
  if (route.length > 1) {
    ctx.strokeStyle = "#21503a";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    route.forEach((p, i) => {
      const [x, y] = project(p.lat, p.lng);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // Start / end markers
  if (route.length > 0) {
    const [sx, sy] = project(route[0].lat, route[0].lng);
    ctx.fillStyle = "#16a34a";
    ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("S", sx, sy);

    const last = route[route.length - 1];
    const [ex, ey] = project(last.lat, last.lng);
    ctx.fillStyle = "#dc2626";
    ctx.beginPath(); ctx.arc(ex, ey, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.fillText("E", ex, ey);
  }

  // Photo markers (numbered circles)
  photoPoints.forEach((p, i) => {
    const [x, y] = project(p.lat, p.lng);
    ctx.fillStyle = "#0284c7";
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), x, y);
  });

  // Scale bar (approx, in metres) — distance per pixel at the centre latitude.
  const metresPerDegLng = 111320 * cosLat;
  const metresPerPx = ((maxLng - minLng) * metresPerDegLng) / width;
  // Pick a clean target metre length around 100px
  const targetMetres = metresPerPx * 100;
  const exp = Math.pow(10, Math.floor(Math.log10(targetMetres)));
  const candidates = [1, 2, 5].map(c => c * exp);
  const chosen = candidates.reduce((best, c) => Math.abs(c - targetMetres) < Math.abs(best - targetMetres) ? c : best, candidates[0]);
  const scalePx = chosen / metresPerPx;
  const scaleX = 14, scaleY = height - 16;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(scaleX - 4, scaleY - 12, scalePx + 8, 18);
  ctx.fillStyle = "#21503a";
  ctx.fillRect(scaleX, scaleY, scalePx, 4);
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillText(chosen >= 1000 ? `${(chosen / 1000).toFixed(chosen % 1000 === 0 ? 0 : 1)} km` : `${chosen} m`, scaleX, scaleY - 2);

  // Legend
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(width - 132, 8, 124, 50);
  ctx.strokeStyle = "#21503a"; ctx.lineWidth = 1;
  ctx.strokeRect(width - 132, 8, 124, 50);
  ctx.fillStyle = "#21503a"; ctx.font = "bold 9px sans-serif";
  ctx.fillText("Survey Route", width - 124, 22);
  ctx.fillStyle = "#16a34a"; ctx.beginPath(); ctx.arc(width - 122, 32, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#374151"; ctx.font = "9px sans-serif";
  ctx.fillText("Start", width - 114, 35);
  ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.arc(width - 80, 32, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#374151"; ctx.fillText("End", width - 72, 35);
  ctx.fillStyle = "#0284c7"; ctx.beginPath(); ctx.arc(width - 122, 48, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#374151"; ctx.fillText("Photo", width - 114, 51);

  return canvas.toDataURL("image/png");
}

// ── Year-on-year comparison panel ────────────────────────────────────────────

const SCORE_NUMERIC: Record<string, number> = { N: 0, L: 1, M: 2, H: 3 };

function avgScore(items: Assessment[], key: keyof Assessment): number | null {
  const vals = items
    .map(a => SCORE_NUMERIC[a[key] as string])
    .filter(v => typeof v === "number");
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function fmtScore(v: number | null): string {
  if (v == null) return "—";
  if (v < 0.5) return "None";
  if (v < 1.5) return "Low";
  if (v < 2.5) return "Mod";
  return "High";
}

function YearOnYearPanel({ current, prior, currentSeason }: { current: Assessment[]; prior: Assessment[]; currentSeason: number }) {
  const metrics: { label: string; key: keyof Assessment }[] = [
    { label: "Activity",       key: "activitySummary" },
    { label: "Impact",         key: "impactSummary" },
    { label: "Bark removal",   key: "barkRemovalScore" },
    { label: "Fraying",        key: "frayingScore" },
    { label: "Bark stripping", key: "barkStrippingScore" },
    { label: "Broken stems",   key: "brokenStemsScore" },
  ];

  const rows = metrics.map(m => {
    const c = avgScore(current, m.key);
    const p = avgScore(prior, m.key);
    const delta = c != null && p != null ? c - p : null;
    return { ...m, c, p, delta };
  });

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center gap-2">
        <BarChart3 className="w-3.5 h-3.5 text-primary" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-foreground">
          {formatSeasonLabel(currentSeason)} vs {formatSeasonLabel(currentSeason - 1)}
        </p>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {current.length} / {prior.length} surveys
        </span>
      </div>
      {prior.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted-foreground italic">No prior-season assessments to compare.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-1.5 font-semibold">Metric</th>
              <th className="text-center px-2 py-1.5 font-semibold">Prior</th>
              <th className="text-center px-2 py-1.5 font-semibold">Current</th>
              <th className="text-center px-3 py-1.5 font-semibold">Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const trend = r.delta == null ? null : r.delta > 0.25 ? "worse" : r.delta < -0.25 ? "better" : "level";
              return (
                <tr key={r.label} className="border-t border-border">
                  <td className="px-3 py-1.5 text-foreground">{r.label}</td>
                  <td className="px-2 py-1.5 text-center text-muted-foreground tabular-nums">{fmtScore(r.p)}</td>
                  <td className="px-2 py-1.5 text-center font-semibold text-foreground tabular-nums">{fmtScore(r.c)}</td>
                  <td className="px-3 py-1.5 text-center">
                    {trend === "worse" && <span className="inline-flex items-center gap-0.5 text-red-600 font-bold"><TrendingUp className="w-3 h-3" />{r.delta!.toFixed(1)}</span>}
                    {trend === "better" && <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold"><TrendingDown className="w-3 h-3" />{r.delta!.toFixed(1)}</span>}
                    {trend === "level" && <span className="inline-flex items-center gap-0.5 text-muted-foreground"><Minus className="w-3 h-3" /></span>}
                    {trend == null && <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AssessmentDetail({ assessment: a, onBack, onEdit, onDelete }: { assessment: Assessment; onBack: () => void; onEdit: () => void; onDelete: () => void }) {
  const [exporting, setExporting] = useState(false);

  const blockLabel = a.woodlandBlock ? (WOODLAND_BLOCKS[a.woodlandBlock as keyof typeof WOODLAND_BLOCKS] ?? a.woodlandBlock) : "Unknown";
  const dateStr = new Date(a.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  async function exportPdf() {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = 14;

      const heading = (text: string, size = 11) => {
        doc.setFontSize(size).setFont("helvetica", "bold").setTextColor(33, 80, 58);
        doc.text(text, margin, y);
        y += size * 0.45 + 1;
        doc.setDrawColor(33, 80, 58).setLineWidth(0.4).line(margin, y, pageW - margin, y);
        y += 4;
        doc.setTextColor(0, 0, 0);
      };

      const row = (label: string, value: string) => {
        doc.setFontSize(8.5).setFont("helvetica", "bold").setTextColor(80, 80, 80);
        doc.text(label, margin, y);
        doc.setFont("helvetica", "normal").setTextColor(0, 0, 0);
        doc.text(value || "—", margin + 52, y, { maxWidth: pageW - margin - 52 - margin });
        y += 6;
      };

      const checkPage = (needed = 20) => {
        if (y + needed > doc.internal.pageSize.getHeight() - 14) {
          doc.addPage();
          y = 14;
        }
      };

      doc.setFontSize(16).setFont("helvetica", "bold").setTextColor(33, 80, 58);
      doc.text("WS1 Deer Habitat Impact Assessment", margin, y);
      y += 8;

      doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(100, 100, 100);
      doc.text("Countryside Stewardship Higher Tier — Wildlife Management", margin, y);
      y += 10;

      heading("Site Information");
      row("Woodland Block:", blockLabel);
      row("Date:", dateStr);
      row("Recorder:", a.recorder ?? "");
      row("SBI Number:", a.sbiNumber ?? "");
      row("Weather:", a.weather ? (WEATHER_CONDITIONS[a.weather as keyof typeof WEATHER_CONDITIONS] ?? a.weather) : "");
      if (a.startedAt) row("Survey started:", new Date(a.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
      if (a.endedAt) row("Survey ended:", new Date(a.endedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
      if (a.durationMinutes) row("Survey duration:", fmtDuration(a.durationMinutes));
      row("Distance Walked:", a.distanceWalked ? `${a.distanceWalked}m` : "");
      y += 2;

      checkPage(30);
      heading("Stand & Habitat");
      row("Stand / Habitat Type:", a.standType ?? "");
      row("Canopy Cover:", a.canopyCover ?? "");
      row("Main Species:", a.mainSpeciesInStand ?? "");
      row("Ground Vegetation:", a.groundVegetation ?? "");
      row("Veg. without deer:", a.vegWithoutDeer ?? "");
      y += 2;

      checkPage(20);
      heading("Deer & Species Context");
      row("Deer / browsers present:", a.deerPresent ?? "");
      row("Species assessed:", a.speciesAssessed ?? "");
      row("Species causing impact:", a.speciesCausingImpact ?? "");
      y += 2;

      checkPage(50);
      const tc = (a.tallyCounts ?? {}) as Partial<TallyCounts>;
      const aDist = typeof a.distanceWalked === "number" ? a.distanceWalked : 0;
      const tallyCell = (count: number | undefined, score: string | null | undefined, mMin: number, hMin: number) => {
        const s = score ?? (count != null ? scorePerKm(count, aDist, mMin, hMin) : null);
        const sLabel = s ? scoreLabel(s) : "—";
        if (count == null) return sLabel;
        const rate = aDist >= 50 ? `  ${fmtRate(count, aDist)}` : "";
        return `${sLabel}  (count: ${count}${rate})`;
      };

      heading("Activity Indicators");
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["Indicator", "Score (count · /km)"]],
        body: [
          ["Deer seen",        tallyCell(tc.deerSeen,    a.deerSeenScore,  3, 6)],
          ["Dung piles",       tallyCell(tc.dung,        null,             5, 10)],
          ["Couches",          tallyCell(tc.couches,     a.couchesScore,   2, 4)],
          ["Scrapes",          tallyCell(tc.scrapes,     a.scrapesScore,   2, 4)],
          ["Wallows",          tallyCell(tc.wallows,     a.wallowsScore,   2, 3)],
          ["Racks — in wood",  a.racksInWoodScore ? (a.racksInWoodScore.charAt(0).toUpperCase() + a.racksInWoodScore.slice(1)) : "—"],
          ["Racks — at edge",  a.racksEdgeScore ? (a.racksEdgeScore.charAt(0).toUpperCase() + a.racksEdgeScore.slice(1)) : "—"],
        ],
        headStyles: { fillColor: [33, 80, 58], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        styles: { cellPadding: 2 },
      });
      y = (doc.lastAutoTable?.finalY ?? y) + 6;

      checkPage(70);
      heading("Impact Scores");
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["Impact", "Score (count · /km)"]],
        body: [
          ["Bark removal / breakage", tallyCell(tc.barkRemoval,   a.barkRemovalScore,   3, 6)],
          ["Fraying / thrashing",     tallyCell(tc.fraying,       a.frayingScore,       3, 6)],
          ["Bark stripping",          tallyCell(tc.barkStripping, a.barkStrippingScore, 3, 6)],
          ["Broken stems",            tallyCell(tc.brokenStems,   a.brokenStemsScore,   3, 6)],
          ["Browseline", findLabel(BROWSELINE_OPTIONS, a.browselineScore)],
          ["Browsing — Coppice <2m", findLabel(COPPICE_OPTIONS, a.browsingCoppiceScore)],
          ["Browsing — Live basal shoots", findLabel(BASAL_OPTIONS, a.browsingBasalScore)],
          ["Browsing — Tree seedlings/saplings", findLabel(SAPLINGS_OPTIONS, a.browsingSaplingsScore)],
          ["Browsing — Bramble", findLabel(BRAMBLE_OPTIONS, a.browsingBrambleScore)],
        ],
        headStyles: { fillColor: [33, 80, 58], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        styles: { cellPadding: 2 },
      });
      y = (doc.lastAutoTable?.finalY ?? y) + 6;

      const flora = (a.grazingFlora as GrazingEntry[] | null)?.filter(g => g.species);
      if (flora?.length) {
        checkPage(30);
        heading("Grazing Flora");
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["Plant Species", "Impact"]],
          body: flora.map(g => [g.species, scoreLabel(g.impact)]),
          headStyles: { fillColor: [33, 80, 58], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          styles: { cellPadding: 2 },
        });
        y = (doc.lastAutoTable?.finalY ?? y) + 6;
      }

      checkPage(30);
      heading("Summary & Trends");
      row("Overall Activity:", scoreLabel(a.activitySummary));
      row("Overall Impact:", scoreLabel(a.impactSummary));
      row("Activity Trend:", trendLabel(a.activityTrend));
      row("Impact Trend:", trendLabel(a.impactTrend));
      if (a.trendNotes) { row("Trend Notes:", a.trendNotes); }
      if (a.comments) {
        y += 2;
        row("Comments:", a.comments);
      }
      y += 4;

      // ── Static survey route map (rendered from gpsRoute + photo positions) ──
      const route = (a.gpsRoute as GpsPoint[] | null) ?? [];
      const photos = a.photos as { dataUrl: string; caption: string; lat?: number; lng?: number; takenAt?: number }[] | null;
      const photoPoints = (photos ?? []).filter(p => p.lat != null && p.lng != null) as { lat: number; lng: number }[];
      const allPts = [...route.map(r => ({ lat: r.lat, lng: r.lng })), ...photoPoints];
      if (allPts.length > 0) {
        doc.addPage();
        y = 14;
        heading("Survey Route");
        try {
          const mapDataUrl = await renderRouteMap(route, photoPoints, 800, 480);
          if (mapDataUrl) {
            const imgW = pageW - margin * 2;
            const imgH = imgW * 0.6;
            doc.addImage(mapDataUrl, "PNG", margin, y, imgW, imgH);
            y += imgH + 3;
            doc.setFontSize(7.5).setFont("helvetica", "italic").setTextColor(80, 80, 80);
            doc.text(
              `${route.length} GPS point${route.length !== 1 ? "s" : ""} · ${photoPoints.length} geotagged photo${photoPoints.length !== 1 ? "s" : ""}`,
              margin, y
            );
            y += 6;
          }
        } catch { /* skip if rendering fails */ }
      }

      // ── Photographic evidence — 2x2 grid per page ─────────────────────────
      if (photos?.length) {
        doc.addPage();
        y = 14;
        heading("Photographic Evidence");

        const gap = 4;
        const cellW = (pageW - margin * 2 - gap) / 2;
        const cellImgH = 60;
        const cellMetaH = 14;
        const cellH = cellImgH + cellMetaH;

        for (let pi = 0; pi < photos.length; pi += 4) {
          if (pi > 0) {
            doc.addPage();
            y = 14;
            heading("Photographic Evidence (cont.)");
          }
          const pageStartY = y;
          for (let q = 0; q < 4 && pi + q < photos.length; q++) {
            const photo = photos[pi + q];
            const col = q % 2;
            const rowI = Math.floor(q / 2);
            const x = margin + col * (cellW + gap);
            const yPos = pageStartY + rowI * (cellH + gap);
            try {
              doc.addImage(photo.dataUrl, "JPEG", x, yPos, cellW, cellImgH);
              const metaParts: string[] = [];
              if (photo.caption) metaParts.push(photo.caption);
              if (photo.lat != null && photo.lng != null) {
                metaParts.push(`GPS ${photo.lat.toFixed(5)}, ${photo.lng.toFixed(5)}`);
              }
              if (photo.takenAt) {
                metaParts.push(new Date(photo.takenAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }));
              }
              if (metaParts.length) {
                doc.setFontSize(7).setFont("helvetica", "italic").setTextColor(80, 80, 80);
                const lines = doc.splitTextToSize(metaParts.join(" · "), cellW);
                doc.text(lines.slice(0, 2), x, yPos + cellImgH + 4);
              }
              // Photo index badge
              doc.setFillColor(33, 80, 58);
              doc.circle(x + 4, yPos + 4, 3, "F");
              doc.setFontSize(7).setFont("helvetica", "bold").setTextColor(255, 255, 255);
              doc.text(String(pi + q + 1), x + 4, yPos + 5.4, { align: "center" });
              doc.setTextColor(0, 0, 0);
            } catch { /* skip invalid image */ }
          }
          y = pageStartY + 2 * (cellH + gap);
        }
      }

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7).setFont("helvetica", "normal").setTextColor(150, 150, 150);
        doc.text(`Deer Cull Records — ${blockLabel} — ${dateStr}  |  Page ${i} of ${pageCount}`, margin, doc.internal.pageSize.getHeight() - 7);
      }

      doc.save(`WS1_${blockLabel.replace(/\s/g, "_")}_${a.date.slice(0, 10)}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
    if (!value && value !== 0) return null;
    return (
      <div className="flex gap-3 py-2 border-b border-border last:border-0">
        <span className="text-xs text-muted-foreground w-32 shrink-0 font-medium">{label}</span>
        <span className="text-xs text-foreground flex-1">{String(value)}</span>
      </div>
    );
  }

  function ScoreBadge({ value }: { value?: string | null }) {
    if (!value) return <span className="text-xs text-muted-foreground">—</span>;
    return (
      <span className={cn(
        "text-xs font-bold px-2 py-0.5 rounded",
        value === "H" ? "bg-red-100 text-red-700" :
        value === "M" ? "bg-amber-100 text-amber-700" :
        value === "L" ? "bg-emerald-100 text-emerald-700" :
        "bg-muted text-muted-foreground"
      )}>
        {scoreLabel(value)}
      </span>
    );
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    const [open, setOpen] = useState(true);
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 text-sm font-semibold text-foreground">
          {title}
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        {open && <div className="px-4 pb-3 pt-1 bg-card">{children}</div>}
      </div>
    );
  }

  const flora = (a.grazingFlora as GrazingEntry[] | null)?.filter(g => g.species) ?? [];

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="sticky top-0 bg-card border-b border-border z-10 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 -ml-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/40">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-foreground truncate">{blockLabel}</h2>
          <p className="text-xs text-muted-foreground">{dateStr}</p>
        </div>
        <button
          onClick={exportPdf}
          disabled={exporting}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
          Export PDF
        </button>
        <button
          onClick={onEdit}
          title="Edit assessment"
          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={onDelete} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3 pb-8">
        <Section title="Site Information">
          <DetailRow label="Woodland Block" value={blockLabel} />
          <DetailRow label="Date" value={dateStr} />
          <DetailRow label="Recorder" value={a.recorder} />
          <DetailRow label="SBI Number" value={a.sbiNumber} />
          <DetailRow label="Weather" value={a.weather ? (WEATHER_CONDITIONS[a.weather as keyof typeof WEATHER_CONDITIONS] ?? a.weather) : null} />
          <DetailRow
            label="Survey started"
            value={a.startedAt ? new Date(a.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null}
          />
          <DetailRow
            label="Survey ended"
            value={a.endedAt ? new Date(a.endedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null}
          />
          <DetailRow label="Survey duration" value={a.durationMinutes ? fmtDuration(a.durationMinutes) : null} />
          <DetailRow label="Distance Walked" value={a.distanceWalked ? `${a.distanceWalked}m` : null} />
          <DetailRow label="GPS Waypoints" value={(a.gpsRoute as GpsPoint[] | null)?.length} />
        </Section>

        <Section title="Stand & Habitat">
          <DetailRow label="Stand Type" value={a.standType} />
          <DetailRow label="Canopy Cover" value={a.canopyCover} />
          <DetailRow label="Main Species" value={a.mainSpeciesInStand} />
          <DetailRow label="Ground Veg." value={a.groundVegetation} />
          <DetailRow label="Veg. without deer" value={a.vegWithoutDeer} />
        </Section>

        <Section title="Deer Context">
          <DetailRow label="Deer present" value={a.deerPresent} />
          <DetailRow label="Species assessed" value={a.speciesAssessed} />
          <DetailRow label="Species impact" value={a.speciesCausingImpact} />
        </Section>

        <Section title="Activity Indicators">
          <div className="space-y-0">
            {[
              ["Deer seen", a.deerSeenScore],
              ["Dung (tally)", a.dungTally != null ? String(a.dungTally) : null],
              ["Couches", a.couchesScore],
              ["Scrapes", a.scrapesScore],
              ["Wallows", a.wallowsScore],
              ["Racks — in wood", a.racksInWoodScore],
              ["Racks — at edge", a.racksEdgeScore],
            ].map(([label, val]) => (
              <div key={label as string} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-xs text-muted-foreground">{label}</span>
                <ScoreBadge value={val as string | null} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Impact Scores">
          <div className="space-y-0">
            {[
              ["Bark removal", a.barkRemovalScore],
              ["Fraying", a.frayingScore],
              ["Bark stripping", a.barkStrippingScore],
              ["Broken stems", a.brokenStemsScore],
            ].map(([label, val]) => (
              <div key={label as string} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-xs text-muted-foreground">{label}</span>
                <ScoreBadge value={val as string | null} />
              </div>
            ))}
            {[
              ["Browseline", findLabel(BROWSELINE_OPTIONS, a.browselineScore)],
              ["Coppice <2m", findLabel(COPPICE_OPTIONS, a.browsingCoppiceScore)],
              ["Basal shoots", findLabel(BASAL_OPTIONS, a.browsingBasalScore)],
              ["Tree saplings", findLabel(SAPLINGS_OPTIONS, a.browsingSaplingsScore)],
              ["Bramble", findLabel(BRAMBLE_OPTIONS, a.browsingBrambleScore)],
            ].filter(([, v]) => v !== "—").map(([label, val]) => (
              <div key={label as string} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
                <span className="text-xs text-foreground">{val}</span>
              </div>
            ))}
          </div>
        </Section>

        {flora.length > 0 && (
          <Section title="Grazing Flora">
            <div className="space-y-0">
              {flora.map((g, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-xs text-muted-foreground">{g.species}</span>
                  <ScoreBadge value={g.impact} />
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="Summary & Trends">
          <div className="flex gap-4 mb-3">
            <div className="flex-1 text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Activity</p>
              <ScoreBadge value={a.activitySummary} />
              {a.activityTrend && <p className="text-xs text-muted-foreground mt-1">{trendLabel(a.activityTrend)}</p>}
            </div>
            <div className="flex-1 text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Impact</p>
              <ScoreBadge value={a.impactSummary} />
              {a.impactTrend && <p className="text-xs text-muted-foreground mt-1">{trendLabel(a.impactTrend)}</p>}
            </div>
          </div>
          {a.trendNotes && <DetailRow label="Trend notes" value={a.trendNotes} />}
          {a.comments && <DetailRow label="Comments" value={a.comments} />}
        </Section>

        {(a.photos as { dataUrl: string; caption: string; lat?: number; lng?: number; takenAt?: number }[] | null)?.length ? (
          <Section title={`Photos (${(a.photos as unknown[]).length})`}>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {(a.photos as { dataUrl: string; caption: string; lat?: number; lng?: number; takenAt?: number }[]).map((p, i) => (
                <div key={i} className="rounded-md overflow-hidden border border-border">
                  <img src={p.dataUrl} alt={p.caption || `Photo ${i + 1}`} className="w-full aspect-square object-cover" />
                  {(p.caption || (p.lat != null && p.lng != null)) && (
                    <div className="px-2 py-1 space-y-0.5">
                      {p.caption && <p className="text-[10px] text-muted-foreground truncate">{p.caption}</p>}
                      {p.lat != null && p.lng != null && (
                        <p className="text-[9px] text-primary/70 font-mono truncate flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 inline shrink-0" />
                          {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </div>
  );
}

declare module "jspdf" {
  interface jsPDF {
    lastAutoTable?: { finalY: number };
  }
}
