// @vitest-environment node
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Resolve an app-router path to the page file that would serve it. */
function pageExists(href: string): boolean {
  const clean = href.split("?")[0].split("#")[0];
  const segments = clean.split("/").filter(Boolean);
  const dir = path.join(ROOT, "app", ...segments);
  return existsSync(path.join(dir, "page.tsx"));
}

function internalHrefs(file: string): string[] {
  const src = readFileSync(path.join(ROOT, file), "utf8");
  // Matches both `href="/x"` in JSX and `href: "/x"` in config objects.
  const found = [...src.matchAll(/href[=:]\s*"(\/[^"{}]*)"/g)].map((m) => m[1]);
  return [...new Set(found)];
}

const NAV_FILES = [
  "app/_components/BottomNav.tsx",
  "app/_components/PillNav.tsx",
  "app/_components/AdminPillNav.tsx",
];

describe("navigation links point at real routes", () => {
  test("the checker itself spots a path with no page", () => {
    // /account/locations has only [id]/page.tsx beneath it — no page of its
    // own. This guards the guard: if this ever starts passing, the resolver
    // has gone blind and the tests below mean nothing.
    expect(pageExists("/account/locations")).toBe(false);
    expect(pageExists("/account")).toBe(true);
  });

  for (const file of NAV_FILES) {
    test(`${file} has no dead links`, () => {
      const dead = internalHrefs(file).filter((h) => !pageExists(h));
      expect(dead).toEqual([]);
    });
  }
});
