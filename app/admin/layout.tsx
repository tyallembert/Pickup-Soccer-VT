import { redirect } from "next/navigation";
import {
  convexAuthNextjsToken,
  isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { AdminDataProvider } from "./AdminDataProvider";
import { InstallPrompt } from "@/app/_components/InstallPrompt";
import { AdminMobileTabs } from "./AdminMobileTabs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticatedNextjs())) redirect("/signin?redirect=%2Fadmin");
  const token = await convexAuthNextjsToken();
  const me = await fetchQuery(api.public.me, {}, { token });
  if (!me || me.role !== "admin") redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 pt-24 pb-12 app:gap-4 app:px-4 app:pt-4 app:pb-6">
      <AdminMobileTabs />
      <InstallPrompt />
      <AdminDataProvider>{children}</AdminDataProvider>
    </div>
  );
}
