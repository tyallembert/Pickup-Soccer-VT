"use client";

import { useRef } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowLeft,
  CheckCircle2,
  Handshake,
  Hourglass,
  Mail,
  MapPin,
  Phone,
  Shield,
  UserRound,
  XCircle,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AdminSkeleton } from "../../AdminSkeleton";

type LocationStatus = "pending" | "approved" | "rejected";
type MaintainerStatus = "pending" | "approved";

export function UserDetailClient({ id }: { id: Id<"users"> }) {
  const data = useQuery(api.admin.adminGetUser, { id });

  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!data || !root.current) return;
      const targets = root.current.querySelectorAll(".user-anim");
      if (targets.length === 0) return;
      gsap.from(targets, {
        y: 12,
        opacity: 0,
        duration: 0.4,
        ease: "power3.out",
        stagger: 0.05,
      });
    },
    { scope: root, dependencies: [data === undefined] },
  );

  if (data === undefined) {
    return (
      <div ref={root}>
        <AdminSkeleton />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          This user no longer exists.
        </div>
      </div>
    );
  }

  const display = data.name?.trim() || data.email || "Unknown user";
  const isAdmin = data.role === "admin";

  return (
    <div ref={root} className="flex flex-col gap-6">
      <div className="user-anim">
        <BackLink />
      </div>

      <header
        className={`user-anim overflow-hidden rounded-2xl bg-gradient-to-br p-6 text-white shadow-lg ${
          isAdmin ? "from-emerald-700 to-emerald-500" : "from-zinc-900 to-zinc-700"
        }`}
      >
        <div className="flex items-center gap-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/70">
            Admin · User
          </p>
          {isAdmin ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest backdrop-blur">
              <Shield className="h-3 w-3" />
              Admin
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex items-center gap-4">
          <BigAvatar name={display} image={data.image} />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{display}</h1>
            <p className="mt-0.5 truncate text-sm text-white/80">
              Joined {formatJoined(data.createdAt)}
            </p>
          </div>
        </div>
      </header>

      <section className="user-anim overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <SectionHeader eyebrow="Profile" title="Contact" />
        <dl className="divide-y divide-zinc-100 dark:divide-zinc-900">
          <ProfileRow
            icon={<UserRound className="h-4 w-4" />}
            label="Name"
            value={data.name}
          />
          <ProfileRow
            icon={<Mail className="h-4 w-4" />}
            label="Email"
            value={data.email}
            href={data.email ? `mailto:${data.email}` : undefined}
          />
          <ProfileRow
            icon={<Phone className="h-4 w-4" />}
            label="Phone"
            value={data.phone}
            href={data.phone ? `tel:${data.phone}` : undefined}
          />
        </dl>
      </section>

      <section className="user-anim overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <SectionHeader
          eyebrow="Locations"
          title="Owned locations"
          right={
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {data.ownedLocations.length}
            </span>
          }
        />
        {data.ownedLocations.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">
            Hasn&apos;t submitted any locations.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {data.ownedLocations.map((l) => (
              <li key={l._id}>
                <Link
                  href={`/admin/locations/${l._id}`}
                  className="group flex items-center gap-3 px-5 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{l.name}</p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {l.town}
                    </p>
                  </div>
                  <LocationStatusPill status={l.status} />
                  <span className="text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-600">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="user-anim overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <SectionHeader
          eyebrow="Co-maintainer"
          title="Maintainer requests"
          right={
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {data.maintainers.length}
            </span>
          }
        />
        {data.maintainers.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">
            No maintainer activity.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {data.maintainers.map((m) => (
              <li key={m._id}>
                <Link
                  href={`/admin/locations/${m.locationId}`}
                  className="group flex items-center gap-3 px-5 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
                    <Handshake className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {m.locationName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {m.locationTown || "—"} · requested{" "}
                      {formatJoined(m.requestedAt)}
                    </p>
                  </div>
                  <MaintainerStatusPill status={m.status} />
                  <span className="text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-600">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/users"
      className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 transition hover:text-emerald-600 dark:text-zinc-400"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      All users
    </Link>
  );
}

function SectionHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-900">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
          {eyebrow}
        </p>
        <h2 className="mt-0.5 text-lg font-semibold">{title}</h2>
      </div>
      {right}
    </header>
  );
}

function ProfileRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  href?: string;
}) {
  const empty = !value;
  const valueEl = empty ? (
    <span className="italic text-zinc-400">Not provided</span>
  ) : href ? (
    <a
      href={href}
      className="text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
    >
      {value}
    </a>
  ) : (
    <span>{value}</span>
  );
  return (
    <div className="flex items-center gap-3 px-5 py-3 text-sm">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
        {icon}
      </span>
      <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate text-zinc-900 dark:text-zinc-100">
        {valueEl}
      </span>
    </div>
  );
}

function BigAvatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-2 ring-white/30"
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
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-base font-bold text-white ring-2 ring-white/30 backdrop-blur">
      {initials || <UserRound className="h-6 w-6" />}
    </div>
  );
}

function LocationStatusPill({ status }: { status: LocationStatus }) {
  const map: Record<LocationStatus, { tone: string; icon: React.ReactNode }> = {
    pending: {
      tone: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
      icon: <Hourglass className="h-3 w-3" />,
    },
    approved: {
      tone: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    rejected: {
      tone: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200",
      icon: <XCircle className="h-3 w-3" />,
    },
  };
  const m = map[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${m.tone}`}
    >
      {m.icon}
      {status}
    </span>
  );
}

function MaintainerStatusPill({ status }: { status: MaintainerStatus }) {
  const map: Record<MaintainerStatus, { tone: string; icon: React.ReactNode }> = {
    pending: {
      tone: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
      icon: <Hourglass className="h-3 w-3" />,
    },
    approved: {
      tone: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
  };
  const m = map[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${m.tone}`}
    >
      {m.icon}
      {status}
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
