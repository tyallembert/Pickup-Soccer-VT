"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { MapPin, Search, Shield, UserRound, Users } from "lucide-react";
import { Input } from "@/app/_components/ui/input";
import { useAdminData, type AdminUserRow } from "../AdminDataProvider";
import { AdminSkeleton } from "../AdminSkeleton";

export function AllUsersClient() {
  const [q, setQ] = useState("");
  const { allUsers: rows, isLoading } = useAdminData();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (rows ?? []).slice().sort((a, b) => b.createdAt - a.createdAt);
    if (!needle) return list;
    return list.filter(
      (u) =>
        (u.name ?? "").toLowerCase().includes(needle) ||
        (u.email ?? "").toLowerCase().includes(needle),
    );
  }, [rows, q]);

  const adminCount = useMemo(
    () => (rows ?? []).filter((u) => u.role === "admin").length,
    [rows],
  );

  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (isLoading || !root.current) return;
      const targets = root.current.querySelectorAll(".users-anim");
      if (targets.length === 0) return;
      gsap.from(targets, {
        y: 12,
        opacity: 0,
        duration: 0.4,
        ease: "power3.out",
        stagger: 0.04,
      });
    },
    { scope: root, dependencies: [isLoading] },
  );

  if (isLoading) {
    return (
      <div ref={root}>
        <AdminSkeleton />
      </div>
    );
  }

  const total = rows?.length ?? 0;

  return (
    <div ref={root} className="flex flex-col gap-6">
      <header className="users-anim overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-700 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-300">
            Admin · Users
          </p>
        </div>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <Users className="h-6 w-6" />
          Signed-up users
        </h1>
        <p className="mt-1 text-sm text-zinc-300">
          {total} total · {adminCount} admin{adminCount === 1 ? "" : "s"}.
        </p>
      </header>

      <section className="users-anim rounded-2xl border border-zinc-200 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
            aria-label="Search users"
          />
        </div>
      </section>

      <section className="users-anim overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {filtered.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-zinc-500">
            {q ? "No matches." : "No users yet."}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {filtered.map((u) => (
              <UserListRow key={u._id} user={u} />
            ))}
          </ul>
        )}
        {rows ? (
          <footer className="border-t border-zinc-100 px-5 py-2 text-[11px] text-zinc-500 dark:border-zinc-900">
            Showing {filtered.length} of {rows.length}
            {filtered.length === 1 ? " user" : " users"}.
          </footer>
        ) : null}
      </section>
    </div>
  );
}

function UserListRow({ user }: { user: AdminUserRow }) {
  const display = user.name?.trim() || user.email || "Unknown user";
  return (
    <li>
      <Link
        href={`/admin/users/${user._id}`}
        className="group flex items-center gap-3 px-5 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
      >
        <Avatar name={display} image={user.image} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {display}
            </p>
            {user.role === "admin" ? <AdminPill /> : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {user.email ?? "No email"}
          </p>
        </div>
        <div className="hidden flex-col items-end gap-0.5 text-right sm:flex">
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            <MapPin className="h-3 w-3" />
            {user.locationsCount}
          </span>
          <span className="text-[10px] text-zinc-400">
            Joined {formatJoined(user.createdAt)}
          </span>
        </div>
        <span className="text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-600">
          →
        </span>
      </Link>
    </li>
  );
}

function Avatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
      {initials || <UserRound className="h-4 w-4" />}
    </div>
  );
}

function AdminPill() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
      <Shield className="h-2.5 w-2.5" />
      Admin
    </span>
  );
}

function formatJoined(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
