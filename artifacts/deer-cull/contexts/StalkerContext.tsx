import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Stalker } from "@/constants/types";

interface StalkerContextValue {
  stalker: Stalker | null;
  isLoading: boolean;
  signIn: (stalker: Stalker) => Promise<void>;
  signOut: () => Promise<void>;
}

const StalkerContext = createContext<StalkerContextValue | null>(null);

const STORAGE_KEY = "current_stalker";

export function StalkerProvider({ children }: { children: React.ReactNode }) {
  const [stalker, setStalker] = useState<Stalker | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setStalker(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  async function signIn(s: Stalker) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    setStalker(s);
  }

  async function signOut() {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setStalker(null);
  }

  return (
    <StalkerContext.Provider value={{ stalker, isLoading, signIn, signOut }}>
      {children}
    </StalkerContext.Provider>
  );
}

export function useStalker() {
  const ctx = useContext(StalkerContext);
  if (!ctx) throw new Error("useStalker must be used inside StalkerProvider");
  return ctx;
}
