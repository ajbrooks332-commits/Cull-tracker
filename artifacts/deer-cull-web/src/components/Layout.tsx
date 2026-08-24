import React from "react";
import { Link, useLocation } from "wouter";
import { Map, List, HelpCircle, Settings, LogOut, RefreshCw, WifiOff, Timer, ClipboardList, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { formatSeasonLabel, getCurrentPlanYear } from "@/lib/constants";
import { useOfflineSync } from "@/hooks/use-offline-sync";

const NAV_ITEMS = [
  { href: "/",             label: "Map",         icon: Map },
  { href: "/records",      label: "Records",     icon: List },
  { href: "/sessions",     label: "Sessions",    icon: Timer },
  { href: "/assessments",  label: "Assess",      icon: ClipboardList },
  { href: "/help",         label: "Help",        icon: HelpCircle },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { stalker, logout } = useAuth();
  const { isOnline, pendingCount, isSyncing, syncError, sync } = useOfflineSync();

  const currentSeason = formatSeasonLabel(getCurrentPlanYear());

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden">

      {/* Header */}
      <header className="shrink-0 bg-primary text-primary-foreground z-20 shadow-lg">
        <div className="px-4 h-14 flex items-center justify-between gap-3">

          {/* Left: identity */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="shrink-0">
              <div className="flex flex-col gap-[3px]">
                <div className="w-5 h-1 bg-primary-foreground rounded-sm" />
                <div className="w-3.5 h-1 bg-primary-foreground/50 rounded-sm" />
                <div className="w-5 h-1 bg-primary-foreground rounded-sm" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-primary-foreground/60 uppercase tracking-[0.1em] leading-none mb-0.5">
                Season {currentSeason}
              </p>
              <h1 className="text-sm font-bold text-primary-foreground leading-none truncate">
                Deer Cull Records
              </h1>
            </div>
          </div>

          {/* Right: sync status + actions */}
          <div className="flex items-center gap-1 shrink-0">

            {/* Sync / offline indicator */}
            {!isOnline && (
              <div className="flex items-center gap-1 mr-1 bg-amber-500/20 border border-amber-400/30 rounded px-2 py-1">
                <WifiOff className="w-3 h-3 text-amber-300 shrink-0" />
                <span className="text-[10px] font-semibold text-amber-200">Offline</span>
              </div>
            )}

            {isOnline && pendingCount > 0 && !syncError && (
              <button
                onClick={sync}
                disabled={isSyncing}
                title="Sync queued records"
                className="flex items-center gap-1 mr-1 bg-amber-500/20 border border-amber-400/30 rounded px-2 py-1 hover:bg-amber-500/30 transition-colors"
              >
                <RefreshCw className={cn("w-3 h-3 text-amber-300 shrink-0", isSyncing && "animate-spin")} />
                <span className="text-[10px] font-semibold text-amber-200">
                  {isSyncing ? "Syncing…" : `${pendingCount} unsynced`}
                </span>
              </button>
            )}

            {isOnline && pendingCount > 0 && syncError && (
              <button
                onClick={sync}
                disabled={isSyncing}
                title={`Sync failed: ${syncError}. Tap to retry.`}
                className="flex items-center gap-1 mr-1 bg-red-500/25 border border-red-400/40 rounded px-2 py-1 hover:bg-red-500/35 transition-colors"
              >
                <AlertTriangle className={cn("w-3 h-3 text-red-200 shrink-0", isSyncing && "animate-pulse")} />
                <span className="text-[10px] font-semibold text-red-100">
                  {isSyncing ? "Retrying…" : `${pendingCount} stuck`}
                </span>
              </button>
            )}

            {stalker && (
              <div className="hidden sm:flex items-center gap-2 mr-1">
                <div className="w-6 h-6 rounded-full bg-primary-foreground/15 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary-foreground">
                    {stalker.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-xs font-medium text-primary-foreground/80 max-w-[100px] truncate">
                  {stalker.name}
                </span>
              </div>
            )}

            {stalker?.isAdmin && (
              <Link
                href="/admin"
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-colors",
                  location === "/admin"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                )}
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}

            <button
              onClick={logout}
              title="Sign out"
              className="p-2 rounded text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stalker name strip on mobile */}
        {stalker && (
          <div className="sm:hidden bg-primary-foreground/8 border-t border-primary-foreground/10 px-4 py-1.5 flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-primary-foreground/15 flex items-center justify-center">
              <span className="text-[8px] font-bold text-primary-foreground">
                {stalker.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-[11px] text-primary-foreground/70 font-medium">{stalker.name}</span>
            {stalker.isAdmin && (
              <span className="text-[9px] font-semibold text-primary-foreground/50 uppercase tracking-wider border border-primary-foreground/20 rounded px-1.5">
                Admin
              </span>
            )}
          </div>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 relative overflow-hidden bg-background">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="shrink-0 bg-card border-t border-border pb-safe-bottom z-20 shadow-[0_-1px_0_rgba(0,0,0,0.06)]">
        <div className="flex items-stretch h-14 px-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md mx-0.5 transition-all duration-150",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className={cn("w-5 h-5 transition-all", active && "scale-110")} />
                <span className={cn("text-[10px] font-semibold tracking-wide", active ? "text-primary" : "")}>
                  {label}
                </span>
                {active && <div className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-t-full" />}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
