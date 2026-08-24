import React, { useState } from "react";
import { Plus, Edit2, Trash2, Loader2, AlertCircle, AlertTriangle, X } from "lucide-react";
import { useStalkers, useCreateStalker, useUpdateStalker, useDeleteStalker } from "@/hooks/use-api";
import type { Stalker } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export function StalkersManager({ currentUser }: { currentUser: Stalker }) {
  const { data: stalkers = [], isLoading } = useStalkers();
  const createMutation = useCreateStalker();
  const updateMutation = useUpdateStalker();
  const deleteMutation = useDeleteStalker();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Stalker | null>(null);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setPin("");
    setIsAdmin(false);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (s: Stalker) => {
    setEditing(s);
    setName(s.name);
    setPin("");
    setIsAdmin(s.isAdmin);
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) { setFormError("Name is required."); return; }
    if (!editing && pin.length !== 4) { setFormError("PIN must be exactly 4 digits."); return; }
    if (editing && pin && pin.length !== 4) { setFormError("New PIN must be exactly 4 digits."); return; }
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          data: { name: name.trim(), isAdmin, ...(pin ? { pin } : {}) },
        });
      } else {
        await createMutation.mutateAsync({ name: name.trim(), pin, isAdmin });
      }
      setShowForm(false);
    } catch (e: any) {
      setFormError(e.message || "Failed to save account. Please try again.");
    }
  };

  const handleDeleteRequest = (s: Stalker) => {
    if (s.id === currentUser?.id) {
      setDeleteError("You cannot delete your own account.");
      return;
    }
    setDeletingId(s.id);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      setDeletingId(null);
    } catch (e: any) {
      setDeleteError(e.message || "Failed to delete account.");
      setDeletingId(null);
    }
  };

  const pendingDelete = stalkers.find(s => s.id === deletingId);

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-background">
      {/* Top action bar */}
      <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-border bg-card/40">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {stalkers.length} account{stalkers.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={openCreate}
          className="h-8 px-3 rounded-md flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Stalker
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
              <p className="text-sm font-semibold text-foreground">Delete {pendingDelete.name}?</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Their account will be removed. All cull records they logged will be preserved.
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
        ) : stalkers.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No stalker accounts yet.</p>
        ) : (
          stalkers.map(s => (
            <div key={s.id} className={cn("bg-card border rounded-md p-4 flex items-center gap-3 transition-colors shadow-sm", s.id === deletingId ? "border-destructive/30 bg-destructive/3" : "border-border")}>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">{s.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-sm truncate">
                  {s.name}
                  {s.id === currentUser.id && <span className="text-muted-foreground font-normal ml-1 text-xs">(You)</span>}
                </h3>
                <p className={cn("text-[11px] font-semibold uppercase tracking-wider mt-0.5", s.isAdmin ? "text-primary" : "text-muted-foreground")}>
                  {s.isAdmin ? "Administrator" : "Stalker"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => openEdit(s)} className="p-2 rounded-md bg-muted hover:bg-border text-foreground transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDeleteRequest(s)} disabled={s.id === currentUser.id} className="p-2 rounded-md text-destructive bg-destructive/8 hover:bg-destructive hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit form sheet */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md mx-auto bg-card rounded-t-xl shadow-2xl p-5 pb-8 animate-in slide-in-from-bottom-8 duration-300">
            <div className="flex justify-center mb-4"><div className="w-10 h-1 bg-border rounded-full" /></div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-display text-foreground">{editing ? "Edit Account" : "Add Stalker"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Full Name</label>
                <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John MacLeod" required className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm text-foreground focus:ring-2 focus:ring-primary/30 outline-none transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">{editing ? "New PIN (leave blank to keep current)" : "PIN — 4 digits"}</label>
                <input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} placeholder={editing ? "Leave blank to keep" : "••••"} required={!editing} className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm focus:ring-2 focus:ring-primary/30 outline-none transition-all font-mono tracking-[0.4em] text-center text-lg" />
              </div>
              <div className="flex items-center justify-between p-3.5 bg-background border border-border rounded-md shadow-sm">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Administrator</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Can manage stalker accounts</p>
                </div>
                <button type="button" role="switch" aria-checked={isAdmin} onClick={() => setIsAdmin(!isAdmin)} className={cn("w-11 h-6 rounded-full p-[3px] transition-colors duration-200", isAdmin ? "bg-primary" : "bg-muted-foreground/30")}>
                  <div className={cn("w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200", isAdmin ? "translate-x-5" : "translate-x-0")} />
                </button>
              </div>
              {formError && (
                <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {formError}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-md text-sm font-semibold bg-muted text-foreground hover:bg-border transition-colors">Cancel</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-[2] py-3 rounded-md text-sm font-semibold bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  {createMutation.isPending || updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? "Save Changes" : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
