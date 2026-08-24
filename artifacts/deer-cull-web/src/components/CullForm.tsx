import React, { useState, useEffect, useRef } from "react";
import { X, Loader2, MapPin, Clock, AlertTriangle, Tag, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SPECIES_LABELS,
  SEX_LABELS,
  CONDITION_LABELS,
  VALID_SEX_FOR_SPECIES,
  FEMALE_SEX,
  WOODLAND_BLOCKS,
  WOODLAND_BLOCK_LIST,
  isInOpenSeason,
  formatOpenSeasonRange,
  type Species,
  type Sex,
  type Condition,
  type WoodlandBlock,
} from "@/lib/constants";
import type { CullRecord, StalkingSession } from "@/lib/schemas";
import { useAuth } from "@/hooks/use-auth";
import { useSessions } from "@/hooks/use-api";

interface CullFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  initialData?: CullRecord;
  defaultLat?: number;
  defaultLng?: number;
  isSubmitting?: boolean;
}

const SPECIES_LIST = Object.keys(SPECIES_LABELS) as Species[];
const CONDITIONS: Condition[] = ["excellent", "good", "fair", "poor"];

const CONDITION_META: Record<Condition, string> = {
  excellent: "Prime",
  good:      "Healthy",
  fair:      "Average",
  poor:      "Below avg",
};

export function CullForm({ open, onClose, onSubmit, initialData, defaultLat, defaultLng, isSubmitting }: CullFormProps) {
  const { stalker } = useAuth();

  const [species, setSpecies] = useState<Species>("red_deer");
  const [sex, setSex] = useState<Sex>("stag");
  const [weight, setWeight] = useState<string>("");
  const [condition, setCondition] = useState<Condition>("good");
  const [pregnant, setPregnant] = useState<boolean>(false);
  const [woodlandBlock, setWoodlandBlock] = useState<WoodlandBlock | "">("");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [larderTag, setLarderTag] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [linkSession, setLinkSession] = useState<boolean>(true);
  const capturedAt = useRef<string>("");

  // Lookup the stalker's currently active session (no endedAt) so new culls can be auto-linked.
  const { data: sessions } = useSessions(stalker?.id ? { stalkerId: stalker.id } : undefined);
  const activeSession: StalkingSession | undefined = sessions?.find(s => !s.endedAt);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setSpecies(initialData.species as Species);
        setSex(initialData.sex as Sex);
        setWeight(initialData.weight?.toString() || "");
        setCondition(initialData.condition as Condition);
        setPregnant(initialData.pregnant || false);
        setWoodlandBlock((initialData.woodlandBlock as WoodlandBlock) || "");
        setLat(initialData.latitude.toString());
        setLng(initialData.longitude.toString());
        setLarderTag(initialData.larderTag || "");
        setNotes(initialData.notes || "");
        setLinkSession(false);
        capturedAt.current = initialData.culledAt;
      } else {
        setSpecies("red_deer");
        setSex("stag");
        setWeight("");
        setCondition("good");
        setPregnant(false);
        setWoodlandBlock("");
        setLat(defaultLat?.toString() || "");
        setLng(defaultLng?.toString() || "");
        setLarderTag("");
        setNotes("");
        setLinkSession(true);
        capturedAt.current = new Date().toISOString();
      }
    }
  }, [open, initialData, defaultLat, defaultLng]);

  const validSexes = VALID_SEX_FOR_SPECIES[species];
  const isFemale = FEMALE_SEX.includes(sex);

  const handleSpeciesChange = (s: Species) => {
    setSpecies(s);
    if (!VALID_SEX_FOR_SPECIES[s].includes(sex)) {
      setSex(VALID_SEX_FOR_SPECIES[s][0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Auto-link to active session unless editing an existing record or the user opted out.
    const sessionIdToSend = !initialData && linkSession && activeSession
      ? activeSession.id
      : initialData?.sessionId ?? null;
    // If the cull is being linked to an active session, default the woodland block from the session.
    const blockFinal = woodlandBlock || (sessionIdToSend && activeSession ? activeSession.woodlandBlock : null);
    onSubmit({
      stalkerId: initialData?.stalkerId ?? stalker?.id ?? null,
      sessionId: sessionIdToSend,
      species,
      sex,
      condition,
      weight: weight ? parseFloat(weight) : null,
      pregnant: isFemale ? pregnant : null,
      woodlandBlock: blockFinal || null,
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      larderTag: larderTag.trim() || null,
      notes: notes || null,
      culledAt: capturedAt.current || new Date().toISOString(),
    });
  };

  // Season warning — uses today's date for new records; the cull's culledAt for edits.
  const checkDate = capturedAt.current ? new Date(capturedAt.current) : new Date();
  const seasonOk = isInOpenSeason(species, sex, checkDate);
  const seasonRange = formatOpenSeasonRange(species, sex);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-auto bg-card rounded-t-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom-full duration-300 ease-out">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-display text-foreground">
              {initialData ? "Edit Cull Record" : "Log Deer Cull"}
            </h2>
            {!initialData && capturedAt.current && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {new Date(capturedAt.current).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                {" · "}
                {new Date(capturedAt.current).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar">
          <form id="cull-form" onSubmit={handleSubmit} className="p-5 space-y-6 pb-6">

            {/* Out-of-season warning */}
            {!seasonOk && (
              <div className="flex items-start gap-2 p-3 rounded-md border-2 border-red-300 bg-red-50">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-red-800">Out of season — {SPECIES_LABELS[species]} {SEX_LABELS[sex]}</p>
                  <p className="text-[11px] text-red-700 mt-0.5">Open season (England): {seasonRange}. Logging this cull may breach the Deer Act 1991.</p>
                </div>
              </div>
            )}

            {/* Active session auto-link */}
            {!initialData && activeSession && (
              <div className={cn(
                "flex items-start gap-2 p-3 rounded-md border-2 transition-colors",
                linkSession ? "bg-emerald-50 border-emerald-300" : "bg-muted/50 border-border"
              )}>
                <Link2 className={cn("w-4 h-4 shrink-0 mt-0.5", linkSession ? "text-emerald-700" : "text-muted-foreground")} />
                <div className="flex-1">
                  <p className={cn("text-xs font-bold", linkSession ? "text-emerald-800" : "text-foreground")}>
                    Active session: {WOODLAND_BLOCKS[activeSession.woodlandBlock as WoodlandBlock] ?? activeSession.woodlandBlock}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Started {new Date(activeSession.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLinkSession(v => !v)}
                  className={cn(
                    "text-[11px] font-semibold px-2.5 py-1 rounded border",
                    linkSession
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-card text-muted-foreground border-border hover:border-foreground/40"
                  )}
                >
                  {linkSession ? "Linked" : "Link"}
                </button>
              </div>
            )}

            {/* Species */}
            <FormSection label="Species">
              <div className="grid grid-cols-2 gap-2">
                {SPECIES_LIST.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSpeciesChange(s)}
                    className={cn(
                      "px-3 py-2.5 rounded-md text-sm font-medium transition-all border text-left",
                      species === s
                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                        : "bg-background border-border text-foreground hover:border-primary/40 hover:bg-muted/50"
                    )}
                  >
                    {SPECIES_LABELS[s]}
                  </button>
                ))}
              </div>
            </FormSection>

            {/* Sex */}
            <FormSection label="Sex">
              <div className="flex gap-2">
                {validSexes.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSex(s)}
                    className={cn(
                      "flex-1 py-2.5 rounded-md text-sm font-semibold transition-all border",
                      sex === s
                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                        : "bg-background border-border text-foreground hover:border-primary/40"
                    )}
                  >
                    {SEX_LABELS[s]}
                  </button>
                ))}
              </div>
            </FormSection>

            {/* Condition */}
            <FormSection label="Body Condition">
              <div className="grid grid-cols-4 gap-1.5">
                {CONDITIONS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCondition(c)}
                    className={cn(
                      "py-2.5 rounded-md text-xs font-semibold transition-all border flex flex-col items-center gap-0.5",
                      condition === c
                        ? "bg-primary border-primary text-primary-foreground shadow-sm"
                        : "bg-background border-border text-foreground hover:border-primary/40"
                    )}
                  >
                    <span className="font-bold">{CONDITION_LABELS[c]}</span>
                    <span className={cn("text-[10px] opacity-70", condition === c && "opacity-80")}>
                      {CONDITION_META[c]}
                    </span>
                  </button>
                ))}
              </div>
            </FormSection>

            {/* Weight + Pregnant */}
            <div className="grid grid-cols-2 gap-3">
              <FormSection label="Weight (kg)">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="500"
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  placeholder="e.g. 65.5"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                />
              </FormSection>

              {isFemale ? (
                <FormSection label="Pregnant">
                  <div className="flex bg-background border border-border rounded-md p-0.5 h-[42px]">
                    <button
                      type="button"
                      onClick={() => setPregnant(true)}
                      className={cn(
                        "flex-1 rounded text-sm font-semibold transition-all",
                        pregnant
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setPregnant(false)}
                      className={cn(
                        "flex-1 rounded text-sm font-semibold transition-all",
                        !pregnant
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      No
                    </button>
                  </div>
                </FormSection>
              ) : <div />}
            </div>

            {/* Location + Time */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-muted/60 border border-border rounded-md px-3 py-2.5">
                <span className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase flex items-center gap-1 mb-1">
                  <MapPin className="w-3 h-3" /> GPS
                </span>
                {lat && lng ? (
                  <span className="text-xs font-mono text-foreground">
                    {parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)}
                  </span>
                ) : (
                  <span className="text-xs text-destructive font-medium">No location</span>
                )}
              </div>
              <div className="bg-muted/60 border border-border rounded-md px-3 py-2.5">
                <span className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3" /> Time
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {capturedAt.current
                    ? new Date(capturedAt.current).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </span>
              </div>
            </div>

            {/* Woodland Block + Larder Tag */}
            <div className="grid grid-cols-2 gap-3">
              <FormSection label="Woodland Block">
                <select
                  value={woodlandBlock}
                  onChange={e => setWoodlandBlock(e.target.value as WoodlandBlock | "")}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                >
                  <option value="">— Not specified —</option>
                  {WOODLAND_BLOCK_LIST.map(b => (
                    <option key={b} value={b}>{WOODLAND_BLOCKS[b]}</option>
                  ))}
                </select>
              </FormSection>
              <FormSection label="Larder Tag">
                <div className="relative">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={larderTag}
                    onChange={e => setLarderTag(e.target.value)}
                    placeholder="e.g. RD-2026-0142"
                    className="w-full pl-8 pr-3 py-2.5 bg-background border border-border rounded-md text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  />
                </div>
              </FormSection>
            </div>

            {/* Notes */}
            <FormSection label="Field Notes (optional)">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any additional observations…"
                rows={3}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
              />
            </FormSection>
          </form>
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 border-t border-border bg-card">
          <button
            type="submit"
            form="cull-form"
            disabled={isSubmitting || !lat || !lng}
            className="w-full py-3.5 rounded-md font-semibold text-base bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {isSubmitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : initialData ? "Save Changes" : "Log Cull"
            }
          </button>
        </div>
      </div>
    </div>
  );
}

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
      {children}
    </div>
  );
}
