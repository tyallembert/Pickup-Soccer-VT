import { redirect } from "next/navigation";
import { convexAuthNextjsToken, isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthenticatedNextjs())) redirect("/signin?redirect=%2Fadmin");
  const token = await convexAuthNextjsToken();
  const me = await fetchQuery(api.public.me, {}, { token });
  if (!me || me.role !== "admin") redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <nav className="flex items-center gap-4 border-b border-zinc-200 pb-3 text-sm dark:border-zinc-800">
        <Link href="/admin" className="font-semibold">Admin</Link>
        <Link href="/admin/queue" className="text-zinc-600 hover:underline dark:text-zinc-400">Queue</Link>
        <Link href="/admin/locations" className="text-zinc-600 hover:underline dark:text-zinc-400">All locations</Link>
        <span className="ml-auto text-zinc-500">{me.email}</span>
      </nav>
      {children}
    </div>
  );
}
