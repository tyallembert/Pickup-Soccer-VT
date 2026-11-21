/**
 * What the installed app's top bar shows for a path: a title, and for screens
 * below a list, the list to go back to. Pure so the mapping is testable and
 * the top bar stays a thin view over it.
 */
export type AppRoute = {
  title: string;
  /** Where the back button goes when there is no in-app history to pop. */
  parent?: string;
};

const ROOT_TITLE = "Pickup Soccer";

const EXACT: Record<string, AppRoute> = {
  "/": { title: ROOT_TITLE },
  "/submit": { title: "Submit a field" },
  "/account": { title: "Account" },
  "/install": { title: "Install & alerts" },
  "/signin": { title: "Sign in" },
  "/signup": { title: "Create account", parent: "/signin" },
  "/admin": { title: "Admin" },
  "/admin/queue": { title: "Approvals" },
  "/admin/locations": { title: "Fields" },
  "/admin/users": { title: "Users" },
};

// Detail screens, matched by prefix. Order matters only if prefixes nest.
const NESTED: Array<{ prefix: string; route: AppRoute }> = [
  { prefix: "/locations/", route: { title: "Field", parent: "/" } },
  {
    prefix: "/account/locations/",
    route: { title: "Your field", parent: "/account" },
  },
  {
    prefix: "/admin/queue/",
    route: { title: "Review field", parent: "/admin/queue" },
  },
  {
    prefix: "/admin/locations/",
    route: { title: "Field", parent: "/admin/locations" },
  },
  { prefix: "/admin/users/", route: { title: "User", parent: "/admin/users" } },
];

export function appRouteFor(pathname: string): AppRoute {
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  const exact = EXACT[path];
  if (exact) return exact;
  for (const { prefix, route } of NESTED) {
    if (path.startsWith(prefix) && path.length > prefix.length) return route;
  }
  return { title: ROOT_TITLE };
}
