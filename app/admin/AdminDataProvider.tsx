"use client";

import { createContext, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useViewMode } from "@/app/_lib/view-mode";

type Status = "pending" | "approved" | "rejected";

export type AdminLocationRow = {
  _id: string;
  name: string;
  town: string;
  status: Status;
  rejectionReason?: string;
  submittedAt: number;
  ownerEmail: string;
};

export type AdminPendingRow = {
  _id: string;
  name: string;
  town: string;
  ownerEmail: string;
  submittedAt: number;
};

type AdminData = {
  allLocations: AdminLocationRow[] | undefined;
  pendingLocations: AdminPendingRow[] | undefined;
  isLoading: boolean;
  isReady: boolean;
};

const AdminDataContext = createContext<AdminData | null>(null);

export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { viewAsUser } = useViewMode();

  // If the admin has toggled "view as user", bounce any /admin/* navigation to
  // /account so the preview stays consistent (back button, refresh, direct URL).
  useEffect(() => {
    if (viewAsUser) router.replace("/account");
  }, [viewAsUser, router]);

  // Subscriptions mounted at the admin-layout level — they stay alive across
  // navigations between /admin, /admin/queue, /admin/locations, so the data
  // is already warm whenever a sub-page renders.
  const allLocations = useQuery(api.admin.allLocations, {}) as
    | AdminLocationRow[]
    | undefined;
  const pendingLocations = useQuery(api.admin.pendingLocations) as
    | AdminPendingRow[]
    | undefined;

  const isLoading =
    allLocations === undefined || pendingLocations === undefined;

  return (
    <AdminDataContext.Provider
      value={{
        allLocations,
        pendingLocations,
        isLoading,
        isReady: !isLoading,
      }}
    >
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData(): AdminData {
  const ctx = useContext(AdminDataContext);
  if (!ctx) {
    throw new Error("useAdminData must be used inside <AdminDataProvider>");
  }
  return ctx;
}
