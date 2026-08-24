import React, { useState, useEffect } from "react";
import { Loader2, AlertCircle, ChevronRight, Delete } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useStalkers, useLoginStalker, useBootstrapStalker } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

type Step = "select" | "pin" | "setup";

export default function Login() {
  const { login } = useAuth();
  const { data: stalkers = [], isLoading } = useStalkers();
  const loginMutation = useLoginStalker();
  const bootstrapMutation = useBootstrapStalker();

  const [step, setStep] = useState<Step>("select");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [setupName, setSetupName] = useState("");
  const [setupPin, setSetupPin] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");
  const [setupStep, setSetupStep] = useState<"name" | "pin" | "confirm">("name");

  // Only go to setup when there are genuinely no accounts yet (first-time setup)
  const noStalkers = !isLoading && stalkers.length === 0;

  useEffect(() => {
    if (noStalkers) setStep("setup");
    else if (step === "setup") setStep("select"); // if accounts appear, go back
  }, [noStalkers]);

  // Auto-submit when PIN reaches 4 digits
  useEffect(() => {
    if (pin.length === 4 && step === "pin" && selectedName) {
      doLogin(pin);
    }
  }, [pin]);

  const doLogin = async (enteredPin: string) => {
    if (!selectedName) return;
    setError(null);
    try {
      const stalker = await loginMutation.mutateAsync({ name: selectedName, pin: enteredPin });
      login(stalker);
    } catch (e: any) {
      setError(e.message || "Incorrect PIN. Please try again.");
      setPin("");
    }
  };

  const handleKeypad = (digit: string) => {
    if (loginMutation.isPending) return;
    setError(null);
    if (digit === "del") {
      setPin(p => p.slice(0, -1));
    } else if (pin.length < 4) {
      setPin(p => p + digit);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setupStep === "name") {
      if (!setupName.trim()) return;
      setSetupStep("pin");
      return;
    }
    if (setupStep === "pin") {
      if (setupPin.length !== 4) { setError("PIN must be 4 digits"); return; }
      setSetupStep("confirm");
      setError(null);
      return;
    }
    if (setupPin !== setupConfirm) {
      setError("PINs do not match.");
      setSetupConfirm("");
      return;
    }
    try {
      const stalker = await bootstrapMutation.mutateAsync({ name: setupName.trim(), pin: setupPin });
      login(stalker);
    } catch (e: any) {
      setError(e.message || "Failed to create account.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Institutional header bar */}
      <div className="bg-primary px-6 pt-12 pb-8">
        <div className="max-w-sm mx-auto">
          <p className="text-primary-foreground/60 text-xs font-semibold tracking-[0.12em] uppercase mb-2">
            Estate Management
          </p>
          <h1 className="text-primary-foreground font-display text-3xl leading-tight">
            Deer Cull<br />Records
          </h1>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 pt-8 pb-10">
        <div className="w-full max-w-sm">

          {/* ── SETUP MODE ── */}
          {step === "setup" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-foreground">
                  {noStalkers ? "First-Time Setup" : "Add Account"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {noStalkers
                    ? "Create the first administrator account to get started."
                    : "Create a new stalker account."}
                </p>
              </div>

              <form onSubmit={handleSetup} className="space-y-4">
                {setupStep === "name" && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      Full Name
                    </label>
                    <input
                      autoFocus
                      type="text"
                      value={setupName}
                      onChange={e => setSetupName(e.target.value)}
                      placeholder="e.g. John MacLeod"
                      required
                      className="w-full px-4 py-3 bg-card border border-border rounded-md text-foreground focus:ring-2 focus:ring-primary/30 outline-none transition-all text-base"
                    />
                  </div>
                )}

                {setupStep === "pin" && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Creating account for <strong className="text-foreground">{setupName}</strong>
                      </p>
                    </div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      Choose a 4-Digit PIN
                    </label>
                    <PinDots value={setupPin} />
                    <Keypad onPress={(d) => {
                      if (d === "del") setSetupPin(p => p.slice(0, -1));
                      else if (setupPin.length < 4) setSetupPin(p => p + d);
                    }} />
                  </div>
                )}

                {setupStep === "confirm" && (
                  <div className="space-y-4">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      Confirm Your PIN
                    </label>
                    <PinDots value={setupConfirm} />
                    <Keypad onPress={(d) => {
                      if (d === "del") setSetupConfirm(p => p.slice(0, -1));
                      else if (setupConfirm.length < 4) setSetupConfirm(p => p + d);
                    }} />
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    bootstrapMutation.isPending ||
                    (setupStep === "name" && !setupName.trim()) ||
                    (setupStep === "pin" && setupPin.length !== 4) ||
                    (setupStep === "confirm" && setupConfirm.length !== 4)
                  }
                  className="w-full py-3.5 rounded-md font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                >
                  {bootstrapMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : setupStep === "confirm" ? (
                    "Create Account"
                  ) : (
                    <>Continue <ChevronRight className="w-4 h-4" /></>
                  )}
                </button>

              </form>
            </div>
          )}

          {/* ── SELECT STALKER ── */}
          {step === "select" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
              <h2 className="text-xl font-semibold text-foreground mb-1">Sign In</h2>
              <p className="text-sm text-muted-foreground mb-6">Select your name to continue</p>

              <div className="space-y-2">
                {stalkers.map(s => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedName(s.name); setPin(""); setError(null); setStep("pin"); }}
                    className="w-full flex items-center justify-between px-4 py-3.5 bg-card border border-border rounded-md hover:border-primary/40 hover:bg-primary/3 transition-all group text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {s.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-foreground text-sm">{s.name}</span>
                        {s.isAdmin && (
                          <span className="ml-2 text-[10px] font-semibold text-primary/70 uppercase tracking-wider border border-primary/20 rounded px-1.5 py-0.5">
                            Admin
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                ))}
              </div>

              <p className="mt-6 text-xs text-center text-muted-foreground">
                Contact your administrator to add or change accounts.
              </p>
            </div>
          )}

          {/* ── PIN ENTRY ── */}
          {step === "pin" && selectedName && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-200">
              <button
                onClick={() => { setStep("select"); setPin(""); setError(null); }}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6 flex items-center gap-1"
              >
                ← Back
              </button>

              <div className="mb-6">
                <p className="text-muted-foreground text-sm mb-1">Signing in as</p>
                <h2 className="text-xl font-semibold text-foreground">{selectedName}</h2>
              </div>

              <div className="space-y-5">
                <PinDots value={pin} error={!!error} />

                {error && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {loginMutation.isPending ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <Keypad onPress={handleKeypad} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PinDots({ value, error }: { value: string; error?: boolean }) {
  return (
    <div className="flex justify-center gap-4 py-2">
      {[0, 1, 2, 3].map(i => (
        <div
          key={i}
          className={cn(
            "w-4 h-4 rounded-full border-2 transition-all duration-150",
            i < value.length
              ? error
                ? "bg-destructive border-destructive"
                : "bg-primary border-primary"
              : error
              ? "border-destructive/40"
              : "border-border"
          )}
        />
      ))}
    </div>
  );
}

function Keypad({ onPress }: { onPress: (digit: string) => void }) {
  const keys = ["1","2","3","4","5","6","7","8","9","","0","del"];
  return (
    <div className="grid grid-cols-3 gap-3">
      {keys.map((k, i) =>
        k === "" ? (
          <div key={i} />
        ) : k === "del" ? (
          <button
            key="del"
            type="button"
            onClick={() => onPress("del")}
            className="h-14 flex items-center justify-center rounded-md bg-muted hover:bg-border text-foreground transition-colors active:scale-95"
          >
            <Delete className="w-5 h-5" />
          </button>
        ) : (
          <button
            key={k}
            type="button"
            onClick={() => onPress(k)}
            className="h-14 flex items-center justify-center rounded-md bg-card border border-border text-xl font-semibold text-foreground hover:bg-muted hover:border-primary/30 transition-all active:scale-95 shadow-sm"
          >
            {k}
          </button>
        )
      )}
    </div>
  );
}
