import React, { useState } from "react";
import { X, Edit2, Trash2, MapPin, Calendar, Scale, Activity, User, Info, AlertTriangle, Loader2 } from "lucide-react";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { SPECIES_LABELS, SEX_LABELS, CONDITION_LABELS, getMarkerColor } from "@/lib/constants";
import type { CullRecord } from "@/lib/schemas";

interface CullDetailSheetProps {
  cull: CullRecord | null;
  onClose: () => void;
  onEdit: (cull: CullRecord) => void;
  onDelete: (id: number) => Promise<void> | void;
}

export function CullDetailSheet({ cull, onClose, onEdit, onDelete }: CullDetailSheetProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!cull) return null;

  const color = getMarkerColor(cull.species, cull.sex);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await onDelete(cull.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const conditionColors: Record<string, string> = {
    excellent: "bg-emerald-50 text-emerald-700 border-emerald-200",
    good:      "bg-sky-50 text-sky-700 border-sky-200",
    fair:      "bg-amber-50 text-amber-700 border-amber-200",
    poor:      "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />

      <div className="relative w-full max-w-2xl mx-auto bg-card rounded-t-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in slide-in-from-bottom-full duration-300 ease-out">

        {/* Drag handle */}
        <div className="shrink-0 flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pt-2 pb-4 border-b border-border flex items-start gap-3">
          <div className="w-1 self-stretch rounded-full shrink-0 mt-1" style={{ backgroundColor: color }} />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase mb-1">
              Record #{cull.id}
            </p>
            <h2 className="text-xl font-display text-foreground leading-tight">
              {SPECIES_LABELS[cull.species]} &mdash; {SEX_LABELS[cull.sex]}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground bg-muted rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Key metrics row */}
          <div className="grid grid-cols-2 gap-2.5">
            <InfoTile
              icon={<Scale className="w-4 h-4" />}
              label="Weight"
              value={cull.weight ? `${cull.weight} kg` : "Not recorded"}
              dimmed={!cull.weight}
            />
            <InfoTile
              icon={<Activity className="w-4 h-4" />}
              label="Condition"
              value={
                <span className={cn("badge border", conditionColors[cull.condition])}>
                  {CONDITION_LABELS[cull.condition]}
                </span>
              }
            />
            <InfoTile
              icon={<Calendar className="w-4 h-4" />}
              label="Date & Time"
              value={
                <>
                  {formatDate(cull.culledAt)}
                  <span className="block text-sm font-normal text-muted-foreground mt-0.5">
                    {formatTime(cull.culledAt)}
                  </span>
                </>
              }
            />
            <InfoTile
              icon={<User className="w-4 h-4" />}
              label="Stalker"
              value={cull.stalkerName || "Unassigned"}
              dimmed={!cull.stalkerName}
            />
            {cull.pregnant != null && (
              <InfoTile
                icon={<Info className={cn("w-4 h-4", cull.pregnant ? "text-amber-500" : "text-muted-foreground")} />}
                label="Pregnant"
                value={cull.pregnant ? "Yes — pregnant" : "No"}
                highlight={cull.pregnant}
              />
            )}
          </div>

          {/* GPS */}
          <div className="flex gap-3 items-center bg-muted/50 border border-border rounded-md p-3.5">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">GPS Location</p>
              <p className="text-sm font-mono text-foreground">
                {cull.latitude.toFixed(6)}&deg;N, {cull.longitude.toFixed(6)}&deg;E
              </p>
            </div>
          </div>

          {/* Notes */}
          {cull.notes && (
            <div className="bg-muted/50 border border-border rounded-md p-3.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Field Notes</p>
              <p className="text-sm text-foreground leading-relaxed">{cull.notes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="shrink-0 border-t border-border bg-card p-4 space-y-2">
          {confirmDelete ? (
            <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3 mb-2">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Confirm deletion</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    This record will be permanently removed and cannot be recovered.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-2.5 rounded-md text-sm font-semibold bg-muted text-foreground hover:bg-border transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-md text-sm font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Delete permanently</>}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => onEdit(cull)}
                className="flex-1 py-3 rounded-md font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Edit2 className="w-4 h-4" /> Edit Record
              </button>
              <button
                onClick={handleDelete}
                className="py-3 px-4 rounded-md font-semibold text-sm text-destructive border border-destructive/25 bg-destructive/5 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoTile({
  icon, label, value, dimmed, highlight
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  dimmed?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "bg-muted/40 border rounded-md p-3.5",
      highlight ? "border-amber-200 bg-amber-50/60" : "border-border"
    )}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={cn("text-muted-foreground", highlight && "text-amber-500")}>{icon}</span>
        <span className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">{label}</span>
      </div>
      <div className={cn(
        "text-base font-semibold leading-snug",
        dimmed ? "text-muted-foreground font-normal text-sm" : "text-foreground",
        highlight && "text-amber-700"
      )}>
        {value}
      </div>
    </div>
  );
}
