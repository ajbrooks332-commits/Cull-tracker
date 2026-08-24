import React, { useState } from "react";
import { Plus, Edit2, Trash2, Loader2, AlertCircle, AlertTriangle, X, Target } from "lucide-react";
import { useCullPlans, useCreateCullPlan, useUpdateCullPlan, useDeleteCullPlan } from "@/hooks/use-api";
import type { CullPlan } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { 
  SPECIES_LABELS, SEX_LABELS, VALID_SEX_FOR_SPECIES, 
  getCurrentPlanYear, getAvailablePlanYears, formatPlanYearLabel, 
  type Species, type Sex 
} from "@/lib/constants";

export function TargetsManager() {
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentPlanYear());
  const {
    data: plans = [],
    isLoading,
    isError,
    error: plansError,
    refetch,
  } = useCullPlans(selectedYear);
  const createMutation = useCreateCullPlan();
  const updateMutation = useUpdateCullPlan();
  const deleteMutation = useDeleteCullPlan();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CullPlan | null>(null);
  const [species, setSpecies] = useState<Species | "">("");
  const [sex, setSex] = useState<Sex | "">("");
  const [targetVal, setTargetVal] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const availableYears = getAvailablePlanYears();

  const openCreate = () => {
    setEditing(null);
    setSpecies("");
    setSex("");
    setTargetVal("");
    setNotes("");
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (p: CullPlan) => {
    setEditing(p);
    setSpecies(p.species as Species);
    setSex(p.sex as Sex);
    setTargetVal(p.target.toString());
    setNotes(p.notes || "");
    setFormError(null);
    setShowForm(true);
  };

  const handleSpeciesChange = (newSpecies: Species) => {
    setSpecies(newSpecies);
    setSex("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    if (!species) { setFormError("Species is required."); return; }
    if (!sex) { setFormError("Sex is required."); return; }
    const numTarget = parseInt(targetVal, 10);
    if (isNaN(numTarget) || numTarget <= 0) { setFormError("Target must be a whole number greater than zero."); return; }
    
    if (!editing) {
      const exists = plans.find(p => p.species === species && p.sex === sex);
      if (exists) {
        setFormError(`A target for ${SPECIES_LABELS[species]} ${SEX_LABELS[sex]} already exists in this plan year.`);
        return;
      }
    }

    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          data: { species, sex, target: numTarget, notes: notes.trim() || null },
        });
      } else {
        await createMutation.mutateAsync({
          seasonStartYear: selectedYear,
          species,
          sex,
          target: numTarget,
          notes: notes.trim() || null,
        });
      }
      setShowForm(false);
    } catch (e: any) {
      setFormError(e.message || "Failed to save target. Please try again.");
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      setDeletingId(null);
    } catch (e: any) {
      setDeleteError(e.message || "Failed to delete target.");
      setDeletingId(null);
    }
  };

  const pendingDelete = plans.find(p => p.id === deletingId);

  const sortedPlans = [...plans].sort((a, b) => {
    const sA = SPECIES_LABELS[a.species as Species] || a.species;
    const sB = SPECIES_LABELS[b.species as Species] || b.species;
    if (sA !== sB) return sA.localeCompare(sB);
    const xA = SEX_LABELS[a.sex as Sex] || a.sex;
    const xB = SEX_LABELS[b.sex as Sex] || b.sex;
    return xA.localeCompare(xB);
  });

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-background">
      {/* Top action bar */}
      <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-border bg-card/40 gap-3">
        <div className="flex-1 max-w-[220px]">
          <select 
            value={selectedYear} 
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="w-full h-8 px-2 bg-background border border-border rounded-md text-sm font-semibold focus:ring-2 focus:ring-primary/30 outline-none shadow-sm"
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{formatPlanYearLabel(y)}</option>
            ))}
          </select>
        </div>
        <button
          onClick={openCreate}
          className="h-8 px-3 rounded-md flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Add Target
        </button>
      </div>

      {deleteError && (
        <div className="mx-4 mt-3 flex items-center gap-2 text-destructive text-xs bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2 shrink-0">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {deleteError}
          <button onClick={() => setDeleteError(null)} className="ml-auto"><X className="w-3 h-3" /></button>
        </div>
      )}

      {pendingDelete && (
        <div className="mx-4 mt-3 border border-destructive/25 bg-destructive/5 rounded-md p-3.5 shrink-0">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Delete Target?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Remove the target for {SPECIES_LABELS[pendingDelete.species as Species]} {SEX_LABELS[pendingDelete.sex as Sex]}.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setDeletingId(null)} className="flex-1 py-2 rounded-md text-xs font-semibold bg-muted text-foreground hover:bg-border transition-colors">
              Cancel
            </button>
            <button onClick={confirmDelete} disabled={deleteMutation.isPending} className="flex-1 py-2 rounded-md text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors flex items-center justify-center gap-1.5">
              {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Trash2 className="w-3.5 h-3.5" /> Confirm Delete</>}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="mx-auto my-6 max-w-sm rounded-md border border-destructive/20 bg-destructive/5 p-4 text-center">
            <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
            <p className="text-sm font-semibold text-foreground">Targets could not be loaded</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {plansError instanceof Error ? plansError.message : "Please check your connection and try again."}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Try Again
            </button>
          </div>
        ) : sortedPlans.length === 0 ? (
          <div className="text-center py-10 flex flex-col items-center justify-center">
            <Target className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-semibold text-foreground">No targets set</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">Add targets to track cull progress for this plan year.</p>
          </div>
        ) : (
          sortedPlans.map(p => (
            <div key={p.id} className={cn("bg-card border rounded-md p-4 flex items-center gap-3 transition-colors shadow-sm", p.id === deletingId ? "border-destructive/30 bg-destructive/3" : "border-border")}>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm truncate">
                  {SPECIES_LABELS[p.species as Species]} {SEX_LABELS[p.sex as Sex]}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded tracking-wide uppercase">
                    Target: {p.target}
                  </span>
                </div>
                {p.notes && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{p.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <button onClick={() => openEdit(p)} className="p-2 rounded-md bg-muted hover:bg-border text-foreground transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => { setDeletingId(p.id); setDeleteError(null); }} className="p-2 rounded-md text-destructive bg-destructive/8 hover:bg-destructive hover:text-white transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form Sheet */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md mx-auto bg-card rounded-t-xl shadow-2xl p-5 pb-8 animate-in slide-in-from-bottom-8 duration-300">
            <div className="flex justify-center mb-4"><div className="w-10 h-1 bg-border rounded-full" /></div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-display text-foreground">{editing ? "Edit Target" : "Add Target"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
            </div>
            
            <div className="mb-4 p-3 bg-muted/50 border border-border rounded-md flex items-center justify-center shadow-inner">
              <span className="text-xs font-semibold text-foreground">
                Plan Year: <span className="text-primary">{formatPlanYearLabel(selectedYear)}</span>
              </span>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Species</label>
                  <select 
                    value={species} 
                    onChange={e => handleSpeciesChange(e.target.value as Species)} 
                    required 
                    disabled={!!editing}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm text-foreground focus:ring-2 focus:ring-primary/30 outline-none transition-all disabled:opacity-60 disabled:bg-muted"
                  >
                    <option value="" disabled>Select...</option>
                    {(Object.entries(SPECIES_LABELS) as [Species, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Sex</label>
                  <select 
                    value={sex} 
                    onChange={e => setSex(e.target.value as Sex)} 
                    required 
                    disabled={!species || !!editing}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm text-foreground focus:ring-2 focus:ring-primary/30 outline-none transition-all disabled:opacity-60 disabled:bg-muted"
                  >
                    <option value="" disabled>{!species ? "Wait..." : "Select..."}</option>
                    {species && VALID_SEX_FOR_SPECIES[species].map(k => (
                      <option key={k} value={k}>{SEX_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Target Number</label>
                <input 
                  type="number" 
                  min="1"
                  step="1"
                  value={targetVal} 
                  onChange={e => setTargetVal(e.target.value)} 
                  placeholder="e.g. 150" 
                  required 
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm text-foreground focus:ring-2 focus:ring-primary/30 outline-none transition-all" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Notes <span className="text-muted-foreground/60 normal-case">(Optional)</span></label>
                <textarea 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  placeholder="Additional details..." 
                  rows={2}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm text-foreground focus:ring-2 focus:ring-primary/30 outline-none transition-all resize-none" 
                />
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {formError}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-md text-sm font-semibold bg-muted text-foreground hover:bg-border transition-colors">Cancel</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-[2] py-3 rounded-md text-sm font-semibold bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  {createMutation.isPending || updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? "Save Changes" : "Add Target"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
