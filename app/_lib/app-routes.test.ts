// @vitest-environment node
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { appRouteFor } from "./app-routes";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("appRouteFor", () => {
  test("tab-level screens have a title and no back button", () => {
    expect(appRouteFor("/")).toEqual({ title: "Pickup Soccer" });
    expect(appRouteFor("/admin/queue")).toEqual({ title: "Approvals" });
    expect(appRouteFor("/account")).toEqual({ title: "Account" });
  });

  test("detail screens go back to their list", () => {
    expect(appRouteFor("/admin/locations/abc123")).toEqual({
      title: "Field",
      parent: "/admin/locations",
    });
    expect(appRouteFor("/admin/queue/abc123").parent).toBe("/admin/queue");
    expect(appRouteFor("/account/locations/abc123").parent).toBe("/account");
    expect(appRouteFor("/locations/abc123").parent).toBe("/");
    expect(appRouteFor("/admin/users/u1").parent).toBe("/admin/users");
  });

  test("a trailing slash doesn't change the answer", () => {
    expect(appRouteFor("/admin/queue/")).toEqual({ title: "Approvals" });
  });

  test("unknown paths fall back to the app name", () => {
    expect(appRouteFor("/nope")).toEqual({ title: "Pickup Soccer" });
  });

  test("every back target is a real page", () => {
    const paths = [
      "/signup",
      "/locations/x",
      "/account/locations/x",
      "/admin/queue/x",
      "/admin/locations/x",
      "/admin/users/x",
    ];
    for (const p of paths) {
      const parent = appRouteFor(p).parent!;
      const dir = path.join(ROOT, "app", ...parent.split("/").filter(Boolean));
      expect(existsSync(path.join(dir, "page.tsx")), parent).toBe(true);
    }
  });
});
