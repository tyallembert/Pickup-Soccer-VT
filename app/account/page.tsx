import { redirect } from "next/navigation";
import {
  convexAuthNextjsToken,
  isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { AccountClient } from "./AccountClient";

export default async function AccountPage() {
  if (!(await isAuthenticatedNextjs())) redirect("/signin?redirect=%2Faccount");
  const token = await convexAuthNextjsToken();
  const me = await fetchQuery(api.public.me, {}, { token });
  if (!me) redirect("/signin?redirect=%2Faccount");
  return <AccountClient email={me.email} role={me.role} />;
}
