import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, FileDown, Loader2, RefreshCcw, ChevronDown, X, AlertCircle, Map as MapIcon, RefreshCw, Target } from "lucide-react";
import { useCulls, useStalkers, useDeleteCull, useUpdateCull, usePendingCulls, useSessions, useCullPlans } from "@/hooks/use-api";
import {
  SPECIES_LABELS,
  SEX_LABELS,
  CONDITION_LABELS,
  WOODLAND_BLOCKS,
  getCurrentSeasonYear,
  formatSeasonLabel,
  getAvailableSeasons,
  getCurrentPlanYear,
  formatPlanYearLabel,
  getAvailablePlanYears,
  isInPlanYear,
  getMarkerColor,
  type Species,
  type Sex,
} from "@/lib/constants";
import { formatDate, formatTime, cn } from "@/lib/utils";
import { generatePDF } from "@/lib/pdf";
import { generateMapHTML } from "@/lib/mapExport";
import { CullDetailSheet } from "@/components/CullDetailSheet";
import { CullForm } from "@/components/CullForm";
import type { CullRecord, PendingCullRecord, CullPlan } from "@/lib/schemas";

const SEASONS = getAvailableSeasons();
const PLAN_YEARS = getAvailablePlanYears();

const CONDITION_STYLES: Record<string, string> = {
  excellent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  good:      "bg-sky-50 text-sky-700 border-sky-200",
  fair:      "bg-amber-50 text-amber-700 border-amber-200",
  poor:      "bg-red-50 text-red-700 border-red-200",
};

export default function RecordsPage() {
  const [season, setSeason] = useState<number | null>(getCurrentSeasonYear());
  const [planYear, setPlanYear] = useState<number>(getCurrentPlanYear());
  const [stalkerId, setStalkerId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const { data: stalkers = [] } = useStalkers();
  const { data: culls = [], isLoading, refetch, isFetching } = useCulls({ season, stalkerId });
  // Estate-wide culls across all stalkers, used for target progress below.
  const { data: allCulls = [] } = useCulls({});
  const { data: pendingCulls = [] } = usePendingCulls();
  const { data: sessions = [] } = useSessions({ season, stalkerId });
  const { data: cullPlans = [] } = useCullPlans(planYear);
  const deleteMutation = useDeleteCull();
  const updateMutation = useUpdateCull();

  const [showPlans, setShowPlans] = useState(false);

  const [selectedCull, setSelectedCull] = useState<CullRecord | null>(null);
  const [editingCull, setEditingCull] = useState<CullRecord | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Close export menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Per-stalker / per-block summary stats (computed from currently-loaded culls).
  const summaryStats = useMemo(() => {
    if (culls.length === 0) return null;
    const byStalker = new Map<string, number>();
    const byBlock = new Map<string, number>();
    let weightTotal = 0;
    let weightCount = 0;
    for (const c of culls) {
      const sName = c.stalkerName || "Unassigned";
      byStalker.set(sName, (byStalker.get(sName) ?? 0) + 1);
      const bName = c.woodlandBlock
        ? (WOODLAND_BLOCKS as Record<string, string>)[c.woodlandBlock] ?? c.woodlandBlock
        : "Unspecified";
      byBlock.set(bName, (byBlock.get(bName) ?? 0) + 1);
      if (typeof c.weight === "number") { weightTotal += c.weight; weightCount += 1; }
    }
    return {
      total: culls.length,
      avgWeight: weightCount > 0 ? weightTotal / weightCount : null,
      topStalker: [...byStalker.entries()].sort((a, b) => b[1] - a[1])[0],
      topBlock: [...byBlock.entries()].sort((a, b) => b[1] - a[1])[0],
    };
  }, [culls]);

  // Cull-plan progress: count estate-wide culls inside the May → Apr plan-year
  // window, regardless of any stalker filter on the records list.
  const plansWithProgress = useMemo(() => {
    const planYearCulls = allCulls.filter(c => isInPlanYear(c.culledAt, planYear));
    return cullPlans.map((plan: CullPlan) => {
      const matched = planYearCulls.filter(c => c.species === plan.species && c.sex === plan.sex);
      const actual = matched.length;
      const pct = plan.target > 0 ? Math.min(100, (actual / plan.target) * 100) : 0;
      return { plan, actual, pct };
    });
  }, [cullPlans, allCulls, planYear]);

  const filteredCulls = culls.filter(c => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      SPECIES_LABELS[c.species].toLowerCase().includes(q) ||
      SEX_LABELS[c.sex].toLowerCase().includes(q) ||
      CONDITION_LABELS[c.condition].toLowerCase().includes(q) ||
      (c.stalkerName && c.stalkerName.toLowerCase().includes(q)) ||
      (c.notes && c.notes.toLowerCase().includes(q))
    );
  }).sort((a, b) => new Date(b.culledAt).getTime() - new Date(a.culledAt).getTime());

  const getExportContext = () => {
    const stalker = stalkerId ? stalkers.find(s => s.id === stalkerId) : null;
    return { season, stalker, sessions };
  };

  const handleExportPDF = () => {
    setExportError(null);
    setExportMenuOpen(false);
    setIsExporting(true);
    setTimeout(() => {
      try {
        generatePDF(filteredCulls, getExportContext());
      } catch (e) {
        console.error(e);
        setExportError("Failed to generate PDF. Please try again.");
      } finally {
        setIsExporting(false);
      }
    }, 100);
  };

  const handleExportMap = () => {
    if (filteredCulls.length === 0) return;
    setExportError(null);
    setExportMenuOpen(false);
    setIsExporting(true);
    setTimeout(() => {
      try {
        generateMapHTML(filteredCulls, getExportContext());
      } catch (e) {
        console.error(e);
        setExportError("Failed to generate map. Please try again.");
      } finally {
        setIsExporting(false);
      }
    }, 100);
  };

  const handleFormSubmit = async (data: any) => {
    if (editingCull) {
      await updateMutation.mutateAsync({ id: editingCull.id, data });
      setShowForm(false);
      setEditingCull(null);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteMutation.mutateAsync(id);
    setShowDetail(false);
    setSelectedCull(null);
  };

  const activeFilters = [
    season != null && formatSeasonLabel(season),
    stalkerId && stalkers.find(s => s.id === stalkerId)?.name,
  ].filter(Boolean);

  return (
    <div className="h-full flex flex-col bg-background relative">

      {/* Header */}
      <div className="shrink-0 bg-background border-b border-border shadow-sm z-10">

        {/* Title row */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-display text-foreground leading-none">Cull Records</h2>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              {isFetching
                ? <><Loader2 className="w-3 h-3 animate-spin text-primary" /> Loading…</>
                : <><span className="font-semibold text-foreground">{filteredCulls.length}</span> records{activeFilters.length > 0 && ` · ${activeFilters.join(", ")}`}</>
              }
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              title="Refresh"
              className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <RefreshCcw className={cn("w-4 h-4", isFetching && "animate-spin")} />
            </button>

            {/* Export dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setExportMenuOpen(o => !o)}
                disabled={isExporting || filteredCulls.length === 0}
                className="h-8 pl-3 pr-2 rounded-md flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <FileDown className="w-3.5 h-3.5" />
                }
                Export
                <ChevronDown className={cn("w-3.5 h-3.5 opacity-70 transition-transform", exportMenuOpen && "rotate-180")} />
              </button>

              {exportMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-card border border-border rounded-md shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    onClick={handleExportPDF}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted transition-colors text-left border-b border-border"
                  >
                    <FileDown className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">PDF Report</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Full records table with summary stats</p>
                    </div>
                  </button>
                  <button
                    onClick={handleExportMap}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted transition-colors text-left"
                  >
                    <MapIcon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Interactive Map</p>
                      <p className="text-xs text-muted-foreground mt-0.5">HTML file with markers, heatmap &amp; key</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Export error */}
        {exportError && (
          <div className="mx-4 mb-3 flex items-center gap-2 text-destructive text-xs bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {exportError}
            <button onClick={() => setExportError(null)} className="ml-auto"><X className="w-3 h-3" /></button>
          </div>
        )}

        {/* Search & Filters */}
        <div className="px-4 pb-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search species, stalker, notes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2 bg-card border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            <FilterSelect
              value={season?.toString() || "all"}
              onChange={v => setSeason(v === "all" ? null : parseInt(v))}
              options={[
                { value: "all", label: "All Seasons" },
                ...SEASONS.map(y => ({ value: y.toString(), label: formatSeasonLabel(y) })),
              ]}
            />
            <FilterSelect
              value={stalkerId?.toString() || "all"}
              onChange={v => setStalkerId(v === "all" ? null : parseInt(v))}
              options={[
                { value: "all", label: "All Stalkers" },
                ...stalkers.map(s => ({ value: s.id.toString(), label: s.name })),
              ]}
            />
          </div>
        </div>
      </div>

      {/* Cull Plan progress + summary stats strip */}
      <div className="shrink-0 px-4 py-3 bg-muted/40 border-b border-border space-y-3">

        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPlans(s => !s)}
              className="flex items-center gap-2 text-left"
              aria-expanded={showPlans}
            >
              <Target className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                Cull Plan
              </span>
            </button>
            <select
              value={planYear}
              onChange={e => setPlanYear(parseInt(e.target.value, 10))}
              className="text-[11px] font-medium bg-card border border-border rounded px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Cull plan year"
            >
              {PLAN_YEARS.map(y => (
                <option key={y} value={y}>{formatPlanYearLabel(y)}</option>
              ))}
            </select>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {plansWithProgress.length > 0
                ? `${plansWithProgress.filter(p => p.actual >= p.plan.target).length}/${plansWithProgress.length} on target`
                : "No targets set"}
            </span>
            {plansWithProgress.length > 0 && (
              <button
                onClick={() => setShowPlans(s => !s)}
                aria-label={showPlans ? "Collapse cull plan" : "Expand cull plan"}
              >
                <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", showPlans && "rotate-180")} />
              </button>
            )}
          </div>

          {plansWithProgress.length === 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              No cull-plan targets set for {formatPlanYearLabel(planYear)}.
            </p>
          )}

          {plansWithProgress.length > 0 && showPlans && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {plansWithProgress.map(({ plan, actual, pct }) => {
                const onTarget = actual >= plan.target;
                const over = actual > plan.target;
                const color = getMarkerColor(plan.species as Species, plan.sex as Sex);
                return (
                  <div key={plan.id} className="bg-card border border-border rounded-md p-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <p className="text-xs font-semibold text-foreground truncate">
                        {SPECIES_LABELS[plan.species as Species]} <span className="text-muted-foreground font-normal">— {SEX_LABELS[plan.sex as Sex]}</span>
                      </p>
                      <p className={cn(
                        "text-xs font-bold ml-auto tabular-nums",
                        over ? "text-red-600" : onTarget ? "text-emerald-700" : "text-foreground"
                      )}>
                        {actual} / {plan.target}
                      </p>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          over ? "bg-red-500" : onTarget ? "bg-emerald-600" : "bg-primary"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {summaryStats && (
          <div className="grid grid-cols-4 gap-2">
            <Stat label="Records" value={summaryStats.total.toString()} />
            <Stat label="Avg weight" value={summaryStats.avgWeight ? `${summaryStats.avgWeight.toFixed(1)}kg` : "—"} />
            <Stat label="Top stalker" value={summaryStats.topStalker?.[0] ?? "—"} sub={summaryStats.topStalker ? `${summaryStats.topStalker[1]}` : undefined} />
            <Stat label="Top block" value={summaryStats.topBlock?.[0] ?? "—"} sub={summaryStats.topBlock ? `${summaryStats.topBlock[1]}` : undefined} />
          </div>
        )}

      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-sm">Loading records…</p>
          </div>
        ) : filteredCulls.length === 0 && pendingCulls.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-center px-8 text-muted-foreground">
            <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center mb-1">
              <Search className="w-6 h-6 opacity-30" />
            </div>
            <p className="text-sm font-semibold text-foreground">No records found</p>
            <p className="text-xs">Try adjusting your season, stalker filter, or search terms.</p>
          </div>
        ) : (
          <div className="p-3 space-y-2 pb-safe-bottom">

            {/* Pending (unsynced) culls — shown at the top */}
            {pendingCulls.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-1 pt-1 pb-0.5">
                  <RefreshCw className="w-3 h-3 text-amber-600 animate-spin" />
                  <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">
                    Awaiting sync · {pendingCulls.length} record{pendingCulls.length !== 1 ? "s" : ""}
                  </p>
                </div>
                {pendingCulls.map(cull => {
                  const color = getMarkerColor(cull.species, cull.sex);
                  return (
                    <div
                      key={cull._localId}
                      className="w-full text-left bg-amber-50 border border-amber-300 border-dashed rounded-md flex overflow-hidden opacity-90"
                    >
                      <div className="w-1.5 shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 px-3.5 py-3 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground text-sm leading-tight truncate">
                              {SPECIES_LABELS[cull.species]}
                              <span className="text-muted-foreground font-normal"> — {SEX_LABELS[cull.sex]}</span>
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {formatDate(cull.culledAt)} &middot; {formatTime(cull.culledAt)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-base font-display font-semibold text-primary leading-none">
                              {cull.weight ? `${cull.weight} kg` : "—"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className="badge border text-[10px] bg-amber-100 text-amber-700 border-amber-300 flex items-center gap-1">
                            <RefreshCw className="w-2.5 h-2.5" /> Unsynced
                          </span>
                          <span className={cn("badge border text-[10px]", CONDITION_STYLES[cull.condition])}>
                            {CONDITION_LABELS[cull.condition]}
                          </span>
                          {cull.pregnant && (
                            <span className="badge border bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Pregnant</span>
                          )}
                          {cull.stalkerName && (
                            <span className="text-[10px] text-muted-foreground ml-auto truncate max-w-[110px] font-medium">
                              {cull.stalkerName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredCulls.length > 0 && (
                  <div className="flex items-center gap-2 px-1 pt-2 pb-0.5">
                    <div className="h-px flex-1 bg-border" />
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Synced records</p>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
              </>
            )}

            {filteredCulls.map(cull => {
              const color = getMarkerColor(cull.species, cull.sex);
              return (
                <button
                  key={cull.id}
                  onClick={() => { setSelectedCull(cull); setShowDetail(true); }}
                  className="w-full text-left bg-card border border-border rounded-md shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex overflow-hidden active:scale-[0.99]"
                >
                  <div className="w-1.5 shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 px-3.5 py-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-sm leading-tight truncate">
                          {SPECIES_LABELS[cull.species]}
                          <span className="text-muted-foreground font-normal"> — {SEX_LABELS[cull.sex]}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatDate(cull.culledAt)} &middot; {formatTime(cull.culledAt)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-base font-display font-semibold text-primary leading-none">
                          {cull.weight ? `${cull.weight} kg` : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className={cn("badge border text-[10px]", CONDITION_STYLES[cull.condition])}>
                        {CONDITION_LABELS[cull.condition]}
                      </span>
                      {cull.pregnant && (
                        <span className="badge border bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                          Pregnant
                        </span>
                      )}
                      {cull.stalkerName && (
                        <span className="text-[10px] text-muted-foreground ml-auto truncate max-w-[110px] font-medium">
                          {cull.stalkerName}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <CullDetailSheet
        cull={showDetail ? selectedCull : null}
        onClose={() => setShowDetail(false)}
        onEdit={cull => { setEditingCull(cull); setShowDetail(false); setShowForm(true); }}
        onDelete={handleDelete}
      />

      <CullForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditingCull(null); }}
        onSubmit={handleFormSubmit}
        initialData={editingCull || undefined}
        isSubmitting={updateMutation.isPending}
      />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-md px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-semibold leading-none">{label}</p>
      <p className="text-xs font-bold text-foreground mt-1 truncate" title={value}>{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">×{sub}</p>}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none bg-card border border-border pl-3 pr-7 py-1.5 rounded-md text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm cursor-pointer"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
    </div>
  );
}
