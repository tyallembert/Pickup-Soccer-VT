"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Ctx = {
  viewAsUser: boolean;
  setViewAsUser: (v: boolean) => void;
};

const ViewModeContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "vps:view-as-user";

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [viewAsUser, setState] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") setState(true);
    } catch {}
  }, []);

  const setViewAsUser = (v: boolean) => {
    setState(v);
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {}
  };

  return (
    <ViewModeContext.Provider value={{ viewAsUser, setViewAsUser }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode(): Ctx {
  const ctx = useContext(ViewModeContext);
  if (!ctx) return { viewAsUser: false, setViewAsUser: () => {} };
  return ctx;
}
