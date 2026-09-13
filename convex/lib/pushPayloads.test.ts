import { describe, expect, test } from "vitest";
import { buildPushPayload, type PushEvent } from "./pushPayloads";

describe("buildPushPayload", () => {
  test("locationPending deep-links to the queue entry", () => {
    const p = buildPushPayload({
      kind: "locationPending",
      locationId: "loc123",
      name: "Oakledge Park",
      town: "Burlington",
    });
    expect(p.title).toBe("New field awaiting review");
    expect(p.body).toBe("Oakledge Park — Burlington");
    expect(p.url).toBe("/admin/queue/loc123");
    // Stable per-location tag: a resubmission replaces the earlier notification
    // instead of stacking a second one.
    expect(p.tag).toBe("location:loc123");
  });

  test("userSignup uses the email when there is one", () => {
    const p = buildPushPayload({
      kind: "userSignup",
      userId: "u1",
      email: "player@example.com",
    });
    expect(p.body).toBe("player@example.com");
    expect(p.url).toBe("/admin/users/u1");
  });

  test("userSignup falls back when the account has no email", () => {
    const p = buildPushPayload({ kind: "userSignup", userId: "u1" });
    expect(p.body).toBe("A new account was created.");
  });

  test("maintainerRequest names the location", () => {
    const p = buildPushPayload({
      kind: "maintainerRequest",
      locationId: "loc9",
      name: "Leddy Park",
    });
    expect(p.body).toContain("Leddy Park");
    expect(p.url).toBe("/admin/locations/loc9");
  });

  test("pendingDigest singularises one submission", () => {
    const p = buildPushPayload({ kind: "pendingDigest", pendingCount: 1 });
    expect(p.body).toBe("1 submission is waiting for review.");
    expect(p.url).toBe("/admin/queue");
  });

  test("pendingDigest pluralises several submissions", () => {
    const p = buildPushPayload({ kind: "pendingDigest", pendingCount: 4 });
    expect(p.body).toBe("4 submissions are waiting for review.");
  });

  test("every event kind produces a non-empty title, body and tag", () => {
    const events: PushEvent[] = [
      { kind: "locationPending", locationId: "l", name: "n", town: "t" },
      { kind: "userSignup", userId: "u" },
      { kind: "maintainerRequest", locationId: "l", name: "n" },
      { kind: "pendingDigest", pendingCount: 2 },
    ];
    for (const e of events) {
      const p = buildPushPayload(e);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.body.length).toBeGreaterThan(0);
      expect(p.tag.length).toBeGreaterThan(0);
      expect(p.url.startsWith("/admin")).toBe(true);
    }
  });
});
