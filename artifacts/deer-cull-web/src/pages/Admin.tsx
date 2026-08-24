import React, { useState } from "react";
import { ArrowLeft, Shield } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { StalkersManager } from "@/components/StalkersManager";
import { TargetsManager } from "@/components/TargetsManager";

export default function AdminPage() {
  const { stalker: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"stalkers" | "targets">("stalkers");

  if (!currentUser?.isAdmin) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-4 bg-background">
        <Shield className="w-10 h-10 text-muted-foreground/30" />
        <h2 className="text-lg font-semibold text-foreground">Access Restricted</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Only administrators can manage the system.
        </p>
        <Link href="/" className="text-sm text-primary font-semibold hover:underline">Return to Map</Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background relative">
      {/* Header */}
      <div className="shrink-0 bg-background border-b border-border px-4 pt-4 pb-0 flex flex-col gap-4 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-8 h-8 flex items-center justify-center rounded-md bg-muted hover:bg-border transition-colors text-foreground shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <h2 className="text-xl font-display text-foreground leading-none truncate">Administration</h2>
            <p className="text-xs text-muted-foreground mt-1 truncate">Manage accounts & cull targets</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6">
          <button 
            onClick={() => setActiveTab("stalkers")} 
            className={cn(
              "pb-2.5 text-sm font-semibold transition-all relative -mb-[1px]", 
              activeTab === "stalkers" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Stalkers
            {activeTab === "stalkers" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
          </button>
          <button 
            onClick={() => setActiveTab("targets")} 
            className={cn(
              "pb-2.5 text-sm font-semibold transition-all relative -mb-[1px]", 
              activeTab === "targets" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Cull Targets
            {activeTab === "targets" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "stalkers" ? (
          <StalkersManager currentUser={currentUser} />
        ) : (
          <TargetsManager />
        )}
      </div>
    </div>
  );
}
