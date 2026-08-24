import React, { useState, useEffect, useRef } from "react";
import {
  Timer, Play, Square, Plus, Trash2, ChevronDown,
  Clock, TreePine, CloudSun, Pencil, Check, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WOODLAND_BLOCKS, WOODLAND_BLOCK_LIST, WEATHER_CONDITIONS,
  formatSeasonLabel, getAvailableSeasons, getCurrentSeasonYear,
  type WoodlandBlock, type WeatherCondition,
} from "@/lib/constants";
import {
  useSessions, useCreateSession, useUpdateSession, useDeleteSession,
} from "@/hooks/use-api";
import { useStalkers } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import type { StalkingSession } from "@/lib/schemas";

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function elapsedMinutes(startedAt: string): number {
  return Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
}

function fmtDateDisplay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtTimeDisplay(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

type Mode = "timer" | "retrospective";

interface StartTimerFormProps {
  onStart: (woodlandBlock: WoodlandBlock, weather: WeatherCondition | "", notes: string) => Promise<void>;
  loading: boolean;
}

function StartTimerForm({ onStart, loading }: StartTimerFormProps) {
  const [block, setBlock] = useState<WoodlandBlock | "">("");
  const [weather, setWeather] = useState<WeatherCondition | "">("");
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Woodland Block</label>
        <select
          value={block}
          onChange={e => setBlock(e.target.value as WoodlandBlock | "")}
          className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">— Select block —</option>
          {WOODLAND_BLOCK_LIST.map(b => <option key={b} value={b}>{WOODLAND_BLOCKS[b]}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Weather (optional)</label>
        <select
          value={weather}
          onChange={e => setWeather(e.target.value as WeatherCondition | "")}
          className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">— Select weather —</option>
          {Object.entries(WEATHER_CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="E.g. conditions, sightings…"
          rows={2}
          className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <button
        onClick={() => block && onStart(block, weather, notes)}
        disabled={!block || loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-md bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
      >
        <Play className="w-4 h-4 fill-current" />
        Start Timer
      </button>
    </div>
  );
}

interface RetroFormProps {
  onSave: (data: {
    woodlandBlock: WoodlandBlock;
    startedAt: string;
    durationMinutes: number;
    weather: WeatherCondition | "";
    notes: string;
  }) => Promise<void>;
  loading: boolean;
}

function RetrospectiveForm({ onSave, loading }: RetroFormProps) {
  const [block, setBlock]   = useState<WoodlandBlock | "">("");
  const [date, setDate]     = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("07:00");
  const [durationH, setDurationH] = useState("2");
  const [durationM, setDurationM] = useState("0");
  const [weather, setWeather] = useState<WeatherCondition | "">("");
  const [notes, setNotes]   = useState("");

  const handleSave = async () => {
    if (!block) return;
    const totalMinutes = (parseInt(durationH) || 0) * 60 + (parseInt(durationM) || 0);
    if (totalMinutes === 0) return;
    const startedAt = new Date(`${date}T${startTime}:00`).toISOString();
    const endedAt   = new Date(new Date(`${date}T${startTime}:00`).getTime() + totalMinutes * 60000).toISOString();
    await onSave({ woodlandBlock: block, startedAt, durationMinutes: totalMinutes, weather, notes });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Woodland Block</label>
        <select
          value={block}
          onChange={e => setBlock(e.target.value as WoodlandBlock | "")}
          className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">— Select block —</option>
          {WOODLAND_BLOCK_LIST.map(b => <option key={b} value={b}>{WOODLAND_BLOCKS[b]}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Start time</label>
          <input
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Duration</label>
        <div className="flex items-center gap-2">
          <input
            type="number" min="0" max="12" value={durationH}
            onChange={e => setDurationH(e.target.value)}
            className="w-24 px-3 py-2.5 bg-background border border-border rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="text-sm text-muted-foreground">hrs</span>
          <input
            type="number" min="0" max="59" value={durationM}
            onChange={e => setDurationM(e.target.value)}
            className="w-24 px-3 py-2.5 bg-background border border-border rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="text-sm text-muted-foreground">min</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Weather (optional)</label>
        <select
          value={weather}
          onChange={e => setWeather(e.target.value as WeatherCondition | "")}
          className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">— Select weather —</option>
          {Object.entries(WEATHER_CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="E.g. conditions, sightings…"
          rows={2}
          className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={!block || loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-md bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
      >
        <Check className="w-4 h-4" />
        Save Session
      </button>
    </div>
  );
}

interface ActiveSessionBannerProps {
  session: StalkingSession;
  onEnd: () => Promise<void>;
  loading: boolean;
}

function ActiveSessionBanner({ session, onEnd, loading }: ActiveSessionBannerProps) {
  const [elapsed, setElapsed] = useState(() => elapsedMinutes(session.startedAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(elapsedMinutes(session.startedAt));
    }, 60000);
    return () => clearInterval(interval);
  }, [session.startedAt]);

  return (
    <div className="rounded-xl border-2 border-primary bg-primary/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
            <Timer className="w-5 h-5 text-primary animate-pulse" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">
              Session active — {WOODLAND_BLOCKS[session.woodlandBlock as WoodlandBlock] ?? session.woodlandBlock}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Started {fmtTimeDisplay(session.startedAt)} · {formatDuration(elapsed)} elapsed
            </p>
          </div>
        </div>
        <button
          onClick={onEnd}
          disabled={loading}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 disabled:opacity-50 transition-colors"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          End
        </button>
      </div>
    </div>
  );
}

function SessionRow({ session, onDelete, isAdmin }: {
  session: StalkingSession;
  onDelete: (id: number) => void;
  isAdmin: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const blockLabel = WOODLAND_BLOCKS[session.woodlandBlock as WoodlandBlock] ?? session.woodlandBlock;
  const weatherLabel = session.weather
    ? WEATHER_CONDITIONS[session.weather as WeatherCondition] ?? session.weather
    : null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <TreePine className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-semibold text-sm text-foreground">{blockLabel}</span>
          </div>
          <div className="flex items-center gap-3 ml-[22px]">
            <span className="text-xs text-muted-foreground">
              {fmtDateDisplay(session.startedAt)}
            </span>
            <span className="text-xs text-muted-foreground">
              {fmtTimeDisplay(session.startedAt)}
              {session.endedAt && ` – ${fmtTimeDisplay(session.endedAt)}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="font-semibold text-sm tabular-nums">{formatDuration(session.durationMinutes)}</span>
          </div>
          {isAdmin && (
            confirming
              ? (
                <div className="flex gap-1">
                  <button
                    onClick={() => onDelete(session.id)}
                    className="p-1.5 rounded text-destructive-foreground bg-destructive hover:bg-destructive/80 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    className="p-1.5 rounded text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
              : (
                <button
                  onClick={() => setConfirming(true)}
                  className="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )
          )}
        </div>
      </div>
      {(weatherLabel || session.stalkerName || session.notes) && (
        <div className="ml-[22px] flex flex-wrap gap-x-3 gap-y-1">
          {session.stalkerName && (
            <span className="text-xs text-muted-foreground">{session.stalkerName}</span>
          )}
          {weatherLabel && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CloudSun className="w-3 h-3" /> {weatherLabel}
            </span>
          )}
          {session.notes && (
            <span className="text-xs text-muted-foreground italic">{session.notes}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function SessionsPage() {
  const { stalker } = useAuth();
  const isAdmin = stalker?.isAdmin ?? false;

  const [season, setSeason] = useState<number>(getCurrentSeasonYear());
  const [filterStalkerId, setFilterStalkerId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("timer");
  const [showNewForm, setShowNewForm] = useState(false);

  const { data: sessions = [], isLoading } = useSessions({
    season,
    stalkerId: isAdmin ? filterStalkerId : (stalker?.id ?? null),
  });

  const { data: stalkers = [] } = useStalkers();
  const createSession = useCreateSession();
  const updateSession = useUpdateSession();
  const deleteSession = useDeleteSession();

  const activeSession = sessions.find(s => s.isActive);

  const myActiveSession = sessions.find(s => s.isActive && s.stalkerId === stalker?.id);

  const totalMinutes = sessions
    .filter(s => !s.isActive)
    .reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

  const blockTotals: Record<string, number> = {};
  sessions.filter(s => !s.isActive).forEach(s => {
    blockTotals[s.woodlandBlock] = (blockTotals[s.woodlandBlock] ?? 0) + (s.durationMinutes ?? 0);
  });

  const handleStartTimer = async (
    woodlandBlock: WoodlandBlock,
    weather: WeatherCondition | "",
    notes: string,
  ) => {
    await createSession.mutateAsync({
      stalkerId: stalker?.id ?? undefined,
      woodlandBlock,
      startedAt: new Date().toISOString(),
      weather: weather || undefined,
      notes: notes || undefined,
      isActive: true,
    } as any);
    setShowNewForm(false);
  };

  const handleEndTimer = async () => {
    if (!myActiveSession) return;
    const endedAt = new Date().toISOString();
    const duration = elapsedMinutes(myActiveSession.startedAt);
    await updateSession.mutateAsync({
      id: myActiveSession.id,
      data: {
        endedAt,
        durationMinutes: duration,
        isActive: false,
      },
    });
  };

  const handleSaveRetro = async (data: {
    woodlandBlock: WoodlandBlock;
    startedAt: string;
    durationMinutes: number;
    weather: WeatherCondition | "";
    notes: string;
  }) => {
    const startDate = new Date(data.startedAt);
    const endDate = new Date(startDate.getTime() + data.durationMinutes * 60000);
    await createSession.mutateAsync({
      stalkerId: stalker?.id ?? undefined,
      woodlandBlock: data.woodlandBlock,
      startedAt: data.startedAt,
      endedAt: endDate.toISOString(),
      durationMinutes: data.durationMinutes,
      weather: data.weather || undefined,
      notes: data.notes || undefined,
      isActive: false,
    } as any);
    setShowNewForm(false);
  };

  const handleDelete = async (id: number) => {
    await deleteSession.mutateAsync(id);
  };

  const seasons = getAvailableSeasons();

  const showStalkerFilter = isAdmin;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-5 pt-5 pb-4 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-foreground">Stalking Sessions</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Countryside Stewardship time evidence
            </p>
          </div>
          {!myActiveSession && (
            <button
              onClick={() => setShowNewForm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Log
            </button>
          )}
        </div>

        {/* Season filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-muted rounded-md p-0.5">
            {seasons.slice(0, 5).map(y => (
              <button
                key={y}
                onClick={() => setSeason(y)}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-semibold transition-colors",
                  season === y
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {formatSeasonLabel(y)}
              </button>
            ))}
          </div>

          {showStalkerFilter && (
            <select
              value={filterStalkerId ?? ""}
              onChange={e => setFilterStalkerId(e.target.value ? parseInt(e.target.value) : null)}
              className="px-2.5 py-1.5 bg-muted border-0 rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All stalkers</option>
              {stalkers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Active session banner */}
        {myActiveSession && (
          <ActiveSessionBanner
            session={myActiveSession}
            onEnd={handleEndTimer}
            loading={updateSession.isPending}
          />
        )}

        {/* New session form */}
        {showNewForm && !myActiveSession && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm text-foreground">New Session</h2>
              <button
                onClick={() => setShowNewForm(false)}
                className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode toggle */}
            <div className="flex bg-muted rounded-md p-0.5">
              {(["timer", "retrospective"] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex-1 py-1.5 rounded text-xs font-semibold transition-colors",
                    mode === m
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "timer" ? "⏱ Start timer" : "📋 Enter manually"}
                </button>
              ))}
            </div>

            {mode === "timer"
              ? <StartTimerForm onStart={handleStartTimer} loading={createSession.isPending} />
              : <RetrospectiveForm onSave={handleSaveRetro} loading={createSession.isPending} />
            }
          </div>
        )}

        {/* Summary stats */}
        {sessions.filter(s => !s.isActive).length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {formatDuration(totalMinutes)}
              </p>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mt-1">
                Total {formatSeasonLabel(season)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {sessions.filter(s => !s.isActive).length}
              </p>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mt-1">
                Sessions
              </p>
            </div>
          </div>
        )}

        {/* Per-block breakdown */}
        {Object.keys(blockTotals).length > 1 && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">By woodland block</p>
            <div className="space-y-1.5">
              {Object.entries(blockTotals)
                .sort((a, b) => b[1] - a[1])
                .map(([block, mins]) => {
                  const pct = totalMinutes > 0 ? Math.round((mins / totalMinutes) * 100) : 0;
                  return (
                    <div key={block} className="flex items-center gap-2">
                      <span className="text-xs text-foreground w-36 shrink-0 truncate">
                        {WOODLAND_BLOCKS[block as WoodlandBlock] ?? block}
                      </span>
                      <div className="flex-1 bg-muted rounded-full h-1.5">
                        <div
                          className="bg-primary rounded-full h-1.5 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground tabular-nums w-12 text-right">
                        {formatDuration(mins)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Sessions list */}
        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Loading sessions…</div>
        ) : sessions.filter(s => !s.isActive).length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <Timer className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">No sessions recorded for {formatSeasonLabel(season)}</p>
            <p className="text-xs text-muted-foreground/60">Use "Log" above to start tracking time</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              Sessions — {formatSeasonLabel(season)}
            </p>
            {sessions
              .filter(s => !s.isActive)
              .map(s => (
                <SessionRow
                  key={s.id}
                  session={s}
                  onDelete={handleDelete}
                  isAdmin={isAdmin}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
